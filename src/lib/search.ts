import { supabase } from "@/lib/supabase";
import type { PersonSearchHit, PodcastSearchHit, SearchHit } from "@/lib/search-hits";

export type { PersonSearchHit, PodcastSearchHit, SearchHit };
export { personSearchSubtitle, personTypeaheadMeta } from "@/lib/search-hits";

const PERSON_COLS = "id, slug, display_name, image_url";

type PersonRow = {
  id: string;
  slug: string;
  display_name: string;
  image_url: string | null;
};

function sanitizeTerm(q: string): string {
  return q.trim().replace(/[%_,]/g, " ");
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function nameRank(name: string, term: string): number {
  const n = name.trim().toLowerCase();
  const t = term.trim().toLowerCase();
  if (n === t) return 0;
  if (n.startsWith(t)) return 1;
  if (n.split(/\s+/).some((word) => word.startsWith(t))) return 2;
  return 3;
}

function rankPeople(hits: PersonSearchHit[], term: string): PersonSearchHit[] {
  return hits.slice().sort((a, b) => {
    const ra = nameRank(a.display_name, term);
    const rb = nameRank(b.display_name, term);
    if (ra !== rb) return ra - rb;
    if (b.episode_count !== a.episode_count) return b.episode_count - a.episode_count;
    return a.display_name.localeCompare(b.display_name);
  });
}

function titleFrom(value: unknown): string | null {
  const node = asOne(value as { title?: string | null } | { title?: string | null }[] | null);
  const title = node?.title;
  return typeof title === "string" && title.length > 0 ? title : null;
}

function topShowTitle(episodeRows: unknown[], showRows: unknown[]): string | null {
  const counts = new Map<string, number>();
  for (const row of episodeRows) {
    const episodes = (row as { episodes?: unknown }).episodes;
    const podcasts = asOne(episodes as object | object[] | null) as
      | { podcasts?: unknown }
      | null;
    const title = titleFrom(podcasts?.podcasts);
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [title, n] of counts) {
    if (n > bestN) {
      best = title;
      bestN = n;
    }
  }
  if (best) return best;
  for (const row of showRows) {
    const title = titleFrom((row as { podcasts?: unknown }).podcasts);
    if (title) return title;
  }
  return null;
}

function collectPeople(
  ...groups: Array<Array<PersonRow> | null | undefined>
): PersonRow[] {
  const byId = new Map<string, PersonRow>();
  for (const group of groups) {
    for (const row of group ?? []) {
      if (!row?.id || byId.has(row.id)) continue;
      byId.set(row.id, {
        id: row.id,
        slug: row.slug,
        display_name: row.display_name,
        image_url: row.image_url ?? null,
      });
    }
  }
  return [...byId.values()];
}

/**
 * People with podcast_credits OR episode_credits whose name matches.
 * Nested credit rows supply appearance counts and top show — no extra views.
 */
export async function searchPeople(
  q: string,
  limit = 8
): Promise<PersonSearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];
  const pattern = `%${term}%`;

  const [byName, viaShows, viaEpisodes] = await Promise.all([
    supabase
      .from("people")
      .select(PERSON_COLS)
      .ilike("display_name", pattern)
      .limit(48),
    supabase
      .from("people")
      .select(`${PERSON_COLS}, podcast_credits!inner(id)`)
      .ilike("display_name", pattern)
      .limit(24),
    supabase
      .from("people")
      .select(`${PERSON_COLS}, episode_credits!inner(id)`)
      .ilike("display_name", pattern)
      .limit(24),
  ]);

  const candidates = collectPeople(
    viaShows.data as PersonRow[] | null,
    viaEpisodes.data as PersonRow[] | null,
    byName.data as PersonRow[] | null
  );
  if (candidates.length === 0) return [];

  const ids = candidates.map((p) => p.id);
  const [{ data: epRows }, { data: showRows }] = await Promise.all([
    supabase
      .from("episode_credits")
      .select("person_id, episodes(podcasts(title))")
      .in("person_id", ids)
      .limit(4000),
    supabase
      .from("podcast_credits")
      .select("person_id, podcasts(title)")
      .in("person_id", ids)
      .limit(800),
  ]);

  const epsByPerson = new Map<string, NonNullable<typeof epRows>>();
  for (const row of epRows ?? []) {
    const id = (row as { person_id: string }).person_id;
    const list = epsByPerson.get(id) ?? [];
    list.push(row);
    epsByPerson.set(id, list);
  }
  const showsByPerson = new Map<string, NonNullable<typeof showRows>>();
  for (const row of showRows ?? []) {
    const id = (row as { person_id: string }).person_id;
    const list = showsByPerson.get(id) ?? [];
    list.push(row);
    showsByPerson.set(id, list);
  }

  const hits: PersonSearchHit[] = [];
  for (const person of candidates) {
    const episodes = epsByPerson.get(person.id) ?? [];
    const shows = showsByPerson.get(person.id) ?? [];
    if (episodes.length === 0 && shows.length === 0) continue;
    hits.push({
      kind: "person",
      id: person.id,
      slug: person.slug,
      display_name: person.display_name,
      image_url: person.image_url,
      episode_count: episodes.length,
      top_show_title: topShowTitle(episodes, shows),
    });
  }

  return rankPeople(hits, term).slice(0, limit);
}

async function searchPodcasts(term: string): Promise<PodcastSearchHit[]> {
  const pattern = `%${term}%`;
  const { data: podcasts } = await supabase
    .from("podcasts")
    .select("id, slug, title, cover_image_url, rating_average")
    .ilike("title", pattern)
    .order("rating_average", { ascending: false, nullsFirst: false })
    .limit(12);

  let morePodcasts = podcasts ?? [];
  if (morePodcasts.length < 6) {
    const { data: bySub } = await supabase
      .from("podcasts")
      .select("id, slug, title, cover_image_url, rating_average")
      .ilike("subtitle", pattern)
      .limit(8);
    const seen = new Set(morePodcasts.map((p) => p.id));
    for (const p of bySub ?? []) {
      if (!seen.has(p.id)) morePodcasts.push(p);
    }
  }

  return morePodcasts.map((p) => ({
    kind: "podcast" as const,
    id: p.id,
    slug: p.slug,
    title: p.title,
    cover_image_url: p.cover_image_url,
    rating_average: p.rating_average,
  }));
}

export async function searchCatalog(q: string): Promise<SearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];

  const [podcasts, people] = await Promise.all([
    searchPodcasts(term),
    searchPeople(term, 8),
  ]);

  return [...podcasts, ...people];
}

export async function getPopularPodcasts(limit = 8) {
  const { data } = await supabase
    .from("podcasts")
    .select("id, slug, title, cover_image_url, rating_average")
    .order("rating_average", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
