"""Pure helpers: slugs, genre mapping, credit heuristics, chart scores."""

from __future__ import annotations

import html
import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Iterable

CREDIT_ROLE_IDS = (
    "host",
    "co_host",
    "guest",
    "producer",
    "executive_producer",
)

ROLE_ALIASES = {
    "host": "host",
    "hosts": "host",
    "hosted": "host",
    "co-host": "co_host",
    "cohost": "co_host",
    "co_host": "co_host",
    "co-hosts": "co_host",
    "guest": "guest",
    "guests": "guest",
    "producer": "producer",
    "produced": "producer",
    "executive_producer": "executive_producer",
    "executive producer": "executive_producer",
    "exec producer": "executive_producer",
    "executive-producer": "executive_producer",
}

# iTunes / Apple Podcasts categories → existing (or seedable) genre slugs.
ITUNES_GENRE_MAP = {
    "comedy": "comedy",
    "true crime": "true-crime",
    "news": "news",
    "news & politics": "news",
    "daily news": "news",
    "politics": "news",
    "news commentary": "news",
    "society & culture": "society-culture",
    "science": "science",
    "business": "business",
    "history": "history",
    "sports": "sports",
    "education": "education",
    "arts": "arts",
    "technology": "technology",
    "health": "health",
    "health & fitness": "health",
    "kids & family": "kids-family",
    "leisure": "leisure",
    "music": "music",
    "fiction": "fiction",
    "religion & spirituality": "religion",
    "tv & film": "tv-film",
    "government": "government",
    "documentary": "documentary",
}

CHART_SLUGS = (
    "top-overall",
    "top-comedy",
    "top-true-crime",
    "top-news",
)

CHART_SPECS = (
    {
        "slug": "top-overall",
        "title": "Top podcasts",
        "kind": "overall",
        "genre_slug": None,
    },
    {
        "slug": "top-comedy",
        "title": "Top Comedy",
        "kind": "genre",
        "genre_slug": "comedy",
    },
    {
        "slug": "top-true-crime",
        "title": "Top True Crime",
        "kind": "genre",
        "genre_slug": "true-crime",
    },
    {
        "slug": "top-news",
        "title": "Top News & Politics",
        "kind": "genre",
        "genre_slug": "news",
    },
)

ORG_EXACT = {
    "npr",
    "bbc",
    "wnyc",
    "wbez",
    "nyt",
    "nbc",
    "wsj",
    "iheart",
    "spotify",
    "wondery",
    "gimlet",
    "earwolf",
    "audiochuck",
    "team coco",
    "team coco & earwolf",
    "exactly right",
    "serial productions",
    "serial productions & the new york times",
    "the new york times",
    "new york times",
    "wnyc studios",
    "nbc news",
    "vox media",
    "crooked media",
    "iheartpodcasts",
    "iheart podcasts",
    "this american life",
    "serial",
    "the daily",
    "npr news now",
}

ORG_FRAGMENTS = (
    "podcast",
    "studios",
    "network",
    "productions",
    "llc",
    "inc.",
    "incorporated",
    "media company",
    "radio hour",
    "news now",
)

_NAME_SPLIT = re.compile(
    r"\s*(?:,|&amp;|&| and | / |;|\+| w/ | with )\s*", re.IGNORECASE
)
_PERSON_NAME = re.compile(
    r"^[A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3}$"
)
_HOSTED_BY = re.compile(
    r"hosted by\s+(.+?)(?:\.|,|!|\n|with today|$)",
    re.IGNORECASE,
)
_JOIN_YOUR_HOST = re.compile(
    r"join your hosts?\s+(.+?)(?:\s+as\b|,|\.|$)",
    re.IGNORECASE,
)
_YOUR_HOST = re.compile(
    r"\byour hosts?\s+([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
)
_BEST_FRIEND = re.compile(
    r"\bbest friend\s+([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
)
_COHOSTED = re.compile(
    r"co-?hosted by\s+(.+?)(?:\.|,|!|\n|$)",
    re.IGNORECASE,
)
_GUEST_LINE = re.compile(
    r"(?:guest(?:s)?|featuring|interview(?:ing)?(?: with)?|with guest)\s*[:\-–]\s*"
    r"([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
    re.IGNORECASE,
)
_JOINED_BY = re.compile(
    r"(?:joined by|sits down with|talks? with|interview(?:s|ed)?(?: by| with)?)\s+"
    r"([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
    re.IGNORECASE,
)
_PRODUCED_BY = re.compile(
    r"(?:produced by|producer[:\s]+)\s*([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
    re.IGNORECASE,
)
_EXEC_PROD = re.compile(
    r"executive produc(?:er|ed by)\s*:?\s*([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){0,3})",
    re.IGNORECASE,
)
_TITLE_WITH = re.compile(
    r"\bwith\s+([A-Z][\w.'’\-]+(?:\s+[A-Z][\w.'’\-]+){1,3})\s*$"
)
_HTML_TAG = re.compile(r"(?is)<(script|style).*?>.*?</\1>|<[^>]+>")
_WS = re.compile(r"\s+")


@dataclass(frozen=True)
class CreditHint:
    display_name: str
    role_id: str
    source: str


@dataclass
class ParsedEpisode:
    title: str
    slug: str
    subtitle: str | None
    description: str | None
    episode_number: int | None
    season_number: int | None
    episode_type: str
    duration_seconds: int | None
    explicit: bool
    published_at: datetime | None
    audio_url: str | None
    cover_image_url: str | None
    guid: str | None
    credits: list[CreditHint] = field(default_factory=list)


@dataclass
class ParsedPodcast:
    title: str
    slug: str
    subtitle: str | None
    description: str | None
    language: str
    explicit: bool
    status: str
    cover_image_url: str | None
    website_url: str | None
    rss_url: str
    published_at: date | None
    genres: list[str]  # slugs, first is primary
    credits: list[CreditHint]
    episodes: list[ParsedEpisode]


def slugify(text: str, max_len: int = 80) -> str:
    raw = unicodedata.normalize("NFKD", text or "")
    raw = raw.encode("ascii", "ignore").decode("ascii")
    raw = raw.lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    if len(raw) > max_len:
        raw = raw[:max_len].rstrip("-")
    return raw or "untitled"


def sort_name(display_name: str) -> str:
    parts = [p for p in display_name.strip().split() if p]
    if len(parts) < 2:
        return display_name.strip()
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def strip_html(value: str | None, max_len: int = 20_000) -> str | None:
    if not value:
        return None
    text = html.unescape(value)
    text = _HTML_TAG.sub(" ", text)
    text = html.unescape(text)
    text = _WS.sub(" ", text).strip()
    if not text:
        return None
    return text[:max_len]


def map_credit_role(raw: str) -> str | None:
    key = (raw or "").strip().lower().replace(" ", "_")
    key = key.replace("-", "_")
    if key in ROLE_ALIASES:
        return ROLE_ALIASES[key]
    spaced = (raw or "").strip().lower()
    return ROLE_ALIASES.get(spaced)


def map_itunes_genre(raw: str) -> str | None:
    cleaned = html.unescape(raw or "").strip().lower()
    cleaned = cleaned.replace("&amp;", "&")
    return ITUNES_GENRE_MAP.get(cleaned)


def looks_like_org(name: str) -> bool:
    n = html.unescape(name or "").strip().lower()
    if not n:
        return True
    if n in ORG_EXACT:
        return True
    if any(frag in n for frag in ORG_FRAGMENTS):
        return True
    if " " not in n and n.isupper() and 2 <= len(n) <= 6:
        return True
    return False


def looks_like_person(name: str) -> bool:
    cleaned = html.unescape(name or "").strip()
    cleaned = cleaned.replace("\u2019", "'")
    if not cleaned or looks_like_org(cleaned):
        return False
    if any(ch.isdigit() for ch in cleaned):
        return False
    return bool(_PERSON_NAME.match(cleaned))


def split_people(raw: str | None) -> list[str]:
    if not raw:
        return []
    text = html.unescape(raw).strip()
    if not text:
        return []
    if looks_like_org(text) and " and " not in text.lower() and "&" not in text:
        return []
    parts = [p.strip(" .") for p in _NAME_SPLIT.split(text) if p and p.strip()]
    out: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if not looks_like_person(part):
            continue
        key = slugify(part)
        if key in seen:
            continue
        seen.add(key)
        out.append(part)
    return out


def parse_duration(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        secs = int(value)
        return secs if secs >= 0 else None
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+", text):
        return int(text)
    parts = text.split(":")
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 3:
        return int(nums[0] * 3600 + nums[1] * 60 + nums[2])
    if len(nums) == 2:
        return int(nums[0] * 60 + nums[1])
    return None


def parse_explicit(value: object) -> bool:
    text = str(value or "").strip().lower()
    return text in {"yes", "true", "explicit", "1"}


def map_episode_type(value: object) -> str:
    text = str(value or "full").strip().lower()
    if text in {"full", "trailer", "bonus"}:
        return text
    return "full"


def podcast_status(*, complete: bool, latest: datetime | None, now: datetime | None = None) -> str:
    if complete:
        return "completed"
    if latest is None:
        return "active"
    clock = now or datetime.now(timezone.utc)
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    age = clock - latest
    if age.days > 180:
        return "hiatus"
    return "active"


def episode_slug(title: str, episode_number: int | None, guid: str | None) -> str:
    base = slugify(title)
    if episode_number is not None:
        return slugify(f"{episode_number:03d}-{base}")
    if guid:
        tail = slugify(guid.rsplit("/", 1)[-1].rsplit(":", 1)[-1])
        if tail and tail != "untitled" and len(tail) <= 40:
            combined = slugify(f"{base}-{tail}")
            return combined
    return base


def extract_credits_from_text(text: str | None, *, source: str) -> list[CreditHint]:
    if not text:
        return []
    blob = strip_html(text, max_len=8000) or ""
    hints: list[CreditHint] = []

    def add(names: Iterable[str], role: str, tag: str) -> None:
        for name in names:
            if looks_like_person(name):
                hints.append(CreditHint(name.strip(), role, f"{source}:{tag}"))

    for match in _HOSTED_BY.finditer(blob):
        add(split_people(match.group(1)) or [match.group(1).strip()], "host", "hosted_by")
    for match in _JOIN_YOUR_HOST.finditer(blob):
        add(split_people(match.group(1)) or [match.group(1).strip()], "host", "join_host")
    for match in _YOUR_HOST.finditer(blob):
        add([match.group(1)], "host", "your_host")
    for match in _COHOSTED.finditer(blob):
        add(split_people(match.group(1)) or [match.group(1).strip()], "co_host", "cohosted")
    for match in _BEST_FRIEND.finditer(blob):
        add([match.group(1)], "co_host", "best_friend")
    for match in _GUEST_LINE.finditer(blob):
        add([match.group(1)], "guest", "guest_line")
    for match in _JOINED_BY.finditer(blob):
        add([match.group(1)], "guest", "joined")
    for match in _PRODUCED_BY.finditer(blob):
        add([match.group(1)], "producer", "produced")
    for match in _EXEC_PROD.finditer(blob):
        add([match.group(1)], "executive_producer", "exec")
    return _dedupe_credits(hints)


def credits_from_author(author: str | None, *, role: str, source: str) -> list[CreditHint]:
    hints = [
        CreditHint(name, role, source) for name in split_people(author)
    ]
    return _dedupe_credits(hints)


def episode_guest_from_title(title: str, description: str | None) -> list[CreditHint]:
    cleaned = html.unescape(title or "").strip()
    hints: list[CreditHint] = []
    if looks_like_person(cleaned) and description:
        desc = (strip_html(description) or "").lower()
        if cleaned.lower() in desc or cleaned.split()[0].lower() in desc:
            hints.append(CreditHint(cleaned, "guest", "episode_title"))
    with_match = _TITLE_WITH.search(cleaned)
    if with_match and looks_like_person(with_match.group(1)):
        hints.append(CreditHint(with_match.group(1), "guest", "title_with"))
    return _dedupe_credits(hints)


def _dedupe_credits(hints: Iterable[CreditHint]) -> list[CreditHint]:
    out: list[CreditHint] = []
    seen: set[tuple[str, str]] = set()
    for hint in hints:
        key = (slugify(hint.display_name), hint.role_id)
        if key in seen or not hint.display_name:
            continue
        if hint.role_id not in CREDIT_ROLE_IDS:
            continue
        seen.add(key)
        out.append(hint)
    return out


def merge_credits(*groups: Iterable[CreditHint]) -> list[CreditHint]:
    return _dedupe_credits([h for g in groups for h in g])


def score_podcast(
    *,
    rating_average: float | None,
    rating_count: int | None,
    latest_published_at: datetime | None,
    episode_count: int,
    has_cover: bool,
    now: datetime | None = None,
) -> float:
    """Prefer live ratings; otherwise recency + catalog depth + cover presence."""
    if rating_average is not None:
        count = max(0, rating_count or 0)
        return float(rating_average) * 10.0 + math.log1p(count) * 2.0

    clock = now or datetime.now(timezone.utc)
    recency = 0.0
    if latest_published_at is not None:
        latest = latest_published_at
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)
        days = max(0.0, (clock - latest).total_seconds() / 86400.0)
        recency = math.exp(-days / 90.0) * 50.0
    popularity = min(math.log1p(max(0, episode_count)) * 8.0, 40.0)
    cover = 10.0 if has_cover else 0.0
    return recency + popularity + cover


def chart_eligible(genre_slugs: Iterable[str], chart_genre: str | None) -> bool:
    if chart_genre is None:
        return True
    return chart_genre in set(genre_slugs)


def dense_ranks(
    scored: list[tuple[str, float, bool]],
) -> list[tuple[str, int, float]]:
    """Return (podcast_id, rank, score) starting at 1. Prefer rows with covers."""
    ordered = sorted(scored, key=lambda row: (-row[1], not row[2], row[0]))
    return [(pid, idx + 1, score) for idx, (pid, score, _cover) in enumerate(ordered)]
