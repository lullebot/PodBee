import { supabase } from "@/lib/supabase";
import {
  POPULAR_MIX_LIMIT,
  isHostRole,
  normalizeShowKey,
  pickOwnShow,
  pickTopShowTitle,
  rankEpisodes,
  rankPeople,
  rankPodcasts,
  type EpisodeSearchHit,
  type PersonSearchHit,
  type PodcastSearchHit,
  type SearchHit,
  type ShowTally,
} from "@/lib/search-hits";

export type { PersonSearchHit, PodcastSearchHit, EpisodeSearchHit, SearchHit };
export {
  episodeHref,
  episodeSearchSubtitle,
  isGuestIntent,
  personSearchSubtitle,
  personTypeaheadMeta,
  podcastHref,
  podcastSearchSubtitle,
  POPULAR_MIX_LIMIT,
  SEARCH_EPISODE_PREVIEW,
  TYPEAHEAD_GROUP_LIMIT,
} from "@/lib/search-hits";

const PERSON_COLS = "id, slug, display_name, image_url";
const PODCAST_COLS =
  "id, slug, title, cover_image_url, rating_average, primary_company_id";

type PersonRow = {
  id: string;
  slug: string;
  display_name: string;
  image_url: string | null;
};

type PodcastRow = {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | string | null;
  primary_company_id?: string | null;
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

type ShowRef = { title: string; slug: string | null };

function podcastRef(value: unknown): ShowRef | null {
  const node = asOne(
    value as { title?: string | null; slug?: string | null } | null
  );
  const title = node?.title;
  if (typeof title !== "string" || title.length === 0) return null;
  const slug =
    typeof node?.slug === "string" && node.slug.length > 0 ? node.slug : null;
  return { title, slug };
}

function tallyKey(show: ShowRef): string {
  return show.slug ? `s:${show.slug}` : `t:${normalizeShowKey(show.title)}`;
}

function upsertShowTally(
  byKey: Map<string, ShowTally>,
  show: ShowRef,
  kind: "episode" | "podcast",
  roleId: string | null | undefined
): void {
  const key = tallyKey(show);
  const prev = byKey.get(key) ?? {
    title: show.title,
    slug: show.slug,
    episodeCount: 0,
    hasPodcastCredit: false,
    hasHostLikeCredit: false,
  };
  if (show.slug && !prev.slug) prev.slug = show.slug;
  if (kind === "episode") prev.episodeCount += 1;
  if (kind === "podcast") prev.hasPodcastCredit = true;
  if (isHostRole(roleId)) prev.hasHostLikeCredit = true;
  byKey.set(key, prev);
}

function tallyPersonShows(
  episodeRows: unknown[],
  showRows: unknown[]
): ShowTally[] {
  const byKey = new Map<string, ShowTally>();
  for (const row of episodeRows) {
    const episodes = (row as { episodes?: unknown }).episodes;
    const podcasts = asOne(episodes as object | object[] | null) as
      | { podcasts?: unknown }
      | null;
    const show = podcastRef(podcasts?.podcasts);
    if (!show) continue;
    upsertShowTally(
      byKey,
      show,
      "episode",
      (row as { role_id?: string | null }).role_id
    );
  }
  for (const row of showRows) {
    const show = podcastRef((row as { podcasts?: unknown }).podcasts);
    if (!show) continue;
    upsertShowTally(
      byKey,
      show,
      "podcast",
      (row as { role_id?: string | null }).role_id
    );
  }
  return [...byKey.values()];
}

function sanitizeTerm(q: string): string {
  return q.trim().replace(/[%_,]/g, " ");
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

async function hydratePeople(candidates: PersonRow[]): Promise<PersonSearchHit[]> {
  if (candidates.length === 0) return [];

  const ids = candidates.map((p) => p.id);
  const [{ data: epRows }, { data: showRows }] = await Promise.all([
    supabase
      .from("episode_credits")
      .select("person_id, role_id, episodes(podcasts(title, slug))")
      .in("person_id", ids)
      .limit(4000),
    supabase
      .from("podcast_credits")
      .select("person_id, role_id, podcasts(title, slug)")
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
    const tallies = tallyPersonShows(episodes, shows);
    const own = pickOwnShow(tallies);
    hits.push({
      kind: "person",
      id: person.id,
      slug: person.slug,
      display_name: person.display_name,
      image_url: person.image_url,
      episode_count: episodes.length,
      top_show_title: pickTopShowTitle(tallies),
      own_show_title: own?.title ?? null,
      own_show_slug: own?.slug ?? null,
    });
  }
  return hits;
}

/**
 * Prefix (`ira%`) first — existing trigram indexes cover starts_with.
 * Later-word prefix (`% glass`) and contains are fallbacks, ranked in memory.
 * No junk-name filtering here; Pipeline owns entity cleanup after SQL.
 */
async function matchPeopleRows(term: string): Promise<PersonRow[]> {
  const prefix = `${term}%`;
  const wordPrefix = `% ${term}%`;
  const contains = `%${term}%`;

  const [byPrefix, byWord, viaShows, viaEpisodes] = await Promise.all([
    supabase.from("people").select(PERSON_COLS).ilike("display_name", prefix).limit(48),
    supabase.from("people").select(PERSON_COLS).ilike("display_name", wordPrefix).limit(24),
    supabase
      .from("people")
      .select(`${PERSON_COLS}, podcast_credits!inner(id)`)
      .ilike("display_name", prefix)
      .limit(24),
    supabase
      .from("people")
      .select(`${PERSON_COLS}, episode_credits!inner(id)`)
      .ilike("display_name", prefix)
      .limit(24),
  ]);

  let candidates = collectPeople(
    viaShows.data as PersonRow[] | null,
    viaEpisodes.data as PersonRow[] | null,
    byPrefix.data as PersonRow[] | null,
    byWord.data as PersonRow[] | null
  );

  if (candidates.length < 6) {
    const { data: byContains } = await supabase
      .from("people")
      .select(PERSON_COLS)
      .ilike("display_name", contains)
      .limit(24);
    candidates = collectPeople(candidates, byContains as PersonRow[] | null);
  }

  return candidates;
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
  const candidates = await matchPeopleRows(term);
  const hits = await hydratePeople(candidates);
  return rankPeople(hits, term).slice(0, limit);
}

async function collectEpisodeAppearances(
  term: string
): Promise<EpisodeSearchHit[]> {
  const prefix = `${term}%`;
  const wordPrefix = `% ${term}%`;
  const contains = `%${term}%`;
  const wordCount = term.split(/\s+/).filter(Boolean).length;

  const [prefixMatches, wordMatches] = await Promise.all([
    supabase.from("people").select("id").ilike("display_name", prefix).limit(24),
    supabase.from("people").select("id").ilike("display_name", wordPrefix).limit(24),
  ]);

  let ids = [
    ...(prefixMatches.data ?? []),
    ...(wordMatches.data ?? []),
  ]
    .map((p) => (p as { id?: string }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  ids = [...new Set(ids)];

  if (ids.length === 0) {
    const { data: containsMatches } = await supabase
      .from("people")
      .select("id")
      .ilike("display_name", contains)
      .limit(24);
    ids = (containsMatches ?? [])
      .map((p) => (p as { id?: string }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  const [creditsRes, titleRes] = await Promise.all([
    ids.length > 0
      ? supabase
          .from("episode_credits")
          .select(
            "role_id, credit_roles(label), people(display_name), episodes(id, slug, title, published_at, cover_image_url, podcasts(slug, title, cover_image_url))"
          )
          .in("person_id", ids)
          .limit(400)
      : Promise.resolve({ data: [] as CreditRow[] }),
    wordCount >= 2
      ? supabase
          .from("episodes")
          .select(
            "id, slug, title, published_at, cover_image_url, podcasts(slug, title, cover_image_url)"
          )
          .ilike("title", contains)
          .limit(12)
      : Promise.resolve({ data: [] as NestedEpisode[] }),
  ]);

  const fromCredits = (creditsRes.data ?? []).flatMap((row) => {
    const hit = mapCreditToHit(row as CreditRow);
    return hit ? [hit] : [];
  });
  const fromTitles = (titleRes.data ?? []).flatMap((row) => {
    const hit = mapTitleHit(row as NestedEpisode);
    return hit ? [hit] : [];
  });

  return mergeEpisodeHits([...fromCredits, ...fromTitles]);
}

/** Unranked episode hits — rank with people so own-show dumps lose to guest spots. */
export async function loadEpisodeSearchHits(
  q: string
): Promise<EpisodeSearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];
  return collectEpisodeAppearances(term);
}

/**
 * Episode rows for guest-style queries: credits on matching people,
 * plus episode title matches. Each hit deep-links to the episode page.
 * Ranked after collect so a queried person’s own/Top-show episodes
 * (any role) can be down-ranked below guest spots on other shows.
 */
export async function searchEpisodeAppearances(
  q: string,
  limit = 16,
  people: PersonSearchHit[] = []
): Promise<EpisodeSearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];
  return rankEpisodes(await collectEpisodeAppearances(term), term, people).slice(
    0,
    limit
  );
}

async function densifyPodcasts(rows: PodcastRow[]): Promise<PodcastSearchHit[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const companyIds = [
    ...new Set(
      rows
        .map((p) => p.primary_company_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const [companiesRes, genresRes, episodesRes] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    supabase
      .from("podcast_genres")
      .select("podcast_id, is_primary, genres(name)")
      .in("podcast_id", ids),
    supabase.from("episodes").select("podcast_id").in("podcast_id", ids).limit(1000),
  ]);

  const companyName = new Map<string, string>();
  for (const row of companiesRes.data ?? []) {
    const name = (row as { id: string; name?: string | null }).name?.trim();
    if (name) companyName.set((row as { id: string }).id, name);
  }

  const genreByPodcast = new Map<string, string>();
  const fallbackGenre = new Map<string, string>();
  for (const row of genresRes.data ?? []) {
    const podcastId = (row as { podcast_id?: string }).podcast_id;
    const nested = asOne(
      (row as { genres?: { name?: string | null } | { name?: string | null }[] | null })
        .genres
    );
    const name = nested?.name?.trim();
    if (!podcastId || !name) continue;
    if ((row as { is_primary?: boolean }).is_primary) {
      if (!genreByPodcast.has(podcastId)) genreByPodcast.set(podcastId, name);
    } else if (!fallbackGenre.has(podcastId)) {
      fallbackGenre.set(podcastId, name);
    }
  }

  const episodeCount = new Map<string, number>();
  for (const row of episodesRes.data ?? []) {
    const id = (row as { podcast_id?: string }).podcast_id;
    if (!id) continue;
    episodeCount.set(id, (episodeCount.get(id) ?? 0) + 1);
  }

  return rows.map((p) => ({
    kind: "podcast" as const,
    id: p.id,
    slug: p.slug,
    title: p.title,
    cover_image_url: p.cover_image_url,
    rating_average: asNumber(p.rating_average),
    genre_name: genreByPodcast.get(p.id) ?? fallbackGenre.get(p.id) ?? null,
    episode_count: episodeCount.get(p.id) ?? null,
    network_name: p.primary_company_id
      ? companyName.get(p.primary_company_id) ?? null
      : null,
  }));
}

export async function searchPodcasts(
  term: string,
  limit = 12
): Promise<PodcastSearchHit[]> {
  const sanitized = sanitizeTerm(term);
  if (sanitized.length < 2) return [];
  const prefix = `${sanitized}%`;
  const contains = `%${sanitized}%`;

  const { data: prefixRows } = await supabase
    .from("podcasts")
    .select(PODCAST_COLS)
    .ilike("title", prefix)
    .order("rating_average", { ascending: false, nullsFirst: false })
    .limit(limit);

  const rows = (prefixRows ?? []) as PodcastRow[];
  if (rows.length < limit) {
    const { data: containsRows } = await supabase
      .from("podcasts")
      .select(PODCAST_COLS)
      .ilike("title", contains)
      .order("rating_average", { ascending: false, nullsFirst: false })
      .limit(limit);
    const seen = new Set(rows.map((p) => p.id));
    for (const p of (containsRows ?? []) as PodcastRow[]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      rows.push(p);
    }
  }

  if (rows.length < 6) {
    const { data: bySub } = await supabase
      .from("podcasts")
      .select(PODCAST_COLS)
      .ilike("subtitle", contains)
      .limit(8);
    const seen = new Set(rows.map((p) => p.id));
    for (const p of (bySub ?? []) as PodcastRow[]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      rows.push(p);
    }
  }

  const densified = await densifyPodcasts(rows.slice(0, limit + 4));
  return rankPodcasts(densified, sanitized).slice(0, limit);
}

export async function searchCatalog(q: string): Promise<SearchHit[]> {
  const term = sanitizeTerm(q);
  if (term.length < 2) return [];

  const [podcasts, people, rawEpisodes] = await Promise.all([
    searchPodcasts(term, 12),
    searchPeople(term, 8),
    collectEpisodeAppearances(term),
  ]);

  return [
    ...podcasts,
    ...people,
    ...rankEpisodes(rawEpisodes, term, people).slice(0, 40),
  ];
}

async function popularFromCharts(limit = POPULAR_MIX_LIMIT): Promise<PodcastRow[]> {
  const { data, error } = await supabase
    .from("chart_rankings")
    .select(
      "podcast_id, podcast_slug, podcast_title, cover_image_url, rating_average, primary_company_slug, rank"
    )
    .eq("chart_slug", "top-overall")
    .order("rank")
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  const ids = data
    .map((row) => (row as { podcast_id?: string }).podcast_id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];

  const { data: podcasts } = await supabase
    .from("podcasts")
    .select(PODCAST_COLS)
    .in("id", ids);
  const byId = new Map((podcasts ?? []).map((p) => [p.id, p as PodcastRow]));
  const ordered: PodcastRow[] = [];
  for (const row of data) {
    const id = (row as { podcast_id?: string }).podcast_id;
    const found = id ? byId.get(id) : undefined;
    if (found) ordered.push(found);
  }
  return ordered;
}

async function popularFromRatings(): Promise<PodcastRow[]> {
  const { data } = await supabase
    .from("podcasts")
    .select(PODCAST_COLS)
    .order("rating_average", { ascending: false, nullsFirst: false })
    .limit(POPULAR_MIX_LIMIT);
  return (data ?? []) as PodcastRow[];
}

async function hostsForPodcasts(
  podcasts: PodcastSearchHit[]
): Promise<PersonSearchHit[]> {
  if (podcasts.length === 0) return [];
  const showById = new Map(podcasts.map((p) => [p.id, p]));
  const podcastIds = podcasts.map((p) => p.id);

  const { data: credits } = await supabase
    .from("podcast_credits")
    .select(
      "person_id, role_id, billing_order, podcast_id, people(id, slug, display_name, image_url)"
    )
    .in("podcast_id", podcastIds)
    .in("role_id", ["host", "co_host"])
    .order("billing_order")
    .limit(24);

  const showOrder = new Map(podcasts.map((p, i) => [p.id, i]));
  const sorted = (credits ?? []).slice().sort((a, b) => {
    const oa = showOrder.get((a as { podcast_id?: string }).podcast_id ?? "") ?? 99;
    const ob = showOrder.get((b as { podcast_id?: string }).podcast_id ?? "") ?? 99;
    if (oa !== ob) return oa - ob;
    return (
      ((a as { billing_order?: number }).billing_order ?? 99) -
      ((b as { billing_order?: number }).billing_order ?? 99)
    );
  });

  const seen = new Set<string>();
  const rows: PersonRow[] = [];
  const billedShow = new Map<string, { title: string; slug: string }>();
  for (const row of sorted) {
    const nested = asOne(
      (row as { people?: PersonRow | PersonRow[] | null }).people
    );
    if (!nested?.id || seen.has(nested.id)) continue;
    seen.add(nested.id);
    rows.push({
      id: nested.id,
      slug: nested.slug,
      display_name: nested.display_name,
      image_url: nested.image_url ?? null,
    });
    const show = showById.get((row as { podcast_id?: string }).podcast_id ?? "");
    if (show) billedShow.set(nested.id, { title: show.title, slug: show.slug });
  }

  const hydrated = await hydratePeople(rows);
  return hydrated
    .map((hit) => {
      const billed = billedShow.get(hit.id);
      return {
        ...hit,
        top_show_title: hit.top_show_title ?? billed?.title ?? null,
        own_show_title: hit.own_show_title ?? billed?.title ?? null,
        own_show_slug: hit.own_show_slug ?? billed?.slug ?? null,
      };
    })
    .slice(0, POPULAR_MIX_LIMIT);
}

/** Empty search: 4–6 popular shows plus 4–6 people (hosts of those shows). */
export async function getPopularMix(): Promise<{
  podcasts: PodcastSearchHit[];
  people: PersonSearchHit[];
}> {
  const charted = await popularFromCharts(12);
  const fallback = charted.length >= 4 ? charted : await popularFromRatings();
  const densified = await densifyPodcasts(fallback);
  const podcasts = densified.slice(0, POPULAR_MIX_LIMIT);
  const people = await hostsForPodcasts(densified.slice(0, 12));
  return { podcasts, people };
}

export async function getPopularPodcasts(limit = POPULAR_MIX_LIMIT) {
  const { podcasts } = await getPopularMix();
  return podcasts.slice(0, limit);
}
