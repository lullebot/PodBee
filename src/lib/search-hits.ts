import { formatDate } from "@/lib/format";

export type PodcastSearchHit = {
  kind: "podcast";
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | null;
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

export type TypeaheadHit = PersonSearchHit | EpisodeSearchHit;

/** Lower is better. Empty names rank last. */
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

/** Guest-style query: a person name matches as a word, not a stray substring. */
export function isGuestIntent(
  people: PersonSearchHit[],
  q: string
): boolean {
  return people.some((p) => searchNameRank(p.display_name, q) <= 3);
}

export function episodeHref(hit: EpisodeSearchHit): string {
  return `/podcasts/${hit.show_slug}/${hit.episode_slug}`;
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
