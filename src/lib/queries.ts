import { supabase } from "@/lib/supabase";
import type {
  ChartPlacement,
  Company,
  CreditOnWork,
  Episode,
  EpisodeCard,
  EpisodeDetail,
  Genre,
  Person,
  PersonCreditRef,
  PersonDetail,
  Podcast,
  PodcastDetail,
  Season,
  SimilarPodcast,
} from "@/lib/types";

async function loadCredits(
  table: "podcast_credits" | "episode_credits",
  fk: "podcast_id" | "episode_id",
  id: string
): Promise<PersonCreditRef[]> {
  const { data } = await supabase
    .from(table)
    .select(
      "role_id, billing_order, character_name, people(id, slug, display_name, image_url), credit_roles(label)"
    )
    .eq(fk, id)
    .order("billing_order");

  return (data ?? []).flatMap((row: any) => {
    if (!row.people) return [];
    return [
      {
        person: row.people,
        role_id: row.role_id,
        role_label: row.credit_roles?.label ?? row.role_id,
        billing_order: row.billing_order,
        character_name: row.character_name ?? null,
      },
    ];
  });
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
    return view.data.map((row: any) => ({
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
  for (const row of data ?? []) {
    const pod = (row as any).podcasts;
    if (!pod?.id || byId.has(pod.id)) continue;
    byId.set(pod.id, {
      id: pod.id,
      slug: pod.slug,
      title: pod.title,
      cover_image_url: pod.cover_image_url,
      rating_average: pod.rating_average,
      rating_count: pod.rating_count,
      status: pod.status,
      shared_genre_name: (row as any).genres?.name ?? null,
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
    { data: episodes, count: episodeCount },
    { data: genreRows },
    { data: chartRows },
    { data: oldestEpisode },
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
      .from("episodes")
      .select(
        "id, slug, title, episode_number, episode_type, duration_seconds, published_at, cover_image_url, season_id",
        { count: "exact" }
      )
      .eq("podcast_id", p.id)
      .order("published_at", { ascending: false })
      .limit(25),
    supabase
      .from("podcast_genres")
      .select("is_primary, genre_id, genres(id, slug, name)")
      .eq("podcast_id", p.id),
    supabase
      .from("chart_rankings")
      .select("chart_slug, chart_title, rank")
      .eq("podcast_slug", p.slug)
      .order("rank"),
    supabase
      .from("episodes")
      .select("published_at")
      .eq("podcast_id", p.id)
      .not("published_at", "is", null)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const seasonList = (seasons as Season[]) ?? [];
  const seasonById = new Map(seasonList.map((s) => [s.id, s]));

  const episode_cards: EpisodeCard[] = (episodes ?? []).map((ep: any) => {
    const season = ep.season_id ? seasonById.get(ep.season_id) : null;
    return {
      id: ep.id,
      episode_slug: ep.slug,
      episode_title: ep.title,
      episode_number: ep.episode_number,
      episode_type: ep.episode_type,
      duration_seconds: ep.duration_seconds,
      published_at: ep.published_at,
      episode_cover_url: ep.cover_image_url,
      podcast_id: p.id,
      podcast_slug: p.slug,
      podcast_title: p.title,
      podcast_cover_url: p.cover_image_url,
      season_number: season?.number ?? null,
      season_title: season?.title ?? null,
    };
  });

  const genres: Genre[] = [];
  const genreIds: string[] = [];
  for (const row of genreRows ?? []) {
    const g = (row as any).genres;
    if (!g) continue;
    genres.push(g as Genre);
    genreIds.push(g.id);
  }

  const chart_placements: ChartPlacement[] = (chartRows ?? []).map(
    (row: any) => ({
      chart_slug: row.chart_slug,
      chart_title: row.chart_title,
      rank: row.rank,
    })
  );

  const [credits, similar] = await Promise.all([
    loadCredits("podcast_credits", "podcast_id", p.id),
    loadSimilarPodcasts(p.id, genreIds),
  ]);

  return {
    podcast: p,
    primary_company: (primary_company as Company | null) ?? null,
    companies: [],
    genres,
    chart_placements,
    seasons: seasonList,
    episode_cards,
    episode_total: episodeCount ?? episode_cards.length,
    first_published_at:
      (oldestEpisode as { published_at?: string | null } | null)?.published_at ??
      p.published_at ??
      null,
    latest_published_at: episode_cards[0]?.published_at ?? p.published_at ?? null,
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

  for (const row of podcastCredits ?? []) {
    const r = row as any;
    if (!r.podcasts) continue;
    credits.push({
      role_id: r.role_id,
      role_label: r.credit_roles?.label ?? r.role_id,
      billing_order: r.billing_order,
      character_name: r.character_name ?? null,
      work: { kind: "podcast", podcast: r.podcasts },
    });
  }

  for (const row of episodeCredits ?? []) {
    const r = row as any;
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
    loadCredits("episode_credits", "episode_id", ep.id),
  ]);

  return {
    episode: ep,
    podcast,
    season: (season as Season | null) ?? null,
    credits,
  };
}
