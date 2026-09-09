"""CLI: fetch public RSS feeds and upsert the PodBee catalog.

    python -m pipeline.ingest --feeds feeds.txt
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from pipeline.db import CatalogWriter
from pipeline.extract import CHART_SLUGS
from pipeline.podcastindex import (
    ENV_KEY,
    ENV_SECRET,
    credentials_from_env,
    merge_feed_urls,
    trending_feed_urls,
)
from pipeline.rss import ingest_feed, load_feed_urls

log = logging.getLogger("pipeline.ingest")

ENV_URL_KEYS = ("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
ENV_KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY"


def _load_dotenv() -> None:
    """Load KEY=VAL from common env files without python-dotenv. Never logs values."""
    here = Path(__file__).resolve().parent
    root = here.parent
    for path in (
        root / ".env",
        root / ".env.local",
        here / ".env",
        Path.cwd() / ".env",
        Path.cwd() / ".env.local",
    ):
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def resolve_feeds_path(value: str) -> Path:
    path = Path(value)
    if path.is_file():
        return path
    bundled = Path(__file__).resolve().parent / value
    if bundled.is_file():
        return bundled
    raise FileNotFoundError(
        f"feeds file not found: {value} (also looked in {bundled})"
    )


def read_env() -> tuple[str, str]:
    url = ""
    for key in ENV_URL_KEYS:
        url = os.environ.get(key, "").strip()
        if url:
            break
    service_key = os.environ.get(ENV_KEY_NAME, "").strip()
    return url, service_key


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.ingest",
        description="RSS-first ingest into Supabase (service_role). Not a media player.",
    )
    parser.add_argument(
        "--feeds",
        required=True,
        help="Path to a text file of RSS URLs (one per line). Relative names also resolve next to this package.",
    )
    parser.add_argument(
        "--max-episodes",
        type=int,
        default=80,
        help="Most-recent episodes to keep per feed (default: 80). Protects free-tier writes.",
    )
    parser.add_argument(
        "--limit-feeds",
        type=int,
        default=0,
        help="Optional cap on how many feeds to process (0 = all).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and parse only; skip Supabase writes.",
    )
    parser.add_argument(
        "--skip-charts",
        action="store_true",
        help="Upsert catalog rows but do not refresh chart_entries.",
    )
    parser.add_argument(
        "--rss-only",
        action="store_true",
        help="Do not call Podcast Index, even if PODCAST_INDEX_* env vars are set.",
    )
    parser.add_argument(
        "--trending-max",
        type=int,
        default=15,
        help="Max feeds per Podcast Index trending page (capped at 25). Ignored with --rss-only.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="DEBUG logging.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    _load_dotenv()

    feeds_path = resolve_feeds_path(args.feeds)
    urls = load_feed_urls(str(feeds_path))
    pi_creds = None if args.rss_only else credentials_from_env()
    if args.rss_only:
        log.info("RSS-only mode: skipping Podcast Index")
    elif pi_creds:
        log.info(
            "Podcast Index trending enabled (4 small pages). "
            "Do not crawl the full index — weekly dump is the bulk path."
        )
        try:
            discovered = trending_feed_urls(
                pi_creds[0],
                pi_creds[1],
                max_per_chart=args.trending_max,
            )
            before = len(urls)
            urls = merge_feed_urls(urls, discovered)
            log.info(
                "merged %s starter + %s discovered → %s unique feeds",
                before,
                len(discovered),
                len(urls),
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Podcast Index trending skipped: %s", exc)
    else:
        log.info(
            "Podcast Index env not set (%s / %s) — using RSS list only",
            ENV_KEY,
            ENV_SECRET,
        )
    if args.limit_feeds:
        urls = urls[: args.limit_feeds]
    if not urls:
        log.error("no feed URLs in %s", feeds_path)
        return 2

    url, service_key = read_env()
    writer: CatalogWriter | None = None
    if args.dry_run:
        log.info("dry-run: fetch/parse only (no Supabase writes)")
    else:
        if not url or not service_key:
            log.error(
                "missing env: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and %s. "
                "Do not put secrets in code or the Next.js app.",
                ENV_KEY_NAME,
            )
            return 2
        writer = CatalogWriter(url, service_key, dry_run=False)
        writer.ensure_charts()
        for spec_slug in ("comedy", "true-crime", "news"):
            writer.ensure_genre(spec_slug)

    ok = 0
    failed: list[str] = []
    for index, feed_url in enumerate(urls, start=1):
        log.info("[%s/%s] fetch %s", index, len(urls), feed_url)
        try:
            podcast = ingest_feed(feed_url, max_episodes=args.max_episodes)
        except Exception as exc:  # noqa: BLE001 — keep remaining feeds going
            log.error("skip %s: %s", feed_url, exc)
            failed.append(feed_url)
            continue

        log.info(
            "  %s slug=%s cover=%s genres=%s credits=%s episodes=%s",
            podcast.title,
            podcast.slug,
            "yes" if podcast.cover_image_url else "no",
            ",".join(podcast.genres) or "-",
            len(podcast.credits),
            len(podcast.episodes),
        )
        for credit in podcast.credits:
            log.info("    show %s: %s", credit.role_id, credit.display_name)

        if args.dry_run or writer is None:
            ok += 1
            continue

        try:
            stats = writer.upsert_podcast(podcast)
            log.info(
                "  upserted %s episodes=%s show_credits=%s episode_credits=%s",
                stats["slug"],
                stats["episodes"],
                stats["show_credits"],
                stats["episode_credits"],
            )
            ok += 1
        except Exception as exc:  # noqa: BLE001
            log.error("upsert failed for %s: %s", podcast.slug, exc)
            failed.append(feed_url)

    if writer is not None and not args.skip_charts:
        log.info("refreshing charts %s", ", ".join(CHART_SLUGS))
        try:
            counts = writer.refresh_charts()
            for slug, count in counts.items():
                log.info("  %s → %s rows", slug, count)
        except Exception as exc:  # noqa: BLE001
            log.error("chart refresh failed: %s", exc)
            return 1

    log.info("done: %s ok, %s failed, %s feeds", ok, len(failed), len(urls))
    if failed:
        for feed_url in failed:
            log.error("failed: %s", feed_url)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
