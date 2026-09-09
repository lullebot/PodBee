"""Fetch and parse public podcast RSS feeds (no Podcast Index, no player)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import struct_time
from typing import Any
from urllib.parse import urlparse

import feedparser
import httpx

from pipeline.extract import (
    CreditHint,
    ParsedEpisode,
    ParsedPodcast,
    credits_from_author,
    episode_guest_from_title,
    episode_slug,
    extract_credits_from_text,
    map_episode_type,
    map_itunes_genre,
    merge_credits,
    parse_duration,
    parse_explicit,
    podcast_status,
    slugify,
    strip_html,
)

log = logging.getLogger("pipeline.rss")

USER_AGENT = (
    "PodBeeCatalog/0.1 (+https://github.com/lullebot/PodBee; "
    "RSS catalog ingest; not a media player)"
)
DEFAULT_TIMEOUT = 60.0
MAX_RETRIES = 3


def load_feed_urls(path: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            url = line.split()[0]
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)
    return urls


def fetch_feed_xml(url: str, *, timeout: float = DEFAULT_TIMEOUT) -> tuple[str, bytes]:
    """Return (final_url, xml_bytes). Retries transient failures."""
    last_error: Exception | None = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout, headers=headers) as client:
                response = client.get(url)
                response.raise_for_status()
                return str(response.url), response.content
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            last_error = exc
            log.warning("fetch %s failed (%s/%s): %s", url, attempt, MAX_RETRIES, exc)
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"failed to fetch RSS: {url}") from last_error


def _struct_to_dt(value: struct_time | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime(*value[:6], tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = parsedate_to_datetime(str(value))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, OverflowError):
        return None


def _href(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        href = value.get("href") or value.get("url")
        return str(href).strip() if href else None
    href = getattr(value, "href", None)
    return str(href).strip() if href else None


def _first_text(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _itunes_categories(parsed: Any, raw_xml: bytes) -> list[str]:
    slugs: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        mapped = map_itunes_genre(raw or "")
        if mapped and mapped not in seen:
            seen.add(mapped)
            slugs.append(mapped)

    for tag in parsed.feed.get("tags") or []:
        add(tag.get("term") or tag.get("label"))

    # feedparser sometimes exposes nested itunes categories here
    for cat in parsed.feed.get("itunes_categories") or []:
        if isinstance(cat, dict):
            add(cat.get("text") or cat.get("term"))
        else:
            add(str(cat))

    import re

    text = raw_xml[:200_000].decode("utf-8", "replace")
    for match in re.finditer(r'<itunes:category[^>]+text="([^"]+)"', text, re.I):
        add(match.group(1))
    return slugs


def _owner_name(feed: Any, raw_xml: bytes) -> str | None:
    owner = feed.get("itunes_owner") or feed.get("publisher_detail") or {}
    if isinstance(owner, dict):
        name = owner.get("name") or owner.get("email")
        if name:
            return str(name)
    import re

    text = raw_xml[:80_000].decode("utf-8", "replace")
    match = re.search(
        r"<itunes:owner>.*?<itunes:name>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</itunes:name>",
        text,
        re.I | re.S,
    )
    if match:
        return match.group(1).strip()
    return None


def _entry_cover(entry: Any, fallback: str | None) -> str | None:
    return _href(entry.get("itunes_image")) or _href(entry.get("image")) or fallback


def _entry_audio(entry: Any) -> str | None:
    for enc in entry.get("enclosures") or []:
        href = enc.get("href") or enc.get("url")
        mime = (enc.get("type") or "").lower()
        if href and (not mime or mime.startswith("audio") or "mpeg" in mime):
            return str(href)
    return None


def _entry_description(entry: Any) -> str | None:
    content = entry.get("content")
    if isinstance(content, list) and content:
        return strip_html(content[0].get("value"))
    return strip_html(_first_text(entry.get("summary"), entry.get("description"), entry.get("itunes_summary")))


def parse_feed(xml: bytes, *, source_url: str, max_episodes: int = 80) -> ParsedPodcast:
    parsed = feedparser.parse(xml)
    feed = parsed.feed
    title = _first_text(feed.get("title")) or urlparse(source_url).netloc or "Untitled podcast"
    subtitle = strip_html(_first_text(feed.get("itunes_subtitle"), feed.get("subtitle")), max_len=400)
    description = strip_html(
        _first_text(feed.get("itunes_summary"), feed.get("summary"), feed.get("description"))
    )
    language = (_first_text(feed.get("language")) or "en").lower()[:16]
    explicit = parse_explicit(feed.get("itunes_explicit"))
    cover = (
        _href(feed.get("itunes_image"))
        or _href((feed.get("image") or {}).get("href") if isinstance(feed.get("image"), dict) else feed.get("image"))
    )
    website = _first_text(feed.get("link"))
    genres = _itunes_categories(parsed, xml)
    author = _first_text(feed.get("itunes_author"), feed.get("author"), feed.get("publisher"))
    owner = _owner_name(feed, xml)

    show_credits = merge_credits(
        credits_from_author(author, role="host", source="itunes_author"),
        extract_credits_from_text(description, source="channel_desc"),
        extract_credits_from_text(subtitle, source="channel_sub"),
        credits_from_author(owner, role="producer", source="itunes_owner"),
    )

    entries = list(parsed.entries or [])[: max(0, max_episodes)]
    episodes: list[ParsedEpisode] = []
    used_slugs: set[str] = set()

    for entry in entries:
        ep_title = _first_text(entry.get("title")) or "Untitled episode"
        number = _coerce_int(entry.get("itunes_episode") or entry.get("itunes_episodenumber"))
        season = _coerce_int(entry.get("itunes_season"))
        guid = _first_text(entry.get("id"), entry.get("guid"))
        slug = episode_slug(ep_title, number, guid)
        if slug in used_slugs:
            slug = slugify(f"{slug}-{len(used_slugs)+1}")
        used_slugs.add(slug)

        published = _struct_to_dt(entry.get("published_parsed")) or _parse_date(entry.get("published"))
        ep_desc = _entry_description(entry)
        ep_author = _first_text(entry.get("itunes_author"), entry.get("author"))
        ep_credits = merge_credits(
            credits_from_author(ep_author, role="guest", source="episode_author"),
            extract_credits_from_text(ep_desc, source="episode_notes"),
            episode_guest_from_title(ep_title, ep_desc),
        )
        # Don't re-credit the show's host as an episode guest from the same itunes:author.
        show_host_slugs = {slugify(c.display_name) for c in show_credits if c.role_id in {"host", "co_host"}}
        ep_credits = [
            c
            for c in ep_credits
            if not (c.role_id == "guest" and slugify(c.display_name) in show_host_slugs)
        ]

        episodes.append(
            ParsedEpisode(
                title=ep_title[:500],
                slug=slug,
                subtitle=strip_html(_first_text(entry.get("itunes_subtitle"), entry.get("subtitle")), max_len=400),
                description=ep_desc,
                episode_number=number,
                season_number=season,
                episode_type=map_episode_type(entry.get("itunes_episodetype") or entry.get("itunes_episode_type")),
                duration_seconds=parse_duration(entry.get("itunes_duration")),
                explicit=parse_explicit(entry.get("itunes_explicit")) or explicit,
                published_at=published,
                audio_url=_entry_audio(entry),
                cover_image_url=_entry_cover(entry, cover),
                guid=guid,
                credits=ep_credits,
            )
        )

    latest = next((e.published_at for e in episodes if e.published_at), None)
    earliest = None
    dated = [e.published_at for e in episodes if e.published_at]
    if dated:
        earliest = min(dated).date()
        latest = max(dated)

    complete = str(feed.get("itunes_complete") or "").strip().lower() in {"yes", "true", "1"}
    status = podcast_status(complete=complete, latest=latest)

    return ParsedPodcast(
        title=title[:500],
        slug=slugify(title),
        subtitle=subtitle,
        description=description,
        language=language,
        explicit=explicit,
        status=status,
        cover_image_url=cover,
        website_url=website,
        rss_url=source_url,
        published_at=earliest,
        genres=genres,
        credits=show_credits,
        episodes=episodes,
    )


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def ingest_feed(url: str, *, max_episodes: int = 80) -> ParsedPodcast:
    final_url, xml = fetch_feed_xml(url)
    parsed = parse_feed(xml, source_url=final_url, max_episodes=max_episodes)
    if parsed.rss_url != url:
        # Keep the operator-supplied public URL as the catalog rss_url when redirects stay public.
        parsed.rss_url = url
    return parsed
