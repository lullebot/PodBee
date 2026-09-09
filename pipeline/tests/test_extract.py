from __future__ import annotations

import unittest
from datetime import datetime, timezone

from pipeline.extract import (
    chart_eligible,
    credits_from_author,
    dense_ranks,
    episode_guest_from_title,
    episode_slug,
    extract_credits_from_text,
    looks_like_org,
    looks_like_person,
    map_credit_role,
    map_itunes_genre,
    parse_duration,
    parse_explicit,
    podcast_status,
    score_podcast,
    slugify,
    sort_name,
    split_people,
    strip_html,
)


class SlugTests(unittest.TestCase):
    def test_slug_from_display_name(self) -> None:
        self.assertEqual(slugify("Ira Glass"), "ira-glass")
        self.assertEqual(slugify("Conan O’Brien"), "conan-obrien")
        self.assertEqual(slugify("Wait Wait... Don't Tell Me!"), "wait-wait-dont-tell-me")
        self.assertEqual(sort_name("Ira Glass"), "Glass, Ira")

    def test_episode_slug_uses_number(self) -> None:
        self.assertTrue(episode_slug("Middle School", 449, None).startswith("449-"))


class GenreTests(unittest.TestCase):
    def test_itunes_categories(self) -> None:
        self.assertEqual(map_itunes_genre("True Crime"), "true-crime")
        self.assertEqual(map_itunes_genre("News &amp; Politics"), "news")
        self.assertEqual(map_itunes_genre("Comedy"), "comedy")
        self.assertTrue(chart_eligible(["comedy", "news"], "comedy"))
        self.assertFalse(chart_eligible(["science"], "news"))
        self.assertTrue(chart_eligible(["science"], None))


class CreditTests(unittest.TestCase):
    def test_skip_org_authors(self) -> None:
        self.assertTrue(looks_like_org("The New York Times"))
        self.assertTrue(looks_like_org("Audiochuck"))
        self.assertTrue(looks_like_org("NPR"))
        self.assertTrue(looks_like_org("WBEZ Chicago"))
        self.assertTrue(looks_like_org("Hidden Brain Media"))
        self.assertTrue(looks_like_org("Casefile Presents"))
        self.assertFalse(looks_like_person("Team Coco & Earwolf"))
        self.assertEqual(split_people("The New York Times"), [])
        self.assertEqual(credits_from_author("NPR", role="host", source="t"), [])

    def test_split_two_hosts(self) -> None:
        names = split_people("Karen Kilgariff and Georgia Hardstark")
        self.assertEqual(names, ["Karen Kilgariff", "Georgia Hardstark"])

    def test_show_notes_hosts(self) -> None:
        wait_wait = extract_credits_from_text(
            "NPR's weekly news quiz hosted by Peter Sagal. Have a laugh.",
            source="desc",
        )
        self.assertEqual(wait_wait[0].display_name, "Peter Sagal")
        self.assertEqual(wait_wait[0].role_id, "host")

        crime_junkie = extract_credits_from_text(
            "Every Monday, join your host Ashley Flowers as she unravels cases "
            "with her best friend Brit Prawat.",
            source="desc",
        )
        roles = {c.display_name: c.role_id for c in crime_junkie}
        self.assertEqual(roles["Ashley Flowers"], "host")
        self.assertEqual(roles["Brit Prawat"], "co_host")

    def test_episode_title_guest(self) -> None:
        hints = episode_guest_from_title(
            "Matt Groening",
            "Matt sits down with Conan to discuss The Simpsons.",
        )
        self.assertEqual(hints[0].display_name, "Matt Groening")
        self.assertEqual(hints[0].role_id, "guest")

    def test_role_aliases(self) -> None:
        self.assertEqual(map_credit_role("co-host"), "co_host")
        self.assertEqual(map_credit_role("executive producer"), "executive_producer")


class ParseHelpersTests(unittest.TestCase):
    def test_duration_and_html(self) -> None:
        self.assertEqual(parse_duration("1:02:03"), 3723)
        self.assertEqual(parse_duration("12:05"), 725)
        self.assertEqual(parse_duration("90"), 90)
        self.assertTrue(parse_explicit("yes"))
        self.assertFalse(parse_explicit("false"))
        self.assertEqual(strip_html("<p>Hello&nbsp;<b>world</b></p>"), "Hello world")

    def test_status(self) -> None:
        now = datetime(2026, 9, 9, tzinfo=timezone.utc)
        fresh = datetime(2026, 9, 1, tzinfo=timezone.utc)
        stale = datetime(2025, 1, 1, tzinfo=timezone.utc)
        self.assertEqual(podcast_status(complete=True, latest=fresh, now=now), "completed")
        self.assertEqual(podcast_status(complete=False, latest=fresh, now=now), "active")
        self.assertEqual(podcast_status(complete=False, latest=stale, now=now), "hiatus")


class ChartScoreTests(unittest.TestCase):
    def test_rating_beats_heuristic(self) -> None:
        rated = score_podcast(
            rating_average=8.4,
            rating_count=1200,
            latest_published_at=None,
            episode_count=1,
            has_cover=False,
        )
        heuristic = score_podcast(
            rating_average=None,
            rating_count=None,
            latest_published_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
            episode_count=40,
            has_cover=True,
            now=datetime(2026, 9, 9, tzinfo=timezone.utc),
        )
        self.assertGreater(rated, 80)
        self.assertGreater(heuristic, 10)

    def test_dense_ranks(self) -> None:
        ranks = dense_ranks(
            [
                ("b", 10.0, True),
                ("a", 20.0, False),
                ("c", 20.0, True),
            ]
        )
        self.assertEqual([r[1] for r in ranks], [1, 2, 3])
        self.assertEqual(ranks[0][0], "c")  # tie on score, cover first


if __name__ == "__main__":
    unittest.main()
