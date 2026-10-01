import assert from "node:assert/strict";
import type { EpisodeCard } from "./types";
import {
  episodeListHref,
  episodeListView,
  hasRatedEpisodes,
  parseEpisodeQuery,
  sortEpisodeCards,
} from "./episode-sort";

function card(
  id: string,
  published_at: string | null,
  avg_rating: number | null = null,
  rating_count = 0
): EpisodeCard {
  return {
    id,
    episode_slug: id,
    episode_title: id,
    episode_number: null,
    episode_type: "full",
    duration_seconds: null,
    published_at,
    episode_cover_url: null,
    podcast_id: "p",
    podcast_slug: "p",
    podcast_title: "P",
    podcast_cover_url: null,
    season_number: null,
    season_title: null,
    avg_rating,
    rating_count,
  };
}

const cards = [
  card("old-great", "2020-01-01T00:00:00Z", 9.5, 4),
  card("new-unrated", "2026-09-01T00:00:00Z"),
  card("mid-bad", "2024-05-01T00:00:00Z", 3, 2),
  card("undated-good", null, 8, 1),
  card("recent-great-fewer", "2026-01-01T00:00:00Z", 9.5, 1),
  card("zero-count-ignored", "2025-01-01T00:00:00Z", 7, 0),
];
const ids = (list: EpisodeCard[]) => list.map((c) => c.id);

assert.deepEqual(ids(sortEpisodeCards(cards, "newest")), [
  "new-unrated",
  "recent-great-fewer",
  "zero-count-ignored",
  "mid-bad",
  "old-great",
  "undated-good",
]);
assert.deepEqual(ids(sortEpisodeCards(cards, "oldest")), [
  "old-great",
  "mid-bad",
  "zero-count-ignored",
  "recent-great-fewer",
  "new-unrated",
  "undated-good",
]);
// Top rated: score desc, ties → more votes; unrated (incl. 0 votes) last, newest first.
assert.deepEqual(ids(sortEpisodeCards(cards, "top")), [
  "old-great",
  "recent-great-fewer",
  "undated-good",
  "mid-bad",
  "new-unrated",
  "zero-count-ignored",
]);
// Lowest rated: score asc; unrated still last.
assert.deepEqual(ids(sortEpisodeCards(cards, "lowest")), [
  "mid-bad",
  "undated-good",
  "old-great",
  "recent-great-fewer",
  "new-unrated",
  "zero-count-ignored",
]);
// Input is not mutated.
assert.equal(cards[0].id, "old-great");

assert.equal(hasRatedEpisodes(cards), true);
assert.equal(hasRatedEpisodes([card("a", null), card("b", null, 7, 0)]), false);

// --- URL query + server-side paging over the whole list -----------------------

assert.deepEqual(parseEpisodeQuery({}), { sort: "newest", season: null, page: 1 });
assert.deepEqual(parseEpisodeQuery({ sort: "top", season: "3", page: "4" }), { sort: "top", season: 3, page: 4 });
assert.deepEqual(parseEpisodeQuery({ sort: "bogus", season: "-1", page: "0" }), { sort: "newest", season: null, page: 1 });
assert.deepEqual(parseEpisodeQuery({ sort: ["lowest", "top"] }), { sort: "lowest", season: null, page: 1 });
assert.equal(episodeListHref("/podcasts/jre", { sort: "newest", season: null, page: 1 }), "/podcasts/jre#episodes");
assert.equal(
  episodeListHref("/podcasts/jre", { sort: "top", season: 2, page: 3 }),
  "/podcasts/jre?sort=top&season=2&page=3#episodes"
);

// 2,400 episodes, one rated 10 far back in the list: "Top rated" puts it first on page 1.
const many = Array.from({ length: 2400 }, (_, i) =>
  card(`ep-${i + 1}`, new Date(Date.UTC(2009, 11, 24) + i * 86400000).toISOString())
);
many[4] = { ...many[4], avg_rating: 10, rating_count: 3 }; // episode #5 (2009)
many[1500] = { ...many[1500], avg_rating: 6, rating_count: 1 };
const top = episodeListView(many, { sort: "top", season: null, page: 1 });
assert.equal(top.total, 2400);
assert.equal(top.cards.length, 50);
assert.equal(top.cards[0].id, "ep-5");
assert.equal(top.cards[1].id, "ep-1501");
assert.equal(top.pageCount, 48);
assert.equal(top.hasRated, true);
const lastPage = episodeListView(many, { sort: "oldest", season: null, page: 999 });
assert.equal(lastPage.query.page, 48); // clamped
assert.equal(lastPage.start, 2351);
assert.equal(lastPage.end, 2400);
assert.equal(lastPage.cards.at(-1)!.id, "ep-2400");
const seasoned = [
  { ...card("s1", "2020-01-01T00:00:00Z"), season_number: 1 },
  { ...card("s2", "2021-01-01T00:00:00Z"), season_number: 2 },
];
const s2 = episodeListView(seasoned, { sort: "newest", season: 2, page: 1 });
assert.deepEqual(s2.seasons, [1, 2]);
assert.deepEqual(s2.cards.map((c) => c.id), ["s2"]);
assert.equal(episodeListView(seasoned, { sort: "newest", season: 9, page: 1 }).query.season, null);

console.log("episode-sort ok");
