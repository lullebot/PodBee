import assert from "node:assert/strict";
import type { PodcastSearchHit } from "./search-hits";
import {
  feedUrlVariants,
  htmlToText,
  indexEpisodeCards,
  indexEpisodeSlug,
  indexPodcastSlug,
  isPiFeed,
  LONG_TAIL_PAYLOAD_TTL_SECONDS,
  longTailEpisodePayload,
  longTailShowPayload,
  mergePodcastHits,
  normalizeFeedUrl,
  parseIndexEpisodeSlug,
  parseIndexPodcastSlug,
  podcastIndexAuthHeaders,
  signLongTailPayload,
  slugifyTitle,
  toIndexEpisode,
  toIndexEpisodeSummary,
  toIndexPodcast,
  toPodcastSearchHit,
  type PiFeed,
} from "./podcast-index";

// --- slugs ---------------------------------------------------------------

assert.equal(slugifyTitle("Dan Carlin's Hardcore History"), "dan-carlin-s-hardcore-history");
assert.equal(slugifyTitle("Café & Crème"), "cafe-and-creme");
assert.equal(slugifyTitle("  !!!  "), "");
assert.ok(slugifyTitle("word ".repeat(40)).length <= 60);
assert.ok(!slugifyTitle("word ".repeat(40)).endsWith("-"));

assert.equal(indexPodcastSlug(920666, "Hardcore History"), "pi-920666-hardcore-history");
assert.equal(indexPodcastSlug(920666, "???"), "pi-920666");
assert.equal(parseIndexPodcastSlug("pi-920666-hardcore-history"), 920666);
assert.equal(parseIndexPodcastSlug("pi-920666"), 920666);
// Catalog slugs and junk never parse as long-tail ids.
assert.equal(parseIndexPodcastSlug("serial"), null);
assert.equal(parseIndexPodcastSlug("pi"), null);
assert.equal(parseIndexPodcastSlug("pi-"), null);
assert.equal(parseIndexPodcastSlug("pi-abc"), null);
assert.equal(parseIndexPodcastSlug("pi-0"), null);
assert.equal(parseIndexPodcastSlug("pi-12-Upper"), null);
assert.equal(parseIndexPodcastSlug("this-american-life"), null);

assert.equal(indexEpisodeSlug(16795090, "The Destroyer of Worlds"), "16795090-the-destroyer-of-worlds");
assert.equal(parseIndexEpisodeSlug("16795090-the-destroyer-of-worlds"), 16795090);
assert.equal(parseIndexEpisodeSlug("16795090"), 16795090);
assert.equal(parseIndexEpisodeSlug("ep-1-pilot"), null);
assert.equal(parseIndexEpisodeSlug("0"), null);

// --- auth ----------------------------------------------------------------

const headers = podcastIndexAuthHeaders("KEY", "SECRET", "PodBee/test", 1700000000);
assert.equal(headers["X-Auth-Key"], "KEY");
assert.equal(headers["X-Auth-Date"], "1700000000");
assert.equal(headers.Authorization, "5f8983664e541a83aaae7f3a47f1957fbca48aec");
assert.equal(headers["User-Agent"], "PodBee/test");

// --- text + urls ---------------------------------------------------------

assert.equal(
  htmlToText("<p>Hello &amp; welcome</p><p>Line<br/>two &#8212; &#x2019;s</p>"),
  "Hello & welcome\n\nLine\ntwo — ’s"
);
assert.equal(htmlToText("<script>alert(1)</script>Safe <b>text</b>"), "Safe text");
assert.equal(htmlToText("   "), null);
assert.equal(htmlToText(null), null);
const long = htmlToText("word ".repeat(100), 50)!;
assert.ok(long.length <= 51 && long.endsWith("…"));

assert.equal(normalizeFeedUrl("https://Feeds.Example.com/show.xml/"), "feeds.example.com/show.xml");
assert.equal(normalizeFeedUrl("http://feeds.example.com/show.xml"), "feeds.example.com/show.xml");
assert.equal(normalizeFeedUrl("ftp://x"), null);
assert.equal(normalizeFeedUrl(null), null);
const variants = feedUrlVariants(["http://feeds.example.com/show"]);
assert.ok(variants.includes("https://feeds.example.com/show"));
assert.ok(variants.includes("http://feeds.example.com/show/"));
assert.deepEqual(feedUrlVariants(['https://x.com/"bad']), []);

// --- mapping -------------------------------------------------------------

assert.equal(isPiFeed([]), false); // PI answers unknown ids with `feed: []`
assert.equal(isPiFeed(null), false);
assert.equal(isPiFeed({ id: 1 }), true);

const feed: PiFeed = {
  id: 920666,
  title: "Dan Carlin&#39;s Hardcore History",
  url: "https://feeds.feedburner.com/dancarlin/history?format=xml",
  originalUrl: "https://feeds.feedburner.com/dancarlin/history?format=xml",
  link: "http://www.dancarlin.com",
  description: "<p>In &quot;Hardcore History&quot; Dan Carlin takes his idiosyncratic approach.</p>",
  author: "Dan Carlin",
  image: "https://example.com/small.jpg",
  artwork: "https://example.com/art.jpg",
  language: "en",
  explicit: false,
  dead: 0,
  episodeCount: 74,
  newestItemPubdate: 1700000000,
  categories: { "9": "Education", "10": "History", "11": "Education", "12": "Arts", "13": "Society", "14": "Culture" },
};
const podcast = toIndexPodcast(feed)!;
assert.equal(podcast.title, "Dan Carlin's Hardcore History");
assert.equal(podcast.slug, "pi-920666-dan-carlin-s-hardcore-history");
assert.equal(podcast.author, "Dan Carlin");
assert.equal(podcast.cover_image_url, "https://example.com/art.jpg");
assert.equal(podcast.description, 'In "Hardcore History" Dan Carlin takes his idiosyncratic approach.');
assert.equal(podcast.episode_count, 74);
assert.equal(podcast.latest_published_at, "2023-11-14T22:13:20.000Z");
assert.deepEqual(podcast.genres, ["Education", "History", "Arts", "Society"]);
assert.deepEqual(podcast.feed_urls, ["https://feeds.feedburner.com/dancarlin/history?format=xml"]);
assert.equal(toIndexPodcast({ id: 5, title: "  " }), null);
assert.equal(toIndexPodcast({ id: 5, title: "Same", author: "same" })!.author, null);

const summary = toIndexEpisodeSummary(
  {
    id: 42,
    title: "Show 70 – Twilight of the Aesir",
    datePublished: 1700000000,
    duration: 0,
    season: 0,
    episode: 70,
    episodeType: "bonus",
    image: "https://example.com/art.jpg",
  },
  "https://example.com/art.jpg"
)!;
assert.equal(summary.cover_image_url, null); // same as show cover → not stored
assert.equal(summary.duration_seconds, null);
assert.equal(summary.season_number, null);
assert.equal(summary.episode_number, 70);
assert.equal(summary.episode_type, "bonus");
assert.equal(toIndexEpisodeSummary({ id: 1, title: "x", episodeType: "weird" }, null)!.episode_type, "full");

const episode = toIndexEpisode({
  id: 42,
  title: "Show 70",
  feedId: 920666,
  description: "<p>Notes</p>",
  enclosureUrl: "https://cdn.example.com/70.mp3",
  explicit: 1,
  image: "",
  feedImage: "https://example.com/art.jpg",
})!;
assert.equal(episode.feed_id, 920666);
assert.equal(episode.description, "Notes");
assert.equal(episode.explicit, true);
assert.equal(episode.cover_image_url, "https://example.com/art.jpg");
assert.equal(toIndexEpisode({ id: 42, title: "No feed" }), null);

const cards = indexEpisodeCards(podcast, [summary]);
assert.equal(cards[0].podcast_slug, podcast.slug);
assert.equal(cards[0].episode_slug, "42-show-70-twilight-of-the-aesir");
assert.equal(cards[0].podcast_cover_url, "https://example.com/art.jpg");

// --- search --------------------------------------------------------------

assert.equal(toPodcastSearchHit({ ...feed, dead: 1 }), null);
assert.equal(toPodcastSearchHit({ ...feed, episodeCount: 0 }), null);
const indexHit = toPodcastSearchHit(feed)!;
assert.equal(indexHit.source, "index");
assert.equal(indexHit.id, "pi-920666");
assert.equal(indexHit.genre_name, "Education");
assert.equal(indexHit.network_name, "Dan Carlin");

function catalogHit(title: string, feedUrl: string | null, rating: number | null = null): PodcastSearchHit {
  const slug = slugifyTitle(title);
  return {
    kind: "podcast",
    id: `db-${slug}`,
    slug,
    title,
    cover_image_url: null,
    rating_average: rating,
    genre_name: null,
    episode_count: null,
    network_name: null,
    feed_urls: feedUrl ? [feedUrl] : [],
    source: "catalog",
  };
}

function longTailHit(id: number, title: string, feedUrl: string): PodcastSearchHit {
  return toPodcastSearchHit({ id, title, url: feedUrl, episodeCount: 3 })!;
}

// A long-tail copy of a catalog feed (scheme/trailing-slash differences) is dropped.
const serial = catalogHit("Serial", "https://feeds.serialpodcast.org/serial", 8.9);
const merged = mergePodcastHits(
  [serial],
  [
    longTailHit(1, "Serial", "http://feeds.serialpodcast.org/serial/"),
    longTailHit(2, "Serial Killers", "https://feeds.example.com/sk"),
  ],
  "serial",
  12
);
assert.deepEqual(merged.map((h) => h.id), [serial.id, "pi-2"]);

// An exact long-tail title beats a looser catalog match; catalog wins ties.
const history = catalogHit("History Hit Presents: Hardcore Stories", null);
const ranked = mergePodcastHits(
  [history],
  [
    longTailHit(3, "Hardcore History Fan Club", "https://a.example.com/rss"),
    longTailHit(4, "Hardcore History", "https://b.example.com/rss"),
  ],
  "hardcore history",
  12
);
assert.deepEqual(ranked.map((h) => h.id), ["pi-4", "pi-3", history.id]);

const tie = mergePodcastHits(
  [catalogHit("Crime Junkie", "https://c.example.com/rss")],
  [longTailHit(5, "Crime Junkie Fan Pod", "https://d.example.com/rss")],
  "crime",
  12
);
assert.equal(tie[0].source, "catalog");

// A rated long-tail show (Supabase row, pi- slug) keeps its catalog slot and is filled from the index.
const ratedStub = { ...catalogHit("Hardcore History", "https://b.example.com/rss"), slug: "pi-4-hardcore-history", episode_count: null };
const filled = mergePodcastHits(
  [ratedStub],
  [{ ...longTailHit(4, "Hardcore History", "http://b.example.com/rss/"), episode_count: 74, genre_name: "History", network_name: "Dan Carlin" }],
  "hardcore history",
  12
);
assert.equal(filled.length, 1);
assert.equal(filled[0].slug, "pi-4-hardcore-history");
assert.equal(filled[0].episode_count, 74);
assert.equal(filled[0].genre_name, "History");
assert.equal(ratedStub.episode_count, null); // input not mutated
// A real catalog show is never overwritten by index data.
const catalogKept = mergePodcastHits(
  [{ ...serial, genre_name: null }],
  [{ ...longTailHit(1, "Serial", "https://feeds.serialpodcast.org/serial"), genre_name: "News" }],
  "serial",
  12
);
assert.equal(catalogKept[0].genre_name, null);

// Duplicate long-tail ids collapse; limit is respected.
assert.equal(
  mergePodcastHits([], [longTailHit(6, "A", "https://e.example.com/1"), longTailHit(6, "A", "https://e.example.com/1")], "a", 12).length,
  1
);
assert.equal(
  mergePodcastHits(
    [],
    Array.from({ length: 20 }, (_, i) => longTailHit(100 + i, `Show ${i}`, `https://f.example.com/${i}`)),
    "show",
    5
  ).length,
  5
);

// --- rated episodes merge into the live list ------------------------------

const rated = [
  {
    podcast_index_id: 42, // also in the live list → score attached, no duplicate
    slug: "42-show-70-twilight-of-the-aesir",
    title: "Show 70",
    published_at: null,
    duration_seconds: null,
    episode_type: "full" as const,
    cover_image_url: null,
    avg_rating: 8.5,
    rating_count: 2,
  },
  {
    podcast_index_id: 7, // older than the live list → appended so "Top rated" sees it
    slug: "7-show-1-the-beginning",
    title: "Show 1 – The Beginning",
    published_at: "2006-01-01T00:00:00.000Z",
    duration_seconds: 3600,
    episode_type: "full" as const,
    cover_image_url: "https://example.com/art.jpg",
    avg_rating: 9,
    rating_count: 1,
  },
  {
    podcast_index_id: 8, // listed but never rated → no score shown
    slug: "8-show-2",
    title: "Show 2",
    published_at: null,
    duration_seconds: null,
    episode_type: "full" as const,
    cover_image_url: null,
    avg_rating: 0,
    rating_count: 0,
  },
];
const merged2 = indexEpisodeCards(podcast, [summary], rated);
assert.equal(merged2.length, 3);
assert.equal(merged2[0].avg_rating, 8.5);
assert.equal(merged2[0].rating_count, 2);
assert.equal(merged2[1].episode_slug, "7-show-1-the-beginning");
assert.equal(merged2[1].avg_rating, 9);
assert.equal(merged2[1].episode_cover_url, null); // same as show cover
assert.equal(merged2[2].avg_rating, null);
assert.equal(indexEpisodeCards(podcast, [summary])[0].avg_rating, null);

// --- signed payloads (verified by the DB with pgcrypto) ----------------------

const showPayload = longTailShowPayload(podcast);
assert.equal(showPayload.feed_id, 920666);
assert.equal(showPayload.slug, podcast.slug);
assert.equal(showPayload.rss_url, "https://feeds.feedburner.com/dancarlin/history?format=xml");
const epPayload = longTailEpisodePayload(episode);
assert.equal(epPayload.episode_id, 42);
assert.equal(epPayload.slug, "42-show-70");
assert.equal(epPayload.audio_url, "https://cdn.example.com/70.mp3");

const signed = signLongTailPayload({ kind: "podcast", show: showPayload }, "s".repeat(32), 1700000000);
const parsed = JSON.parse(signed.payload);
assert.equal(parsed.kind, "podcast");
assert.equal(parsed.exp, 1700000000 + LONG_TAIL_PAYLOAD_TTL_SECONDS);
assert.match(signed.signature, /^[0-9a-f]{64}$/);
// Deterministic for the same input; any change to the payload changes the signature.
assert.equal(
  signLongTailPayload({ kind: "podcast", show: showPayload }, "s".repeat(32), 1700000000).signature,
  signed.signature
);
assert.notEqual(
  signLongTailPayload({ kind: "podcast", show: { ...showPayload, title: "x" } }, "s".repeat(32), 1700000000).signature,
  signed.signature
);

console.log("podcast-index tests passed");
