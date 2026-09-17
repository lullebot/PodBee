import { formatDate } from "@/lib/format";

/** Search-page episode preview; remainder behind See all. */
export const SEARCH_EPISODE_PREVIEW = 8;

/** Typeahead cap per People / Podcasts / Episodes group. */
export const TYPEAHEAD_GROUP_LIMIT = 5;

/** Empty-state popular mix — 4–6 of each. */
export const POPULAR_MIX_LIMIT = 6;

export type PodcastSearchHit = {
  kind: "podcast";
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  genre_name: string | null;
  episode_count: number | null;
  network_name: string | null;
};

export type PersonSearchHit = {
  kind: "person";
  id: string;
  slug: string;
  display_name: string;
  image_url: string | null;
  episode_count: number;
  top_show_title: string | null;
};

export type EpisodeSearchHit = {
  kind: "episode";
  id: string;
  episode_slug: string;
  episode_title: string;
  show_slug: string;
  show_title: string;
  cover_image_url: string | null;
  published_at: string | null;
  role_label: string | null;
  person_name: string | null;
};

export type SearchHit = PodcastSearchHit | PersonSearchHit | EpisodeSearchHit;

export type TypeaheadHit = PersonSearchHit | PodcastSearchHit | EpisodeSearchHit;

/** Lower is better. Empty names rank last. Prefix beats contains. */
export function searchNameRank(name: string, term: string): number {
  const n = name.trim().toLowerCase();
  const t = term.trim().toLowerCase();
  if (!n || !t) return 5;
  if (n === t) return 0;
  const words = n.split(/\s+/).filter(Boolean);
  if (words[0] === t) return 1;
  if (n.startsWith(t)) return 2;
  if (words.some((word) => word.startsWith(t))) return 3;
  return 4;
}

export function isPrefixNameMatch(name: string, term: string): boolean {
  return searchNameRank(name, term) <= 3;
}

/**
 * Guest-style query: a person name matches as a word, and the query is not
 * an exact podcast title (so "Serial" still leads with the show).
 */
export function isGuestIntent(
  people: PersonSearchHit[],
  q: string,
  podcasts: PodcastSearchHit[] = []
): boolean {
  if (podcasts.some((p) => searchNameRank(p.title, q) === 0)) return false;
  return people.some((p) => isPrefixNameMatch(p.display_name, q));
}

export function episodeHref(hit: EpisodeSearchHit): string {
  return `/podcasts/${hit.show_slug}/${hit.episode_slug}`;
}

export function podcastHref(hit: PodcastSearchHit): string {
  return `/podcasts/${hit.slug}`;
}

export function personHref(hit: PersonSearchHit): string {
  return `/people/${hit.slug}`;
}

export function typeaheadHref(hit: TypeaheadHit): string {
  if (hit.kind === "person") return personHref(hit);
  if (hit.kind === "podcast") return podcastHref(hit);
  return episodeHref(hit);
}

/** Subtitle for /search people rows — zeros omitted. */
export function personSearchSubtitle(hit: PersonSearchHit): string | null {
  const parts: string[] = [];
  if (hit.episode_count > 0) {
    parts.push(
      `${hit.episode_count} episode appearance${hit.episode_count === 1 ? "" : "s"}`
    );
  }
  if (hit.top_show_title) {
    parts.push(`Top show: ${hit.top_show_title}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Compact typeahead meta — zeros omitted. */
export function personTypeaheadMeta(hit: PersonSearchHit): string | null {
  if (hit.episode_count > 0) {
    return `${hit.episode_count} eps`;
  }
  return hit.top_show_title;
}

/** `{Show} · {Role} · {Date}` — omitted parts dropped. */
export function episodeSearchSubtitle(hit: EpisodeSearchHit): string | null {
  const parts: string[] = [];
  if (hit.show_title) parts.push(hit.show_title);
  if (hit.role_label) parts.push(hit.role_label);
  const date = formatDate(hit.published_at);
  if (date) parts.push(date);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ratingLabel(average: number | null): string | null {
  if (average == null || !Number.isFinite(average)) return null;
  return `★ ${average.toFixed(1)}`;
}

function episodeCountLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return `${count.toLocaleString()} eps`;
}

/**
 * Podcast row / typeahead meta: genre · ★ · eps · network.
 * Nulls omitted — never render empty slots.
 */
export function podcastSearchSubtitle(hit: PodcastSearchHit): string | null {
  const star = ratingLabel(hit.rating_average);
  const eps = episodeCountLabel(hit.episode_count);
  const ratingEps = [star, eps].filter(Boolean).join(" · ") || null;
  const parts = [hit.genre_name?.trim() || null, ratingEps, hit.network_name?.trim() || null]
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function isHostRole(label: string | null | undefined): boolean {
  if (!label) return false;
  const n = label.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return n === "host" || n === "co_host" || n === "cohost";
}

/**
 * Queried host’s own Top-show episodes (This American Life for Ira Glass)
 * so guest appearances on other shows can rise.
 */
export function isOwnTopShowHostEpisode(
  episode: EpisodeSearchHit,
  people: PersonSearchHit[],
  term: string
): boolean {
  if (!isHostRole(episode.role_label)) return false;
  const queried = people.filter((p) => isPrefixNameMatch(p.display_name, term));
  if (queried.length === 0) return false;
  return queried.some((person) => {
    if (!person.top_show_title) return false;
    if (person.top_show_title !== episode.show_title) return false;
    if (!episode.person_name) return true;
    return searchNameRank(episode.person_name, person.display_name) <= 2;
  });
}

export function rankPeople(
  hits: PersonSearchHit[],
  term: string
): PersonSearchHit[] {
  return hits.slice().sort((a, b) => {
    const ra = searchNameRank(a.display_name, term);
    const rb = searchNameRank(b.display_name, term);
    if (ra !== rb) return ra - rb;
    if (b.episode_count !== a.episode_count) return b.episode_count - a.episode_count;
    return a.display_name.localeCompare(b.display_name);
  });
}

export function rankEpisodes(
  hits: EpisodeSearchHit[],
  term: string,
  people: PersonSearchHit[] = []
): EpisodeSearchHit[] {
  return hits.slice().sort((a, b) => {
    const pa = searchNameRank(a.person_name ?? "", term);
    const pb = searchNameRank(b.person_name ?? "", term);
    if (pa !== pb) return pa - pb;
    const ownA = isOwnTopShowHostEpisode(a, people, term) ? 1 : 0;
    const ownB = isOwnTopShowHostEpisode(b, people, term) ? 1 : 0;
    if (ownA !== ownB) return ownA - ownB;
    const ta = searchNameRank(a.episode_title, term);
    const tb = searchNameRank(b.episode_title, term);
    if (ta !== tb) return ta - tb;
    const da = a.published_at ? Date.parse(a.published_at) : 0;
    const db = b.published_at ? Date.parse(b.published_at) : 0;
    const na = Number.isNaN(da) ? 0 : da;
    const nb = Number.isNaN(db) ? 0 : db;
    return nb - na;
  });
}

export function rankPodcasts(
  hits: PodcastSearchHit[],
  term: string
): PodcastSearchHit[] {
  return hits.slice().sort((a, b) => {
    const ra = searchNameRank(a.title, term);
    const rb = searchNameRank(b.title, term);
    if (ra !== rb) return ra - rb;
    const sa = a.rating_average ?? -1;
    const sb = b.rating_average ?? -1;
    if (sb !== sa) return sb - sa;
    return a.title.localeCompare(b.title);
  });
}
