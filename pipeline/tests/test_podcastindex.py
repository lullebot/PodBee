from __future__ import annotations

import hashlib
import unittest

from pipeline.podcastindex import (
    TRENDING_QUERIES,
    auth_headers,
    merge_feed_urls,
)


class PodcastIndexHelperTests(unittest.TestCase):
    def test_auth_headers_are_sha1_of_key_secret_timestamp(self) -> None:
        headers = auth_headers("key", "secret", now=1_700_000_000)
        expected = hashlib.sha1(b"keysecret1700000000").hexdigest()
        self.assertEqual(headers["X-Auth-Key"], "key")
        self.assertEqual(headers["X-Auth-Date"], "1700000000")
        self.assertEqual(headers["Authorization"], expected)
        self.assertIn("PodBee", headers["User-Agent"])

    def test_trending_is_four_small_targeted_queries(self) -> None:
        slugs = [row[0] for row in TRENDING_QUERIES]
        self.assertEqual(
            slugs, ["top-overall", "top-comedy", "top-true-crime", "top-news"]
        )
        self.assertIsNone(TRENDING_QUERIES[0][1])
        self.assertEqual(TRENDING_QUERIES[1][1], "Comedy")

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
