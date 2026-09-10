import { supabase } from "@/lib/supabase";
import {
  searchNameRank,
  type EpisodeSearchHit,
  type PersonSearchHit,
  type PodcastSearchHit,
  type SearchHit,
} from "@/lib/search-hits";

export type { PersonSearchHit, PodcastSearchHit, EpisodeSearchHit, SearchHit };
export {
  episodeHref,
  episodeSearchSubtitle,
  isGuestIntent,
  personSearchSubtitle,
  personTypeaheadMeta,
} from "@/lib/search-hits";

const PERSON_COLS = "id, slug, display_name, image_url";

type PersonRow = {
  id: string;
  slug: string;
  display_name: string;
  image_url: string | null;
};

type NestedPodcast = {
  slug?: string | null;
  title?: string | null;
  cover_image_url?: string | null;
};

type NestedEpisode = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  published_at?: string | null;
  cover_image_url?: string | null;
  podcasts?: NestedPodcast | NestedPodcast[] | null;
};

type NestedPerson = {
  display_name?: string | null;
};

type CreditRow = {
  role_id?: string | null;
  credit_roles?: { label?: string | null } | { label?: string | null }[] | null;
  people?: NestedPerson | NestedPerson[] | null;
  episodes?: NestedEpisode | NestedEpisode[] | null;
};

function sanitizeTerm(q: string): string {
  return q.trim().replace(/[%_,]/g, " ");
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function rankPeople(hits: PersonSearchHit[], term: string): PersonSearchHit[] {
  return hits.slice().sort((a, b) => {
    const ra = searchNameRank(a.display_name, term);
    const rb = searchNameRank(b.display_name, term);
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

function roleLabel(row: CreditRow): string | null {
  const nested = asOne(row.credit_roles)?.label;
  if (typeof nested === "string" && nested.length > 0) return nested;
  if (typeof row.role_id === "string" && row.role_id.length > 0) return row.role_id;
  return null;
}

function mapCreditToHit(row: CreditRow): EpisodeSearchHit | null {
  const episode = asOne(row.episodes);
  const podcast = asOne(episode?.podcasts);
  const person = asOne(row.people);
  if (
    !episode?.id ||
    !episode.slug ||
    !episode.title ||
    !podcast?.slug ||
    !podcast.title
  ) {
    return null;
  }
  return {
    kind: "episode",
    id: episode.id,
    episode_slug: episode.slug,
    episode_title: episode.title,
    show_slug: podcast.slug,
    show_title: podcast.title,
    cover_image_url: episode.cover_image_url ?? podcast.cover_image_url ?? null,
    published_at: episode.published_at ?? null,
    role_label: roleLabel(row),
    person_name: person?.display_name ?? null,
  };
}

function mapTitleHit(row: NestedEpisode): EpisodeSearchHit | null {
  const podcast = asOne(row.podcasts);
  if (!row.id || !row.slug || !row.title || !podcast?.slug || !podcast.title) {
    return null;
  }
  return {
    kind: "episode",
    id: row.id,
    episode_slug: row.slug,
    episode_title: row.title,
    show_slug: podcast.slug,
    show_title: podcast.title,
    cover_image_url: row.cover_image_url ?? podcast.cover_image_url ?? null,
    published_at: row.published_at ?? null,
    role_label: null,
    person_name: null,
  };
}

function mergeEpisodeHits(hits: EpisodeSearchHit[]): EpisodeSearchHit[] {
  const byId = new Map<string, EpisodeSearchHit>();
  for (const hit of hits) {
    const prev = byId.get(hit.id);
    if (!prev) {
      byId.set(hit.id, hit);
      continue;
    }
    if (!prev.role_label && hit.role_label) byId.set(hit.id, hit);
  }
  return [...byId.values()];
}

function rankEpisodes(hits: EpisodeSearchHit[], term: string): EpisodeSearchHit[] {
  return hits.slice().sort((a, b) => {
    const pa = searchNameRank(a.person_name ?? "", term);
    const pb = searchNameRank(b.person_name ?? "", term);
    if (pa !== pb) return pa - pb;
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

/**
 * Episode rows for guest-style queries: credits on matching people,
 * plus episode title matches. Each hit deep-links to the episode page.
 */
export async function searchEpisodeAppearances(
  q: string,
  limit = 16
): Promise<EpisodeSearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];
  const pattern = `%${term}%`;

  const { data: nameMatches } = await supabase
    .from("people")
    .select("id")
    .ilike("display_name", pattern)
    .limit(24);

  const ids = (nameMatches ?? [])
    .map((p) => (p as { id?: string }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const [creditsRes, titleRes] = await Promise.all([
    ids.length > 0
      ? supabase
          .from("episode_credits")
          .select(
            "role_id, credit_roles(label), people(display_name), episodes(id, slug, title, published_at, cover_image_url, podcasts(slug, title, cover_image_url))"
          )
          .in("person_id", ids)
          .limit(240)
      : Promise.resolve({ data: [] as CreditRow[] }),
    supabase
      .from("episodes")
      .select(
        "id, slug, title, published_at, cover_image_url, podcasts(slug, title, cover_image_url)"
      )
      .ilike("title", pattern)
      .limit(12),
  ]);

  const fromCredits = (creditsRes.data ?? []).flatMap((row) => {
    const hit = mapCreditToHit(row as CreditRow);
    return hit ? [hit] : [];
  });
  const fromTitles = (titleRes.data ?? []).flatMap((row) => {
    const hit = mapTitleHit(row as NestedEpisode);
    return hit ? [hit] : [];
  });

  return rankEpisodes(mergeEpisodeHits([...fromCredits, ...fromTitles]), term).slice(
    0,
    limit
  );
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

  const [podcasts, people, episodes] = await Promise.all([
    searchPodcasts(term),
    searchPeople(term, 8),
    searchEpisodeAppearances(term, 16),
  ]);

  return [...podcasts, ...people, ...episodes];
}

export async function getPopularPodcasts(limit = 8) {
  const { data } = await supabase
    .from("podcasts")
    .select("id, slug, title, cover_image_url, rating_average")
    .order("rating_average", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
