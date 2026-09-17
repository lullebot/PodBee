import { cache } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildTitleCast,
  type TitleCastCredit,
} from "@/lib/title-cast";
import type {
  Company,
  CreditOnWork,
  CreditRoleId,
  Episode,
  EpisodeCard,
  EpisodeDetail,
  Genre,
  Person,
  PersonCreditRef,
  PersonDetail,
  Podcast,
  PodcastDetail,
  PodcastStatus,
  Season,
  SimilarPodcast,
  TitleCastMember,
} from "@/lib/types";

type SimilarPodcastRankedRow = {
  similar_podcast_id: string;
  similar_slug: string;
  similar_title: string;
  similar_cover_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  status: PodcastStatus;
  shared_genre_name: string | null;
};

type PodcastGenreJoinPodcast = {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  status: PodcastStatus;
};

type PodcastGenreJoinRow = {
  genre_id: string;
  genres: { slug: string; name: string } | null;
  podcasts: PodcastGenreJoinPodcast | null;
};

type PersonWorkPodcast = {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  published_at: string | null;
};

type PersonPodcastCreditRow = {
  role_id: CreditRoleId;
  billing_order: number;
  character_name: string | null;
  credit_roles: { label: string } | null;
  podcasts: PersonWorkPodcast | null;
};

type PersonEpisodeCreditRow = {
  role_id: CreditRoleId;
  billing_order: number;
  character_name: string | null;
  credit_roles: { label: string } | null;
  episodes:
    | {
        id: string;
        slug: string;
        title: string;
        cover_image_url: string | null;
        published_at: string | null;
        podcast_id: string;
        podcasts: PersonWorkPodcast | null;
      }
    | null;
};

type CreditRow = {
  role_id: CreditRoleId;
  billing_order: number;
  character_name: string | null;
  episode_id?: string | null;
  people: PersonCreditRef["person"] | PersonCreditRef["person"][] | null;
  credit_roles: { label: string } | { label: string }[] | null;
};

function asPerson(
  value: CreditRow["people"]
): PersonCreditRef["person"] | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asRoleLabel(
  roleId: CreditRoleId,
  value: CreditRow["credit_roles"]
): string {
  if (!value) return roleId;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.label ?? roleId;
}

function mapCreditRow(
  row: CreditRow,
  episodeId: string | null
): TitleCastCredit | null {
  const person = asPerson(row.people);
  if (!person) return null;
  return {
    person,
    role_id: row.role_id,
    role_label: asRoleLabel(row.role_id, row.credit_roles),
    billing_order: row.billing_order,
    character_name: row.character_name ?? null,
    episode_id: episodeId,
  };
}

const loadCompanyNames = cache(async (): Promise<string[]> => {
  const { data } = await supabase.from("companies").select("name, slug");
  const keys: string[] = [];
  for (const row of data ?? []) {
    const name = (row as { name?: string | null }).name?.trim();
    const slug = (row as { slug?: string | null }).slug?.trim();
    if (name) keys.push(name);
    if (slug) keys.push(slug);
  }
  return keys;
});

/** People-only title cast from podcast_credits + episode_credits, grouped by person. */
async function loadTitleCast(
  podcastId: string,
  podcastTitle?: string | null
): Promise<TitleCastMember[]> {
  const [{ data: showRows }, { data: episodeRows }, companyNames] =
    await Promise.all([
      supabase
        .from("podcast_credits")
        .select(
          "role_id, billing_order, character_name, people(id, slug, display_name, image_url), credit_roles(label)"
        )
        .eq("podcast_id", podcastId),
      supabase
        .from("episode_credits")
        .select(
          "role_id, billing_order, character_name, episode_id, people(id, slug, display_name, image_url), credit_roles(label), episodes!inner(podcast_id)"
        )
        .eq("episodes.podcast_id", podcastId)
        .limit(4000),
      loadCompanyNames(),
    ]);

  const hide = podcastTitle ? [...companyNames, podcastTitle] : companyNames;
  const credits: TitleCastCredit[] = [];
  for (const row of (showRows ?? []) as CreditRow[]) {
    const mapped = mapCreditRow(row, null);
    if (mapped) credits.push(mapped);
  }
  for (const row of (episodeRows ?? []) as CreditRow[]) {
    const mapped = mapCreditRow(row, row.episode_id ?? null);
    if (mapped) credits.push(mapped);
  }
  return buildTitleCast(credits, hide);
}

async function loadEpisodeCast(
  episodeId: string,
  podcastTitle?: string | null
): Promise<TitleCastMember[]> {
  const [{ data }, companyNames] = await Promise.all([
    supabase
      .from("episode_credits")
      .select(
        "role_id, billing_order, character_name, episode_id, people(id, slug, display_name, image_url), credit_roles(label)"
      )
      .eq("episode_id", episodeId)
      .order("billing_order"),
    loadCompanyNames(),
  ]);

  const hide = podcastTitle ? [...companyNames, podcastTitle] : companyNames;
  const credits: TitleCastCredit[] = [];
  for (const row of (data ?? []) as CreditRow[]) {
    const mapped = mapCreditRow(row, row.episode_id ?? episodeId);
    if (mapped) credits.push(mapped);
  }
  return buildTitleCast(credits, hide);
}


async function loadSimilarPodcasts(
  podcastId: string,
  genreIds: string[]
): Promise<SimilarPodcast[]> {
  if (genreIds.length === 0) return [];

  // Prefer view when 004 is live
  const view = await supabase
    .from("similar_podcasts_ranked")
    .select(
      "similar_podcast_id, similar_slug, similar_title, similar_cover_url, rating_average, rating_count, status, shared_genre_name"
    )
    .eq("podcast_id", podcastId)
    .order("shared_genre_count", { ascending: false })
    .order("rating_average", { ascending: false })
    .limit(12);

  if (!view.error && view.data && view.data.length > 0) {
    return (view.data as SimilarPodcastRankedRow[]).map((row) => ({
      id: row.similar_podcast_id,
      slug: row.similar_slug,
      title: row.similar_title,
      cover_image_url: row.similar_cover_url,
      rating_average: row.rating_average,
      rating_count: row.rating_count,
      status: row.status,
      shared_genre_name: row.shared_genre_name,
    }));
  }

  const { data } = await supabase
    .from("podcast_genres")
    .select(
      "genre_id, genres(slug,name), podcasts(id,slug,title,cover_image_url,rating_average,rating_count,status)"
    )
    .in("genre_id", genreIds)
    .neq("podcast_id", podcastId);

  const byId = new Map<string, SimilarPodcast>();
  for (const row of (data ?? []) as unknown as PodcastGenreJoinRow[]) {
    const pod = row.podcasts;
    if (!pod?.id || byId.has(pod.id)) continue;
    byId.set(pod.id, {
      id: pod.id,
      slug: pod.slug,
      title: pod.title,
      cover_image_url: pod.cover_image_url,
      rating_average: pod.rating_average,
      rating_count: pod.rating_count,
      status: pod.status,
      shared_genre_name: row.genres?.name ?? null,
    });
  }

  return [...byId.values()]
    .sort((a, b) => (b.rating_average ?? 0) - (a.rating_average ?? 0))
    .slice(0, 12);
}

export async function getPodcastDetail(
  slug: string
): Promise<PodcastDetail | null> {
  const { data: podcast, error } = await supabase
    .from("podcasts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !podcast) return null;

  const p = podcast as Podcast;

  const [
    { data: primary_company },
    { data: seasons },
    { data: cards, count: episodeCount },
    { data: genreRows },
    credits,
  ] = await Promise.all([
    p.primary_company_id
      ? supabase
          .from("companies")
          .select("*")
          .eq("id", p.primary_company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("seasons")
      .select("*")
      .eq("podcast_id", p.id)
      .order("number"),
    supabase
      .from("episode_cards")
      .select("*", { count: "exact" })
      .eq("podcast_id", p.id)
      .order("published_at", { ascending: false }),
    supabase
      .from("podcast_genres")
      .select("is_primary, genre_id, genres(id, slug, name)")
      .eq("podcast_id", p.id),
    loadTitleCast(p.id, p.title),
  ]);

  const seasonList = (seasons as Season[]) ?? [];
  const episode_cards = (cards ?? []) as EpisodeCard[];

  const genres: Genre[] = [];
  const genreIds: string[] = [];
  for (const row of genreRows ?? []) {
    const g = (row as { genres?: Genre | Genre[] | null }).genres;
    const genre = Array.isArray(g) ? g[0] : g;
    if (!genre?.id || !genre.name?.trim()) continue;
    genres.push(genre);
    genreIds.push(genre.id);
  }

  const similar = await loadSimilarPodcasts(p.id, genreIds);

  let first_published_at: string | null = p.published_at ?? null;
  let latest_published_at: string | null = p.published_at ?? null;
  for (const card of episode_cards) {
    const at = card.published_at;
    if (!at) continue;
    if (!first_published_at || at < first_published_at) first_published_at = at;
    if (!latest_published_at || at > latest_published_at) {
      latest_published_at = at;
    }
  }

  return {
    podcast: p,
    primary_company: (primary_company as Company | null) ?? null,
    companies: [],
    genres,
    chart_placements: [],
    seasons: seasonList,
    episode_cards,
    episode_total: episodeCount ?? episode_cards.length,
    first_published_at,
    latest_published_at,
    credits,
    similar,
  };
}

export async function getPersonDetail(
  slug: string
): Promise<PersonDetail | null> {
  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !person) return null;

  const pe = person as Person;

  const [{ data: podcastCredits }, { data: episodeCredits }] =
    await Promise.all([
      supabase
        .from("podcast_credits")
        .select(
          "role_id, billing_order, character_name, credit_roles(label), podcasts(id, slug, title, cover_image_url, rating_average, rating_count, published_at)"
        )
        .eq("person_id", pe.id)
        .order("billing_order"),
      supabase
        .from("episode_credits")
        .select(
          "role_id, billing_order, character_name, credit_roles(label), episodes(id, slug, title, cover_image_url, published_at, podcast_id, podcasts(id, slug, title, cover_image_url, rating_average, rating_count, published_at))"
        )
        .eq("person_id", pe.id)
        .limit(1000),
    ]);

  const credits: CreditOnWork[] = [];

  for (const row of (podcastCredits ?? []) as unknown as PersonPodcastCreditRow[]) {
    const r = row;
    if (!r.podcasts) continue;
    credits.push({
      role_id: r.role_id,
      role_label: r.credit_roles?.label ?? r.role_id,
      billing_order: r.billing_order,
      character_name: r.character_name ?? null,
      work: { kind: "podcast", podcast: r.podcasts },
    });
  }

  for (const row of (episodeCredits ?? []) as unknown as PersonEpisodeCreditRow[]) {
    const r = row;
    const ep = r.episodes;
    if (!ep?.podcasts) continue;
    credits.push({
      role_id: r.role_id,
      role_label: r.credit_roles?.label ?? r.role_id,
      billing_order: r.billing_order,
      character_name: r.character_name ?? null,
      work: {
        kind: "episode",
        episode: {
          id: ep.id,
          slug: ep.slug,
          title: ep.title,
          cover_image_url: ep.cover_image_url,
          published_at: ep.published_at,
        },
        podcast: ep.podcasts,
      },
    });
  }

  return { person: pe, credits };
}

export async function getEpisodeDetail(
  showSlug: string,
  episodeSlug: string
): Promise<EpisodeDetail | null> {
  const { data: podcast, error: podErr } = await supabase
    .from("podcasts")
    .select(
      "id, slug, title, subtitle, cover_image_url, explicit, language, status"
    )
    .eq("slug", showSlug)
    .maybeSingle();
  if (podErr || !podcast) return null;

  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("*")
    .eq("podcast_id", podcast.id)
    .eq("slug", episodeSlug)
    .maybeSingle();
  if (epErr || !episode) return null;

  const ep = episode as Episode;

  const [{ data: season }, credits] = await Promise.all([
    ep.season_id
      ? supabase.from("seasons").select("*").eq("id", ep.season_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadEpisodeCast(ep.id, podcast.title),
  ]);

  return {
    episode: ep,
    podcast,
    season: (season as Season | null) ?? null,
    credits,
  };
}
