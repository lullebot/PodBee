"""Service-role Supabase writes. Never used by the Next.js frontend."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx
from supabase import Client, create_client

from pipeline.extract import (
    CHART_SPECS,
    CREDIT_ROLE_IDS,
    CreditHint,
    ParsedPodcast,
    chart_eligible,
    dense_ranks,
    score_podcast,
    slugify,
    sort_name,
)

log = logging.getLogger("pipeline.db")


def resolve_unseasoned_episode_number(
    episode_number: int | None,
    season_id: str | None,
    conflicting_slug: str | None,
) -> int | None:
    """Keep episode_number unless it would hit episodes_podcast_number_no_season_uidx.

    That partial unique index is on (podcast_id, episode_number) WHERE season_id IS NULL.
    Upserts key on (podcast_id, slug), so two slugs can share a number. When another
    unseasoned episode already owns the number, drop it on the incoming row.
    """
    if episode_number is None or season_id is not None:
        return episode_number
    if conflicting_slug:
        return None
    return episode_number


GENRE_NAMES = {
    "comedy": "Comedy",
    "true-crime": "True Crime",
    "news": "News",
    "society-culture": "Society & Culture",
    "science": "Science",
    "business": "Business",
    "history": "History",
    "sports": "Sports",
    "education": "Education",
    "arts": "Arts",
    "technology": "Technology",
    "health": "Health",
    "kids-family": "Kids & Family",
    "leisure": "Leisure",
    "music": "Music",
    "fiction": "Fiction",
    "religion": "Religion & Spirituality",
    "tv-film": "TV & Film",
    "government": "Government",
    "documentary": "Documentary",
}


class CatalogWriter:
    def __init__(self, url: str, service_role_key: str, *, dry_run: bool = False) -> None:
        if not dry_run and (not url or not service_role_key):
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        self.url = url.rstrip("/")
        self.dry_run = dry_run
        self.client: Client | None = None if dry_run else create_client(url, service_role_key)
        self._key = service_role_key
        self.columns: dict[str, set[str]] = {}
        self.role_ids: set[str] = set(CREDIT_ROLE_IDS)
        self.people_ids: dict[str, str] = {}
        self.genre_ids: dict[str, str] = {}
        self.chart_ids: dict[str, str] = {}
        if not dry_run:
            self.columns = self._load_columns()
            self._refresh_role_ids()

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Accept": "application/openapi+json",
        }

    def _load_columns(self) -> dict[str, set[str]]:
        try:
            response = httpx.get(
                f"{self.url}/rest/v1/",
                headers=self._headers(),
                timeout=30.0,
            )
            response.raise_for_status()
            spec = response.json()
        except Exception as exc:  # noqa: BLE001 — probe is best-effort
            log.warning("could not load PostgREST OpenAPI (%s); sending known columns only", exc)
            return {}

        schemas = (
            spec.get("components", {}).get("schemas")
            or spec.get("definitions")
            or {}
        )
        out: dict[str, set[str]] = {}
        for name, schema in schemas.items():
            if not isinstance(schema, dict):
                continue
            props = schema.get("properties")
            if isinstance(props, dict) and props:
                out[name] = set(props)
        return out

    def _allowed(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        cols = self.columns.get(table)
        row = {k: v for k, v in payload.items() if v is not None}
        if not cols:
            return row
        return {k: v for k, v in row.items() if k in cols}

    def _select_one(self, table: str, match: dict[str, Any]) -> dict[str, Any] | None:
        assert self.client is not None
        query = self.client.table(table).select("*")
        for key, value in match.items():
            query = query.eq(key, value)
        result = query.limit(1).execute()
        rows = result.data or []
        return rows[0] if rows else None

    def upsert_by(self, table: str, match: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        row = self._allowed(table, {**match, **payload})
        if self.dry_run:
            return {"id": f"dry-{table}-{next(iter(match.values()), 'x')}", **row}

        assert self.client is not None
        existing = self._select_one(table, match)
        if existing:
            self.client.table(table).update(row).match(match).execute()
            return {**existing, **row}

        conflict = ",".join(match.keys())
        try:
            inserted = (
                self.client.table(table)
                .upsert(row, on_conflict=conflict)
                .execute()
            )
            if inserted.data:
                return inserted.data[0]
        except Exception as exc:  # noqa: BLE001
            log.debug("upsert on_conflict=%s failed on %s: %s", conflict, table, exc)

        inserted = self.client.table(table).insert(row).execute()
        if not inserted.data:
            again = self._select_one(table, match)
            if again:
                return again
            raise RuntimeError(f"insert into {table} returned no row")
        return inserted.data[0]

    def upsert_many(
        self, table: str, rows: list[dict[str, Any]], *, on_conflict: str, chunk_size: int = 200
    ) -> list[dict[str, Any]]:
        """Bulk upsert via native ON CONFLICT — one round trip per chunk instead of
        one SELECT + one write per row. Use for high-volume tables (episodes,
        episode_credits); upsert_by is still fine for the low-cardinality ones
        (podcasts, seasons, genres — a handful of rows per ingest run)."""
        if not rows:
            return []
        allowed_rows = [self._allowed(table, row) for row in rows]
        if self.dry_run:
            return [
                {"id": f"dry-{table}-{index}", **row}
                for index, row in enumerate(allowed_rows)
            ]

        assert self.client is not None
        out: list[dict[str, Any]] = []
        for start in range(0, len(allowed_rows), chunk_size):
            chunk = allowed_rows[start : start + chunk_size]
            result = self.client.table(table).upsert(chunk, on_conflict=on_conflict).execute()
            out.extend(result.data or [])
        return out

    def _select_all(
        self,
        table: str,
        *,
        columns: str,
        filters: Any = None,
        page_size: int = 1000,
    ) -> list[dict[str, Any]]:
        """Read every row via offset pagination. A plain .execute() with no range
        silently truncates past PostgREST's per-request row cap once a table
        grows past it — this keeps catalog-wide reads (chart re-rank, conflict
        checks) correct at any size instead of quietly wrong."""
        if self.dry_run or self.client is None:
            return []
        out: list[dict[str, Any]] = []
        start = 0
        while True:
            query = self.client.table(table).select(columns)
            if filters is not None:
                query = filters(query)
            page = query.range(start, start + page_size - 1).execute()
            rows = page.data or []
            out.extend(rows)
            if len(rows) < page_size:
                break
            start += page_size
        return out

    def _refresh_role_ids(self) -> None:
        if self.dry_run or self.client is None:
            return
        try:
            result = self.client.table("credit_roles").select("id").execute()
            ids = {row["id"] for row in (result.data or []) if row.get("id")}
            if ids:
                self.role_ids = ids
        except Exception as exc:  # noqa: BLE001
            log.warning("could not load credit_roles (%s); using built-in ids", exc)

    def _select_people_by_slug(self, slugs: list[str]) -> list[dict[str, Any]]:
        if self.dry_run or self.client is None or not slugs:
            return []
        out: list[dict[str, Any]] = []
        for start in range(0, len(slugs), 200):
            chunk = slugs[start : start + 200]
            result = self.client.table("people").select("id, slug").in_("slug", chunk).execute()
            out.extend(result.data or [])
        return out

    def ensure_people(self, display_names: list[str]) -> dict[str, str]:
        """Bulk-resolve/create people by display name. Returns slug -> id for every
        name given (already-cached names cost nothing further). One SELECT for
        whatever isn't cached yet, one upsert for whatever's still new — not a
        round trip per name."""
        wanted: dict[str, str] = {}
        for name in display_names:
            slug = slugify(name)
            if slug and slug not in wanted:
                wanted[slug] = name.strip()

        missing = [slug for slug in wanted if slug not in self.people_ids]
        for row in self._select_people_by_slug(missing):
            if row.get("slug") and row.get("id"):
                self.people_ids[row["slug"]] = row["id"]

        to_create = [slug for slug in wanted if slug not in self.people_ids]
        if to_create:
            rows = [
                {
                    "slug": slug,
                    "display_name": wanted[slug],
                    "sort_name": sort_name(wanted[slug]),
                }
                for slug in to_create
            ]
            created = self.upsert_many("people", rows, on_conflict="slug")
            for row in created:
                if row.get("slug") and row.get("id"):
                    self.people_ids[row["slug"]] = row["id"]

        for slug in wanted:
            if slug not in self.people_ids:
                self.people_ids[slug] = f"dry-people-{slug}"
        return {slug: self.people_ids[slug] for slug in wanted}

    def ensure_genre(self, slug: str) -> str:
        if slug in self.genre_ids:
            return self.genre_ids[slug]
        row = self.upsert_by(
            "genres",
            {"slug": slug},
            {"name": GENRE_NAMES.get(slug, slug.replace("-", " ").title())},
        )
        genre_id = row["id"]
        self.genre_ids[slug] = genre_id
        return genre_id

    def ensure_charts(self) -> None:
        for spec in CHART_SPECS:
            payload = {
                **spec,
                # live schemas have used kind and/or chart_type
                "chart_type": spec["kind"],
                "type": spec["kind"],
            }
            row = self.upsert_by("charts", {"slug": spec["slug"]}, payload)
            self.chart_ids[spec["slug"]] = row["id"]

    def _write_credits(
        self,
        table: str,
        fk_name: str,
        fk_value: str,
        hints: list[CreditHint],
    ) -> int:
        """Single-parent credit write (podcast_credits: a handful of rows per
        podcast) — batched in one round trip, but still one call per podcast.
        Episode credits go through the whole-podcast batch in upsert_podcast
        instead, since that's the volume that actually matters at scale."""
        valid = [h for h in hints if h.role_id in self.role_ids]
        for hint in hints:
            if hint.role_id not in self.role_ids:
                log.debug("skip unknown role %s for %s", hint.role_id, hint.display_name)
        if not valid:
            return 0
        people_ids = self.ensure_people([h.display_name for h in valid])
        rows = []
        for index, hint in enumerate(valid, start=1):
            person_id = people_ids.get(slugify(hint.display_name))
            if not person_id:
                continue
            rows.append(
                {
                    fk_name: fk_value,
                    "person_id": person_id,
                    "role_id": hint.role_id,
                    "billing_order": index,
                    "character_name": None,
                }
            )
        written = self.upsert_many(table, rows, on_conflict=f"{fk_name},person_id,role_id")
        return len(written) if written else len(rows)

    def _existing_unseasoned_numbers(self, podcast_id: str) -> dict[int, str]:
        """episode_number -> slug for this podcast's existing unseasoned episodes —
        one paginated read instead of a SELECT per incoming episode."""
        rows = self._select_all(
            "episodes",
            columns="slug, episode_number",
            filters=lambda q: q.eq("podcast_id", podcast_id).is_("season_id", "null"),
        )
        out: dict[int, str] = {}
        for row in rows:
            number = row.get("episode_number")
            slug = row.get("slug")
            if number is not None and slug:
                out[number] = slug
        return out

    def _resolve_episode_number(
        self,
        slug: str,
        episode_number: int | None,
        season_id: str | None,
        existing_numbers: dict[int, str],
        claimed_unseasoned_numbers: dict[int, str],
    ) -> int | None:
        conflicting = None
        if episode_number is not None and season_id is None:
            owner = claimed_unseasoned_numbers.get(episode_number)
            if owner and owner != slug:
                conflicting = owner
            else:
                existing_owner = existing_numbers.get(episode_number)
                if existing_owner and existing_owner != slug:
                    conflicting = existing_owner
        resolved = resolve_unseasoned_episode_number(
            episode_number, season_id, conflicting
        )
        if resolved is None and episode_number is not None and season_id is None:
            log.info(
                "clearing episode_number=%s for slug=%s "
                "(already used by slug=%s; episodes_podcast_number_no_season_uidx)",
                episode_number,
                slug,
                conflicting,
            )
        elif resolved is not None and season_id is None:
            claimed_unseasoned_numbers[resolved] = slug
        return resolved

    def upsert_podcast(self, podcast: ParsedPodcast) -> dict[str, int | str]:
        show = self.upsert_by(
            "podcasts",
            {"slug": podcast.slug},
            {
                "title": podcast.title,
                "subtitle": podcast.subtitle,
                "description": podcast.description,
                "language": podcast.language,
                "explicit": podcast.explicit,
                "status": podcast.status,
                "cover_image_url": podcast.cover_image_url,
                "website_url": podcast.website_url,
                "rss_url": podcast.rss_url,
                "published_at": _date_str(podcast.published_at),
            },
        )
        podcast_id = show["id"]

        for index, genre_slug in enumerate(podcast.genres):
            genre_id = self.ensure_genre(genre_slug)
            self.upsert_by(
                "podcast_genres",
                {"podcast_id": podcast_id, "genre_id": genre_id},
                {"is_primary": index == 0},
            )

        credit_count = self._write_credits(
            "podcast_credits", "podcast_id", podcast_id, podcast.credits
        )

        season_ids: dict[int, str] = {}
        for episode in podcast.episodes:
            if episode.season_number is None:
                continue
            if episode.season_number in season_ids:
                continue
            season = self.upsert_by(
                "seasons",
                {"podcast_id": podcast_id, "number": episode.season_number},
                {
                    "title": f"Season {episode.season_number}",
                    "cover_image_url": podcast.cover_image_url,
                    "published_at": _date_str(
                        episode.published_at.date() if episode.published_at else None
                    ),
                },
            )
            season_ids[episode.season_number] = season["id"]

        # One bulk read of this podcast's existing episode numbers, instead of a
        # SELECT per incoming episode, then resolve conflicts in memory.
        existing_numbers = self._existing_unseasoned_numbers(podcast_id)
        claimed_unseasoned_numbers: dict[int, str] = {}
        episode_rows: list[dict[str, Any]] = []
        for episode in podcast.episodes:
            season_id = (
                season_ids.get(episode.season_number)
                if episode.season_number is not None
                else None
            )
            episode_number = self._resolve_episode_number(
                episode.slug,
                episode.episode_number,
                season_id,
                existing_numbers,
                claimed_unseasoned_numbers,
            )
            episode_rows.append(
                {
                    "podcast_id": podcast_id,
                    "slug": episode.slug,
                    "season_id": season_id,
                    "title": episode.title,
                    "subtitle": episode.subtitle,
                    "description": episode.description,
                    "episode_number": episode_number,
                    "episode_type": episode.episode_type,
                    "duration_seconds": episode.duration_seconds,
                    "explicit": episode.explicit,
                    "published_at": _dt_str(episode.published_at),
                    "audio_url": episode.audio_url,
                    "cover_image_url": episode.cover_image_url,
                }
            )

        # One (chunked) batch write for every episode in this podcast, instead of
        # one upsert per episode.
        written_episodes = self.upsert_many(
            "episodes", episode_rows, on_conflict="podcast_id,slug"
        )
        episode_id_by_slug = {
            row["slug"]: row["id"] for row in written_episodes if row.get("slug")
        }
        episode_count = len(episode_rows)

        # One bulk people-resolve + one (chunked) batch write for every credit
        # across every episode in this podcast, instead of a round trip per
        # credit per episode — this is the pattern that actually matters once a
        # show has hundreds or thousands of episodes.
        credit_rows: list[dict[str, Any]] = []
        all_names: list[str] = []
        for episode in podcast.episodes:
            for hint in episode.credits:
                if hint.role_id in self.role_ids:
                    all_names.append(hint.display_name)
        people_ids = self.ensure_people(all_names)

        for episode in podcast.episodes:
            episode_id = episode_id_by_slug.get(episode.slug)
            if not episode_id:
                continue
            for billing_order, hint in enumerate(episode.credits, start=1):
                if hint.role_id not in self.role_ids:
                    log.debug(
                        "skip unknown role %s for %s", hint.role_id, hint.display_name
                    )
                    continue
                person_id = people_ids.get(slugify(hint.display_name))
                if not person_id:
                    continue
                credit_rows.append(
                    {
                        "episode_id": episode_id,
                        "person_id": person_id,
                        "role_id": hint.role_id,
                        "billing_order": billing_order,
                        "character_name": None,
                    }
                )

        written_credits = self.upsert_many(
            "episode_credits", credit_rows, on_conflict="episode_id,person_id,role_id"
        )
        episode_credit_count = len(written_credits) if written_credits else len(credit_rows)

        return {
            "podcast_id": podcast_id,
            "slug": podcast.slug,
            "episodes": episode_count,
            "show_credits": credit_count,
            "episode_credits": episode_credit_count,
            "genres": len(podcast.genres),
        }

    def refresh_charts(self) -> dict[str, int]:
        self.ensure_charts()
        if self.dry_run:
            return {spec["slug"]: 0 for spec in CHART_SPECS}
        assert self.client is not None

        # Paginated reads — a plain .execute() with no range silently truncates
        # past PostgREST's per-request row cap once these tables grow, which
        # would make chart scores quietly wrong instead of erroring.
        podcasts = self._select_all(
            "podcasts",
            columns="id, slug, cover_image_url, rating_average, rating_count, published_at",
        )
        genre_rows = self._select_all("podcast_genres", columns="podcast_id, genres(slug)")
        episode_rows = self._select_all("episodes", columns="podcast_id, published_at")

        genres_by_podcast: dict[str, list[str]] = {}
        for row in genre_rows:
            slug = (row.get("genres") or {}).get("slug")
            if slug:
                genres_by_podcast.setdefault(row["podcast_id"], []).append(slug)

        latest_by_podcast: dict[str, datetime] = {}
        counts: dict[str, int] = {}
        for row in episode_rows:
            pid = row["podcast_id"]
            counts[pid] = counts.get(pid, 0) + 1
            published = _parse_iso(row.get("published_at"))
            if published is None:
                continue
            prev = latest_by_podcast.get(pid)
            if prev is None or published > prev:
                latest_by_podcast[pid] = published

        now = datetime.now(timezone.utc)
        scored: list[tuple[str, float, bool, list[str]]] = []
        for podcast in podcasts:
            pid = podcast["id"]
            latest = latest_by_podcast.get(pid) or _parse_iso(podcast.get("published_at"))
            score = score_podcast(
                rating_average=_as_float(podcast.get("rating_average")),
                rating_count=_as_int(podcast.get("rating_count")),
                latest_published_at=latest,
                episode_count=counts.get(pid, 0),
                has_cover=bool(podcast.get("cover_image_url")),
                now=now,
            )
            scored.append(
                (
                    pid,
                    score,
                    bool(podcast.get("cover_image_url")),
                    genres_by_podcast.get(pid, []),
                )
            )

        snapshot = datetime.now(timezone.utc).isoformat()
        written: dict[str, int] = {}
        for spec in CHART_SPECS:
            chart_id = self.chart_ids[spec["slug"]]
            eligible = [
                (pid, score, cover)
                for pid, score, cover, genres in scored
                if chart_eligible(genres, spec["genre_slug"])
            ]
            ranked = dense_ranks(eligible)
            self._replace_chart_entries(chart_id, ranked, snapshot)
            written[spec["slug"]] = len(ranked)
            log.info("chart %s: %s entries", spec["slug"], len(ranked))
        return written

    def _replace_chart_entries(
        self,
        chart_id: str,
        ranked: list[tuple[str, int, float]],
        snapshot: str,
    ) -> None:
        assert self.client is not None
        try:
            self.client.table("chart_entries").delete().eq("chart_id", chart_id).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("chart_entries delete failed: %s", exc)

        if not ranked:
            return
        rows = []
        for podcast_id, rank, score in ranked:
            rows.append(
                self._allowed(
                    "chart_entries",
                    {
                        "chart_id": chart_id,
                        "podcast_id": podcast_id,
                        "rank": rank,
                        "score": round(score, 4),
                        "snapshot_at": snapshot,
                    },
                )
            )
        # Insert in chunks to stay friendly to free-tier PostgREST.
        for start in range(0, len(rows), 50):
            chunk = rows[start : start + 50]
            self.client.table("chart_entries").insert(chunk).execute()


def _date_str(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _dt_str(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value)
    try:
        if len(text) == 10:
            return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
