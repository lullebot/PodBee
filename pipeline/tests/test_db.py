from __future__ import annotations

import unittest
from datetime import date

from pipeline.db import CatalogWriter, resolve_unseasoned_episode_number
from pipeline.extract import CREDIT_ROLE_IDS, CreditHint, ParsedEpisode, ParsedPodcast


UNIQUE_NO_SEASON = (
    'duplicate key value violates unique constraint '
    '"episodes_podcast_number_no_season_uidx"'
)


def _episode(
    slug: str,
    number: int | None,
    *,
    season: int | None = None,
    title: str | None = None,
    credits: list[CreditHint] | None = None,
) -> ParsedEpisode:
    return ParsedEpisode(
        title=title or slug,
        slug=slug,
        subtitle=None,
        description=None,
        episode_number=number,
        season_number=season,
        episode_type="full",
        duration_seconds=60,
        explicit=False,
        published_at=None,
        audio_url=None,
        cover_image_url=None,
        guid=slug,
        credits=credits or [],
    )


def _podcast(
    episodes: list[ParsedEpisode],
    *,
    slug: str = "radiolab",
    credits: list[CreditHint] | None = None,
) -> ParsedPodcast:
    return ParsedPodcast(
        title="Radiolab",
        slug=slug,
        subtitle=None,
        description=None,
        language="en",
        explicit=False,
        status="active",
        cover_image_url=None,
        website_url=None,
        rss_url="https://example.com/radiolab.xml",
        published_at=date(2026, 1, 1),
        genres=[],
        credits=credits or [],
        episodes=episodes,
    )


class MemoryCatalogWriter(CatalogWriter):
    """In-memory writer that enforces episodes_podcast_number_no_season_uidx."""

    def __init__(self) -> None:
        self.url = "http://example.invalid"
        self.dry_run = False
        self.client = None
        self._key = ""
        self.columns = {}
        self.role_ids = set(CREDIT_ROLE_IDS)
        self.people_ids = {}
        self.genre_ids = {}
        self.chart_ids = {}
        self.rows: dict[str, list[dict]] = {}

    def _existing_unseasoned_numbers(self, podcast_id: str) -> dict[int, str]:
        out: dict[int, str] = {}
        for row in self.rows.get("episodes", []):
            if row.get("podcast_id") == podcast_id and row.get("season_id") is None:
                number = row.get("episode_number")
                slug = row.get("slug")
                if number is not None and slug:
                    out[number] = slug
        return out

    def _select_people_by_slug(self, slugs: list[str]) -> list[dict]:
        return [row for row in self.rows.get("people", []) if row.get("slug") in slugs]

    def upsert_many(self, table: str, rows: list[dict], *, on_conflict: str, chunk_size: int = 200) -> list[dict]:
        conflict_keys = on_conflict.split(",")
        return [
            self.upsert_by(
                table,
                {key: row[key] for key in conflict_keys},
                {key: value for key, value in row.items() if key not in conflict_keys},
            )
            for row in rows
        ]

    def upsert_by(self, table: str, match: dict, payload: dict) -> dict:
        row = {**match, **payload}
        if table == "episodes":
            number = row.get("episode_number")
            if number is not None and row.get("season_id") is None:
                for existing in self.rows.get("episodes", []):
                    if (
                        existing.get("podcast_id") == row.get("podcast_id")
                        and existing.get("episode_number") == number
                        and existing.get("season_id") is None
                        and existing.get("slug") != row.get("slug")
                    ):
                        raise RuntimeError(UNIQUE_NO_SEASON)
        store = self.rows.setdefault(table, [])
        for index, existing in enumerate(store):
            if all(existing.get(key) == value for key, value in match.items()):
                merged = {**existing, **row}
                store[index] = merged
                return merged
        created = {"id": f"{table}-{len(store) + 1}", **row}
        store.append(created)
        return created


class ResolveEpisodeNumberTests(unittest.TestCase):
    def test_nulls_when_another_unseasoned_slug_owns_the_number(self) -> None:
        self.assertIsNone(
            resolve_unseasoned_episode_number(669, None, "669-older-title")
        )

    def test_keeps_number_when_no_conflict(self) -> None:
        self.assertEqual(resolve_unseasoned_episode_number(669, None, None), 669)

    def test_keeps_number_when_seasoned(self) -> None:
        self.assertEqual(
            resolve_unseasoned_episode_number(669, "season-1", "669-other"),
            669,
        )

    def test_keeps_missing_number(self) -> None:
        self.assertIsNone(resolve_unseasoned_episode_number(None, None, "other"))


class EpisodeNumberCollisionTests(unittest.TestCase):
    def test_two_unseasoned_episodes_same_number_different_slugs(self) -> None:
        writer = MemoryCatalogWriter()
        stats = writer.upsert_podcast(
            _podcast(
                [
                    _episode("669-first-title", 669, title="First title"),
                    _episode("669-second-title", 669, title="Second title"),
                ]
            )
        )
        self.assertEqual(stats["episodes"], 2)
        episodes = writer.rows["episodes"]
        self.assertEqual(len(episodes), 2)
        by_slug = {row["slug"]: row for row in episodes}
        self.assertEqual(by_slug["669-first-title"]["episode_number"], 669)
        self.assertIsNone(by_slug["669-second-title"]["episode_number"])

    def test_incoming_slug_does_not_collide_with_existing_row(self) -> None:
        writer = MemoryCatalogWriter()
        writer.upsert_podcast(_podcast([_episode("669-older-title", 669)]))
        writer.upsert_podcast(_podcast([_episode("669-newer-title", 669)]))
        by_slug = {row["slug"]: row for row in writer.rows["episodes"]}
        self.assertEqual(set(by_slug), {"669-older-title", "669-newer-title"})
        self.assertEqual(by_slug["669-older-title"]["episode_number"], 669)
        self.assertIsNone(by_slug["669-newer-title"]["episode_number"])

    def test_same_slug_keeps_episode_number_on_reupsert(self) -> None:
        writer = MemoryCatalogWriter()
        writer.upsert_podcast(_podcast([_episode("669-same-title", 669)]))
        writer.upsert_podcast(_podcast([_episode("669-same-title", 669)]))
        episodes = writer.rows["episodes"]
        self.assertEqual(len(episodes), 1)
        self.assertEqual(episodes[0]["episode_number"], 669)

    def test_same_number_allowed_when_seasons_differ(self) -> None:
        writer = MemoryCatalogWriter()
        writer.upsert_podcast(
            _podcast(
                [
                    _episode("s1-e1", 1, season=1),
                    _episode("s2-e1", 1, season=2),
                ]
            )
        )
        episodes = writer.rows["episodes"]
        self.assertEqual([row["episode_number"] for row in episodes], [1, 1])
        self.assertEqual(len(writer.rows["seasons"]), 2)


class CreditWritingTests(unittest.TestCase):
    """The batched episode/episode_credits/people path added to cut round trips."""

    def test_writes_one_credit_per_episode(self) -> None:
        writer = MemoryCatalogWriter()
        stats = writer.upsert_podcast(
            _podcast(
                [
                    _episode(
                        "ep-1", 1,
                        credits=[CreditHint("Theo Von", "guest", "title")],
                    ),
                    _episode(
                        "ep-2", 2,
                        credits=[CreditHint("Joe Rogan", "host", "author")],
                    ),
                ]
            )
        )
        self.assertEqual(stats["episode_credits"], 2)
        people = {row["slug"]: row for row in writer.rows["people"]}
        self.assertEqual(set(people), {"theo-von", "joe-rogan"})
        credits = writer.rows["episode_credits"]
        self.assertEqual(len(credits), 2)
        by_role = {row["role_id"]: row for row in credits}
        self.assertEqual(by_role["guest"]["person_id"], people["theo-von"]["id"])
        self.assertEqual(by_role["host"]["person_id"], people["joe-rogan"]["id"])

    def test_same_guest_across_episodes_reuses_one_person_row(self) -> None:
        writer = MemoryCatalogWriter()
        writer.upsert_podcast(
            _podcast(
                [
                    _episode(
                        "ep-1", 1,
                        credits=[CreditHint("Theo Von", "guest", "title")],
                    ),
                    _episode(
                        "ep-2", 2,
                        credits=[CreditHint("Theo Von", "guest", "title")],
                    ),
                ]
            )
        )
        self.assertEqual(len(writer.rows["people"]), 1)
        self.assertEqual(len(writer.rows["episode_credits"]), 2)

    def test_reupsert_does_not_duplicate_credits(self) -> None:
        writer = MemoryCatalogWriter()
        podcast = _podcast(
            [_episode("ep-1", 1, credits=[CreditHint("Theo Von", "guest", "title")])]
        )
        writer.upsert_podcast(podcast)
        writer.upsert_podcast(podcast)
        self.assertEqual(len(writer.rows["people"]), 1)
        self.assertEqual(len(writer.rows["episode_credits"]), 1)

    def test_unknown_role_is_skipped(self) -> None:
        writer = MemoryCatalogWriter()
        stats = writer.upsert_podcast(
            _podcast(
                [
                    _episode(
                        "ep-1", 1,
                        credits=[CreditHint("Mystery Role", "narrator", "guess")],
                    )
                ]
            )
        )
        self.assertEqual(stats["episode_credits"], 0)
        self.assertNotIn("people", writer.rows)

    def test_show_level_credits_batch_too(self) -> None:
        writer = MemoryCatalogWriter()
        stats = writer.upsert_podcast(
            _podcast(
                [_episode("ep-1", 1)],
                credits=[CreditHint("Radiolab Team", "producer", "author")],
            )
        )
        self.assertEqual(stats["show_credits"], 1)
        self.assertEqual(len(writer.rows["podcast_credits"]), 1)


if __name__ == "__main__":
    unittest.main()
