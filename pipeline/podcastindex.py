"""Optional Podcast Index client — trending discovery only.

Podcast Index ToS: do not scrape or crawl the entire index. This module
issues a handful of small, targeted /podcasts/trending calls. Episode
artwork and episode rows still come from each show's public RSS.

Weekly database dump is the bulk path and is out of scope.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Any

import httpx

from pipeline.rss import USER_AGENT

log = logging.getLogger("pipeline.podcastindex")

API_BASE = "https://api.podcastindex.org/api/1.0"
ENV_KEY = "PODCAST_INDEX_API_KEY"
ENV_SECRET = "PODCAST_INDEX_API_SECRET"

# One small page per home-page chart. Never paginate past this.
TRENDING_QUERIES: tuple[tuple[str, str | None], ...] = (
    ("top-overall", None),
    ("top-comedy", "Comedy"),
    ("top-true-crime", "True Crime"),
    ("top-news", "News"),
)
DEFAULT_PAGE_SIZE = 15
MAX_PAGE_SIZE = 25
REQUEST_GAP_SECONDS = 1.2


def credentials_from_env() -> tuple[str, str] | None:
    key = os.environ.get(ENV_KEY, "").strip()
    secret = os.environ.get(ENV_SECRET, "").strip()
    if key and secret:
        return key, secret
    return None


def auth_headers(api_key: str, api_secret: str, *, now: int | None = None) -> dict[str, str]:
    timestamp = str(int(time.time() if now is None else now))
    token = hashlib.sha1(f"{api_key}{api_secret}{timestamp}".encode("utf-8")).hexdigest()
    return {
        "User-Agent": USER_AGENT,
        "X-Auth-Key": api_key,
        "X-Auth-Date": timestamp,
        "Authorization": token,
    }


def _feed_url(feed: dict[str, Any]) -> str | None:
    for field in ("url", "originalUrl", "feedUrl"):
        value = feed.get(field)
        if value and str(value).startswith("http"):
            return str(value).strip()
    return None


def trending_feed_urls(
    api_key: str,
    api_secret: str,
    *,
    max_per_chart: int = DEFAULT_PAGE_SIZE,
    timeout: float = 30.0,
) -> list[str]:
    """Return unique public RSS URLs from four small trending pages."""
    page = max(1, min(int(max_per_chart), MAX_PAGE_SIZE))
    urls: list[str] = []
    seen: set[str] = set()

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for index, (chart_slug, category) in enumerate(TRENDING_QUERIES):
            if index:
                time.sleep(REQUEST_GAP_SECONDS)
            params: dict[str, Any] = {"max": page, "lang": "en"}
            if category:
                params["cat"] = category
            headers = auth_headers(api_key, api_secret)
            response = client.get(
                f"{API_BASE}/podcasts/trending",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            payload = response.json()
            feeds = payload.get("feeds") or payload.get("items") or []
            added = 0
            for feed in feeds:
                url = _feed_url(feed) if isinstance(feed, dict) else None
                if not url or url in seen:
                    continue
                seen.add(url)
                urls.append(url)
                added += 1
            log.info(
                "podcastindex trending %s cat=%s → %s new feeds",
                chart_slug,
                category or "overall",
                added,
            )
    return urls


def merge_feed_urls(primary: list[str], extra: list[str]) -> list[str]:
    """Keep operator list first; append discovered URLs without duplicates."""
    out: list[str] = []
    seen: set[str] = set()
    for url in [*primary, *extra]:
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out
