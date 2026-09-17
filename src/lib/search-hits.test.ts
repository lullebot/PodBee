import assert from "node:assert/strict";
import {
  isGuestIntent,
  isHostRole,
  isOwnTopShowEpisode,
  pickOwnShow,
  pickTopShowTitle,
  podcastSearchSubtitle,
  rankEpisodes,
  rankPeople,
  searchNameRank,
  type EpisodeSearchHit,
  type PersonSearchHit,
  type PodcastSearchHit,
  type ShowTally,
} from "./search-hits";

function person(
  name: string,
  extra: Partial<PersonSearchHit> = {}
): PersonSearchHit {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const top = extra.top_show_title ?? null;
  return {
    kind: "person",
    id: slug,
    slug,
    display_name: name,
    image_url: null,
    episode_count: extra.episode_count ?? 0,
    top_show_title: top,
    own_show_title:
      extra.own_show_title !== undefined ? extra.own_show_title : top,
    own_show_slug: extra.own_show_slug !== undefined ? extra.own_show_slug : null,
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

function tally(
  title: string,
  extra: Partial<ShowTally> = {}
): ShowTally {
  return {
    title,
    slug: extra.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    episodeCount: extra.episodeCount ?? 0,
    hasPodcastCredit: extra.hasPodcastCredit ?? false,
    hasHostLikeCredit: extra.hasHostLikeCredit ?? false,
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
assert.equal(isHostRole("Producer"), false);

assert.equal(
  pickTopShowTitle([
    tally("IMO with Michelle Obama and Craig Robinson", { episodeCount: 60 }),
    tally("Fresh Air", { episodeCount: 1 }),
  ]),
  "IMO with Michelle Obama and Craig Robinson"
);

assert.equal(
  pickOwnShow([tally("Divided Argument", { episodeCount: 1 })])?.title,
  undefined
);
assert.equal(
  pickOwnShow([
    tally("Conan O’Brien Needs A Friend", {
      episodeCount: 41,
      slug: "conan-obrien-needs-a-friend",
    }),
  ])?.slug,
  "conan-obrien-needs-a-friend"
);
assert.equal(
  pickOwnShow([
    tally("The Joe Rogan Experience", {
      episodeCount: 0,
      hasPodcastCredit: true,
      slug: "the-joe-rogan-experience",
    }),
  ])?.slug,
  "the-joe-rogan-experience"
);
assert.equal(
  pickOwnShow([
    tally("This American Life", {
      episodeCount: 15,
      hasHostLikeCredit: true,
      slug: "this-american-life",
    }),
  ])?.title,
  "This American Life"
);

const ira = person("Ira Glass", {
  episode_count: 15,
  top_show_title: "This American Life",
  own_show_slug: "this-american-life",
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
const otherIra = episode("Football is back", {
  show_title: "The Lucy Ann Lance Show",
  show_slug: "the-lucy-ann-lance-show",
  role_label: "Guest",
  person_name: "Ira Weintraub",
  published_at: "2026-09-01",
});
assert.equal(isOwnTopShowEpisode(talHost, [ira], "ira"), true);
assert.equal(isOwnTopShowEpisode(guestSpot, [ira], "ira"), false);

const rankedEps = rankEpisodes(
  [talHost, guestSpot, otherIra],
  "ira",
  [ira, person("Ira Weintraub", { episode_count: 1, top_show_title: "The Lucy Ann Lance Show" })]
);
assert.equal(rankedEps[0]?.show_title, "Fresh Air");
assert.equal(rankedEps[1]?.show_title, "This American Life");
assert.equal(rankedEps[2]?.person_name, "Ira Weintraub");

const michelle = person("Michelle Obama", {
  episode_count: 60,
  top_show_title: "IMO with Michelle Obama and Craig Robinson",
  own_show_slug: "imo-with-michelle-obama-and-craig-robinson",
});
const imoHost = episode("Embracing a New Era with H.E.R.", {
  show_title: "IMO with Michelle Obama and Craig Robinson",
  show_slug: "imo-with-michelle-obama-and-craig-robinson",
  role_label: "Host",
  person_name: "Michelle Obama",
  published_at: "2026-09-16",
});
const imoProducer = episode("Write Down the Stupid Thoughts", {
  show_title: "IMO with Michelle Obama and Craig Robinson",
  show_slug: "imo-with-michelle-obama-and-craig-robinson",
  role_label: "Producer",
  person_name: "Michelle Obama",
  published_at: "2026-08-26",
});
const otherShowGuest = episode("The Michelle Obama Interview", {
  show_title: "Talk Easy with Sam Fragoso",
  show_slug: "talk-easy-with-sam-fragoso",
  role_label: "Guest",
  person_name: "Michelle Obama",
  published_at: "2026-01-02",
});
const otherShowTitle = episode("Joe Rogan/Guy Ritchie- Own your Destiny", {
  show_title: "Elysium Audio",
  show_slug: "elysium-audio",
  role_label: null,
  person_name: null,
  published_at: "2026-05-04",
});

assert.equal(isOwnTopShowEpisode(imoHost, [michelle], "Michelle Obama"), true);
assert.equal(isOwnTopShowEpisode(imoProducer, [michelle], "Michelle Obama"), true);
assert.equal(
  isOwnTopShowEpisode(otherShowGuest, [michelle], "Michelle Obama"),
  false
);

const michelleRanked = rankEpisodes(
  [imoHost, imoProducer, otherShowGuest],
  "Michelle Obama",
  [michelle]
);
assert.equal(michelleRanked[0]?.show_title, "Talk Easy with Sam Fragoso");
assert.ok(
  michelleRanked
    .slice(1)
    .every((ep) => ep.show_slug === "imo-with-michelle-obama-and-craig-robinson")
);

const conan = person("Conan", {
  episode_count: 41,
  top_show_title: "Conan O’Brien Needs A Friend",
  own_show_slug: "conan-obrien-needs-a-friend",
});
const conafGuest = episode("Matt Groening", {
  show_title: "Conan O’Brien Needs A Friend",
  show_slug: "conan-obrien-needs-a-friend",
  role_label: "Guest",
  person_name: "Conan",
  published_at: "2026-09-07",
});
const conanElsewhere = episode("Conan on IMO", {
  show_title: "IMO with Michelle Obama and Craig Robinson",
  show_slug: "imo-with-michelle-obama-and-craig-robinson",
  role_label: "Guest",
  person_name: "Conan O'Brien",
  published_at: "2026-01-03",
});
assert.equal(isOwnTopShowEpisode(conafGuest, [conan], "conan"), true);
assert.equal(isOwnTopShowEpisode(conanElsewhere, [conan], "conan"), false);
const conanRanked = rankEpisodes([conafGuest, conanElsewhere], "conan", [
  conan,
  person("Conan O'Brien", {
    episode_count: 1,
    top_show_title: "IMO with Michelle Obama and Craig Robinson",
    own_show_title: null,
    own_show_slug: null,
  }),
]);
assert.equal(
  conanRanked[0]?.show_slug,
  "imo-with-michelle-obama-and-craig-robinson"
);

const joe = person("Joe Rogan", {
  episode_count: 0,
  top_show_title: "The Joe Rogan Experience",
  own_show_slug: "the-joe-rogan-experience",
});
const jreHost = episode("JRE #2000", {
  show_title: "The Joe Rogan Experience",
  show_slug: "the-joe-rogan-experience",
  role_label: "Host",
  person_name: "Joe Rogan",
  published_at: "2026-09-01",
});
assert.equal(isOwnTopShowEpisode(jreHost, [joe], "Joe Rogan"), true);
assert.equal(isOwnTopShowEpisode(otherShowTitle, [joe], "Joe Rogan"), false);
const joeRanked = rankEpisodes([jreHost, otherShowTitle], "Joe Rogan", [joe]);
assert.equal(joeRanked[0]?.show_slug, "elysium-audio");
assert.equal(joeRanked[1]?.show_slug, "the-joe-rogan-experience");

assert.deepEqual(rankEpisodes([], "Theo Von", []), []);

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
assert.equal(podcastSearchSubtitle(podcast("Untitled")), null);
assert.equal(
  podcastSearchSubtitle(
    podcast("Reply All", { rating_average: 9.1, genre_name: null, network_name: null })
  ),
  "★ 9.1"
);

assert.equal(isGuestIntent([ira], "ira", [podcast("This American Life")]), true);
assert.equal(isGuestIntent([ira], "Serial", [podcast("Serial")]), false);

console.log("search-hits densify ok");
