import assert from "node:assert/strict";
import {
  isGuestIntent,
  isHostRole,
  isOwnTopShowHostEpisode,
  podcastSearchSubtitle,
  rankEpisodes,
  rankPeople,
  searchNameRank,
  type EpisodeSearchHit,
  type PersonSearchHit,
  type PodcastSearchHit,
} from "./search-hits";

function person(
  name: string,
  extra: Partial<PersonSearchHit> = {}
): PersonSearchHit {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    kind: "person",
    id: slug,
    slug,
    display_name: name,
    image_url: null,
    episode_count: extra.episode_count ?? 0,
    top_show_title: extra.top_show_title ?? null,
  };
}

function episode(
  title: string,
  extra: Partial<EpisodeSearchHit> = {}
): EpisodeSearchHit {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    kind: "episode",
    id: slug,
    episode_slug: slug,
    episode_title: title,
    show_slug: extra.show_slug ?? "show",
    show_title: extra.show_title ?? "Show",
    cover_image_url: null,
    published_at: extra.published_at ?? "2026-01-01",
    role_label: extra.role_label ?? null,
    person_name: extra.person_name ?? null,
  };
}

function podcast(
  title: string,
  extra: Partial<PodcastSearchHit> = {}
): PodcastSearchHit {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    kind: "podcast",
    id: slug,
    slug,
    title,
    cover_image_url: null,
    rating_average: extra.rating_average ?? null,
    genre_name: extra.genre_name ?? null,
    episode_count: extra.episode_count ?? null,
    network_name: extra.network_name ?? null,
  };
}

assert.equal(searchNameRank("Ira Glass", "ira"), 1);
assert.equal(searchNameRank("Iran", "ira"), 2);
assert.equal(searchNameRank("Kira", "ira"), 4);
assert.ok(searchNameRank("Ira Glass", "ira") < searchNameRank("Kira", "ira"));

const rankedPeople = rankPeople(
  [
    person("Kira Nurieli", { episode_count: 40 }),
    person("Iran", { episode_count: 5 }),
    person("Ira Glass", { episode_count: 15, top_show_title: "This American Life" }),
  ],
  "ira"
);
assert.deepEqual(
  rankedPeople.map((p) => p.display_name),
  ["Ira Glass", "Iran", "Kira Nurieli"]
);

assert.equal(isHostRole("Host"), true);
assert.equal(isHostRole("co-host"), true);
assert.equal(isHostRole("Guest"), false);

const ira = person("Ira Glass", {
  episode_count: 15,
  top_show_title: "This American Life",
});
const talHost = episode("449: Middle School", {
  show_title: "This American Life",
  show_slug: "this-american-life",
  role_label: "Host",
  person_name: "Ira Glass",
  published_at: "2026-09-07",
});
const guestSpot = episode("Ira Glass visits", {
  show_title: "Fresh Air",
  show_slug: "fresh-air",
  role_label: "Guest",
  person_name: "Ira Glass",
  published_at: "2026-01-02",
});
assert.equal(isOwnTopShowHostEpisode(talHost, [ira], "ira"), true);
assert.equal(isOwnTopShowHostEpisode(guestSpot, [ira], "ira"), false);

const rankedEps = rankEpisodes(
  [talHost, guestSpot],
  "ira",
  [ira]
);
assert.equal(rankedEps[0]?.show_title, "Fresh Air");
assert.equal(rankedEps[1]?.show_title, "This American Life");

assert.equal(
  podcastSearchSubtitle(
    podcast("Serial", {
      genre_name: "News",
      rating_average: 8.9,
      episode_count: 80,
      network_name: "Serial Productions",
    })
  ),
  "News · ★ 8.9 · 80 eps · Serial Productions"
);
assert.equal(
  podcastSearchSubtitle(podcast("Untitled")),
  null
);
assert.equal(
  podcastSearchSubtitle(
    podcast("Reply All", { rating_average: 9.1, genre_name: null, network_name: null })
  ),
  "★ 9.1"
);

assert.equal(isGuestIntent([ira], "ira", [podcast("This American Life")]), true);
assert.equal(isGuestIntent([ira], "Serial", [podcast("Serial")]), false);

console.log("search-hits densify ok");
