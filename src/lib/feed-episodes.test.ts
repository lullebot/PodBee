import assert from "node:assert/strict";
import {
  DbEpisodeMatcher,
  feedEpisodeKey,
  feedEpisodePayload,
  feedEpisodeSlug,
  mergeShowEpisodes,
  packFeedEpisodes,
  parseFeedEpisodeDescription,
  parseFeedEpisodes,
  parseFeedEpisodeSlug,
  parseItunesDuration,
  unpackFeedEpisodes,
  type DbEpisode,
} from "./feed-episodes";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>The Joe Rogan Experience</title>
  <itunes:image href="https://img.example.com/jre.jpg"/>
  <description><![CDATA[<p>The official podcast</p>]]></description>
  <item>
    <title>#1 - Brian Redban</title>
    <guid isPermaLink="false">jre-0001</guid>
    <pubDate>Tue, 24 Dec 2009 20:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/1.mp3" length="1" type="audio/mpeg"/>
    <itunes:duration>1:02:03</itunes:duration>
    <itunes:episode>1</itunes:episode>
    <description>First &amp; oldest</description>
  </item>
  <item>
    <title><![CDATA[#2000 - Guest & "Friend"]]></title>
    <guid>jre-2000</guid>
    <pubDate>Wed, 02 Aug 2023 17:00:00 -0000</pubDate>
    <enclosure url="https://cdn.example.com/2000.mp3" length="1" type="audio/mpeg"/>
    <itunes:duration>9000</itunes:duration>
    <itunes:episode>2000</itunes:episode>
    <itunes:season>3</itunes:season>
    <itunes:episodeType>bonus</itunes:episodeType>
    <itunes:explicit>yes</itunes:explicit>
    <itunes:image href="https://img.example.com/2000.jpg"/>
    <content:encoded><![CDATA[<p>Big <b>episode</b></p><p>Links &amp; notes</p>]]></content:encoded>
    <description>short</description>
  </item>
  <item>
    <title>No guid episode</title>
    <pubDate>Mon, 01 Jan 2018 00:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/noguid.mp3" length="1" type="audio/mpeg"/>
    <itunes:duration>45:30</itunes:duration>
    <itunes:image href="https://img.example.com/jre.jpg"/>
    <description>Unescaped <b>html</b> & stuff</description>
  </item>
  <item>
    <title>#2000 - Guest &amp; "Friend"</title>
    <guid>jre-2000</guid>
    <pubDate>Wed, 02 Aug 2023 17:00:00 -0000</pubDate>
  </item>
  <item><title>   </title><guid>blank</guid></item>
</channel>
</rss>`;

// --- parsing ---------------------------------------------------------------

const eps = parseFeedEpisodes(RSS);
assert.equal(eps.length, 3); // duplicate guid + blank title dropped
assert.deepEqual(
  eps.map((e) => e.title),
  ['#2000 - Guest & "Friend"', "No guid episode", "#1 - Brian Redban"] // newest first
);
const [newest, noGuid, oldest] = eps;
assert.equal(newest.key, feedEpisodeKey("jre-2000", null, "", null));
assert.equal(newest.published_at, "2023-08-02T17:00:00.000Z");
assert.equal(newest.duration_seconds, 9000);
assert.equal(newest.episode_number, 2000);
assert.equal(newest.season_number, 3);
assert.equal(newest.episode_type, "bonus");
assert.equal(newest.explicit, true);
assert.equal(newest.audio_url, "https://cdn.example.com/2000.mp3");
assert.equal(newest.cover_image_url, "https://img.example.com/2000.jpg");
assert.equal(noGuid.key, feedEpisodeKey(null, "https://cdn.example.com/noguid.mp3", "", null));
assert.equal(noGuid.duration_seconds, 45 * 60 + 30);
assert.equal(noGuid.cover_image_url, null); // same as channel art
assert.equal(oldest.duration_seconds, 3723);
assert.equal(oldest.explicit, false);
assert.equal(oldest.episode_type, "full");
assert.throws(() => parseFeedEpisodes("<html><body>nope</body></html>"), /not an RSS feed/);

assert.equal(parseFeedEpisodeDescription(RSS, newest.key), "Big episode\n\nLinks & notes");
assert.equal(parseFeedEpisodeDescription(RSS, oldest.key), "First & oldest");
assert.equal(parseFeedEpisodeDescription(RSS, "000000000000"), null);

assert.equal(parseItunesDuration("1:02:03"), 3723);
assert.equal(parseItunesDuration("62:03"), 3723);
assert.equal(parseItunesDuration("3723.4"), 3723);
assert.equal(parseItunesDuration("0"), null);
assert.equal(parseItunesDuration("abc"), null);
assert.equal(parseItunesDuration(null), null);

// --- keys + slugs -----------------------------------------------------------

assert.match(newest.key, /^[0-9a-f]{12}$/);
assert.equal(feedEpisodeSlug("0123456789ab", "#1 - Brian Redban"), "e-0123456789ab-1-brian-redban");
assert.equal(feedEpisodeSlug("0123456789ab", "!!!"), "e-0123456789ab");
assert.equal(parseFeedEpisodeSlug("e-0123456789ab-1-brian-redban"), "0123456789ab");
assert.equal(parseFeedEpisodeSlug("e-0123456789ab"), "0123456789ab");
assert.equal(parseFeedEpisodeSlug("e-coli-outbreak-explained"), null); // pipeline title slug
assert.equal(parseFeedEpisodeSlug("ep-1-the-alibi"), null);
assert.equal(parseFeedEpisodeSlug("e-0123456789AB"), null);

// --- cache packing round-trips ------------------------------------------------

assert.deepEqual(unpackFeedEpisodes(JSON.parse(JSON.stringify(packFeedEpisodes(eps)))), eps);

// --- merge with database rows -------------------------------------------------

const show = {
  podcast_id: "pod-1",
  slug: "the-joe-rogan-experience",
  title: "The Joe Rogan Experience",
  cover_image_url: "https://img.example.com/jre.jpg",
};
function db(partial: Partial<DbEpisode> & Pick<DbEpisode, "id" | "slug" | "title">): DbEpisode {
  return {
    published_at: null,
    duration_seconds: null,
    episode_number: null,
    season_number: null,
    episode_type: "full",
    cover_image_url: null,
    audio_url: null,
    feed_item_key: null,
    avg_rating: null,
    rating_count: 0,
    ...partial,
  };
}
const dbRows: DbEpisode[] = [
  // Pipeline row for the newest episode (matched by enclosure URL) — keeps its catalog slug.
  db({ id: "row-2000", slug: "2000-guest-friend", title: "#2000 - Guest & Friend", audio_url: "https://cdn.example.com/2000.mp3", avg_rating: 9.2, rating_count: 5 }),
  // Rated feed episode (matched by feed key).
  db({ id: "row-1", slug: feedEpisodeSlug(oldest.key, oldest.title), title: oldest.title, feed_item_key: oldest.key, avg_rating: 7, rating_count: 2 }),
  // Episode no longer in the feed — still listed.
  db({ id: "row-gone", slug: "removed-episode", title: "Removed episode", published_at: "2015-06-01T00:00:00.000Z", avg_rating: 8, rating_count: 1 }),
];
const cards = mergeShowEpisodes(show, eps, dbRows);
assert.equal(cards.length, 4);
const byTitle = new Map(cards.map((c) => [c.id, c]));
assert.equal(byTitle.get("row-2000")!.episode_slug, "2000-guest-friend");
assert.equal(byTitle.get("row-2000")!.avg_rating, 9.2);
assert.equal(byTitle.get("row-2000")!.episode_cover_url, "https://img.example.com/2000.jpg");
assert.equal(byTitle.get("row-1")!.rating_count, 2);
assert.equal(byTitle.get(`feed-${noGuid.key}`)!.episode_slug, feedEpisodeSlug(noGuid.key, noGuid.title));
assert.equal(byTitle.get(`feed-${noGuid.key}`)!.avg_rating, null);
assert.equal(byTitle.get("row-gone")!.avg_rating, 8);
assert.equal(mergeShowEpisodes(show, [], dbRows).length, 3); // feed down → database rows only

// Robust matching: hosts change `?updated=` on enclosures; titles/dates are the last resort.
{
  const feed = parseFeedEpisodes(`<rss><channel>
    <item><title>Ep A</title><guid>a</guid><pubDate>Mon, 01 Sep 2025 10:00:00 GMT</pubDate>
      <enclosure url="https://traffic.megaphone.fm/A.mp3?updated=200"/></item>
    <item><title>Ep B: The "Sequel"</title><guid>b</guid><pubDate>Sun, 31 Aug 2025 10:00:00 GMT</pubDate>
      <enclosure url="https://new-host.example.com/b.mp3"/></item>
    <item><title>Ep C</title><guid>c</guid><pubDate>Sat, 30 Aug 2025 10:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/c.mp3"/></item>
  </channel></rss>`);
  const [a, b, c] = feed;
  const rows = [
    db({ id: "pipe-a", slug: "ep-a", title: "Ep A", audio_url: "https://traffic.megaphone.fm/A.mp3?updated=100" }),
    db({ id: "pipe-b", slug: "ep-b-the-sequel", title: "Ep B — The Sequel", published_at: "2025-08-31T09:00:00.000Z", audio_url: "https://old-host.example.com/b.mp3" }),
    // keyed to a different feed item: must not be handed to C even though the audio matches
    db({ id: "other", slug: "e-ffffffffffff-x", title: "X", audio_url: "https://cdn.example.com/c.mp3", feed_item_key: "ffffffffffff" }),
  ];
  const m = new DbEpisodeMatcher(rows);
  assert.equal(m.match(a)?.id, "pipe-a"); // same audio without ?updated=
  assert.equal(m.match(b)?.id, "pipe-b"); // same title + same day
  assert.equal(m.match(c), undefined);
  assert.deepEqual(m.unmatched().map((r) => r.id), ["other"]);
  assert.equal(mergeShowEpisodes(show, feed, rows).length, 4); // no duplicates of A or B
}

// --- signed payload -------------------------------------------------------------

const payload = feedEpisodePayload(noGuid, show.cover_image_url);
assert.equal(payload.key, noGuid.key);
assert.equal(payload.slug, feedEpisodeSlug(noGuid.key, noGuid.title));
assert.equal(payload.audio_url, "https://cdn.example.com/noguid.mp3");
assert.equal(payload.cover_image_url, show.cover_image_url);

// --- a Joe Rogan-sized feed: every episode, fast, and cacheable (< 2 MB) --------

const items = Array.from({ length: 2500 }, (_, i) => {
  const n = i + 1;
  const date = new Date(Date.UTC(2010, 0, 1) + i * 86400000 * 2).toUTCString();
  return `<item><title>#${n} - Guest Number ${n} With A Reasonably Long Name</title><guid isPermaLink="false">jre-gen-${n}</guid><pubDate>${date}</pubDate><enclosure url="https://traffic.megaphone.fm/GLT${1000000000 + n}.mp3?updated=1690000000" length="1" type="audio/mpeg"/><itunes:duration>${2 + (n % 2)}:3${n % 10}:00</itunes:duration><itunes:episode>${n}</itunes:episode><description><![CDATA[<p>${"Show notes. ".repeat(80)}</p>]]></description></item>`;
}).join("");
const big = RSS.replace("<item>", `${items}<item>`);
const started = performance.now();
const all = parseFeedEpisodes(big);
const elapsed = performance.now() - started;
assert.equal(all.length, 2503);
assert.equal(all.at(-1)!.title, "#1 - Brian Redban");
const packedBytes = JSON.stringify(packFeedEpisodes(all)).length;
assert.ok(packedBytes < 2 * 1024 * 1024, `packed ${packedBytes} bytes`);
assert.ok(elapsed < 5000, `parse took ${elapsed} ms`);
console.log(
  `feed-episodes ok (2,503 episodes: ${(big.length / 1e6).toFixed(1)} MB XML → ${(packedBytes / 1e3).toFixed(0)} KB cached, ${elapsed.toFixed(0)} ms)`
);
