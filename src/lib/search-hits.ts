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

export type SearchHit = PodcastSearchHit | PersonSearchHit;

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
