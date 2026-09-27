import assert from "node:assert/strict";
import type { EpisodeCard } from "./types";
import { hasRatedEpisodes, sortEpisodeCards } from "./episode-sort";

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

console.log("episode-sort ok");
