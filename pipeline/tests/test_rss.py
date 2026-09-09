from __future__ import annotations

import unittest
from pathlib import Path

from pipeline.rss import load_feed_urls, parse_feed

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Fixture Hour</title>
    <link>https://example.com/fixture</link>
    <language>en-us</language>
    <itunes:author>Ada Lovelace and Alan Turing</itunes:author>
    <itunes:explicit>false</itunes:explicit>
    <itunes:image href="https://example.com/cover.jpg"/>
    <itunes:category text="Comedy"/>
    <itunes:category text="News"/>
    <description>A weekly show hosted by Ada Lovelace. Produced by Grace Hopper.</description>
    <item>
      <title>Guest Night with Grace Hopper</title>
      <guid>https://example.com/ep/1</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <itunes:episode>12</itunes:episode>
      <itunes:season>2</itunes:season>
      <itunes:duration>01:02:03</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <description>Guest: Alonzo Church sits down with the hosts.</description>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1"/>
    </item>
  </channel>
</rss>
"""


class RssParseTests(unittest.TestCase):
    def test_parse_sample_feed(self) -> None:
        podcast = parse_feed(
            SAMPLE_RSS.encode("utf-8"),
            source_url="https://example.com/rss.xml",
            max_episodes=10,
        )
        self.assertEqual(podcast.title, "Fixture Hour")
        self.assertEqual(podcast.slug, "fixture-hour")
        self.assertEqual(podcast.cover_image_url, "https://example.com/cover.jpg")
        self.assertEqual(podcast.genres, ["comedy", "news"])
        host_names = {c.display_name: c.role_id for c in podcast.credits}
        self.assertEqual(host_names["Ada Lovelace"], "host")
        self.assertEqual(host_names["Alan Turing"], "host")
        self.assertEqual(host_names["Grace Hopper"], "producer")
        self.assertEqual(len(podcast.episodes), 1)
        episode = podcast.episodes[0]
        self.assertEqual(episode.episode_number, 12)
        self.assertEqual(episode.season_number, 2)
        self.assertEqual(episode.duration_seconds, 3723)
        self.assertEqual(episode.episode_type, "full")
        guest_names = [c.display_name for c in episode.credits if c.role_id == "guest"]
        self.assertIn("Alonzo Church", guest_names)

    def test_feeds_txt_has_public_urls(self) -> None:
        path = Path(__file__).resolve().parents[1] / "feeds.txt"
        urls = load_feed_urls(str(path))
        self.assertGreaterEqual(len(urls), 20)
        self.assertLessEqual(len(urls), 40)
        self.assertTrue(all(u.startswith("http") for u in urls))
        self.assertEqual(len(urls), len(set(urls)))


if __name__ == "__main__":
    unittest.main()
