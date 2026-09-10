from __future__ import annotations

import hashlib
import unittest
from unittest.mock import patch

from pipeline.podcastindex import (
    API_BASE,
    MAX_PAGE_SIZE,
    REQUEST_GAP_SECONDS,
    TRENDING_QUERIES,
    auth_headers,
    merge_feed_urls,
    trending_feed_urls,
)


class PodcastIndexHelperTests(unittest.TestCase):
    def test_auth_headers_are_sha1_of_key_secret_timestamp(self) -> None:
        headers = auth_headers("key", "secret", now=1_700_000_000)
        expected = hashlib.sha1(b"keysecret1700000000").hexdigest()
        self.assertEqual(headers["X-Auth-Date"], "1700000000")
        self.assertEqual(headers["X-Auth-Key"], "key")
        self.assertEqual(headers["Authorization"], expected)
        self.assertIn("PodBee", headers["User-Agent"])

    def test_trending_queries_cover_home_plus_sprint3_categories(self) -> None:
        self.assertLessEqual(MAX_PAGE_SIZE, 25)
        self.assertGreater(REQUEST_GAP_SECONDS, 0)
        slugs = [row[0] for row in TRENDING_QUERIES]
        cats = [row[1] for row in TRENDING_QUERIES]
        self.assertEqual(
            slugs[:4],
            ["top-overall", "top-comedy", "top-true-crime", "top-news"],
        )
        self.assertIsNone(TRENDING_QUERIES[0][1])
        self.assertEqual(len(slugs), len(set(slugs)))
        self.assertGreater(len(TRENDING_QUERIES), 4)
        for extra in (
            "Society & Culture",
            "Technology",
            "Sports",
            "Business",
            "History",
            "Health & Fitness",
            "Science",
            "Arts",
            "Music",
            "Education",
            "Fiction",
            "Leisure",
            "Kids & Family",
            "TV & Film",
            "Government",
            "Religion & Spirituality",
        ):
            self.assertIn(extra, cats)

    def test_trending_requests_are_small_rate_limited_and_uncrawled(self) -> None:
        captured: list[dict[str, object]] = []

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {"feeds": [{"url": "https://example.com/feed.xml"}]}

        class FakeClient:
            def __init__(self, *args: object, **kwargs: object) -> None:
                pass

            def __enter__(self) -> FakeClient:
                return self

            def __exit__(self, *args: object) -> bool:
                return False

            def get(
                self,
                url: str,
                params: dict[str, object] | None = None,
                headers: dict[str, str] | None = None,
            ) -> FakeResponse:
                captured.append({"url": url, "params": dict(params or {})})
                return FakeResponse()

        with (
            patch("pipeline.podcastindex.httpx.Client", FakeClient),
            patch("pipeline.podcastindex.time.sleep") as sleep,
        ):
            urls = trending_feed_urls("key", "secret", max_per_chart=99)

        self.assertEqual(urls, ["https://example.com/feed.xml"])
        self.assertEqual(len(captured), len(TRENDING_QUERIES))
        self.assertEqual(sleep.call_count, len(TRENDING_QUERIES) - 1)
        for call, (_slug, category) in zip(captured, TRENDING_QUERIES, strict=True):
            self.assertEqual(call["url"], f"{API_BASE}/podcasts/trending")
            params = call["params"]
            assert isinstance(params, dict)
            self.assertEqual(params["max"], MAX_PAGE_SIZE)
            self.assertEqual(params["lang"], "en")
            self.assertNotIn("page", params)
            self.assertNotIn("offset", params)
            self.assertNotIn("start", params)
            self.assertNotIn("since", params)
            if category is None:
                self.assertNotIn("cat", params)
            else:
                self.assertEqual(params["cat"], category)

    def test_merge_keeps_starter_list_first(self) -> None:
        merged = merge_feed_urls(
            ["https://a.example/rss", "https://b.example/rss"],
            ["https://b.example/rss", "https://c.example/rss"],
        )
        self.assertEqual(
            merged,
            [
                "https://a.example/rss",
                "https://b.example/rss",
                "https://c.example/rss",
            ],
        )


if __name__ == "__main__":
    unittest.main()
