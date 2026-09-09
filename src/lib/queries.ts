import { supabase } from "@/lib/supabase";
import type {
  ChartPlacement,
  Company,
  CreditOnWork,
  Episode,
  EpisodeCard,
  Genre,
  Person,
  PersonCreditRef,
  PersonDetail,
  Podcast,
  PodcastDetail,
  Season,
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
    { data: episodes },
    { data: genreRows },
    { data: chartRows },
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
        "id, slug, title, episode_number, episode_type, duration_seconds, published_at, cover_image_url, season_id"
      )
      .eq("podcast_id", p.id)
      .order("published_at", { ascending: false }),
    supabase
      .from("podcast_genres")
      .select("is_primary, genres(id, slug, name)")
      .eq("podcast_id", p.id),
    supabase
      .from("chart_rankings")
      .select("chart_slug, chart_title, rank")
      .eq("podcast_slug", p.slug)
      .order("rank"),
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

  const genres: Genre[] = (genreRows ?? []).flatMap((row: any) =>
    row.genres ? [row.genres as Genre] : []
  );

  const chart_placements: ChartPlacement[] = (chartRows ?? []).map(
    (row: any) => ({
      chart_slug: row.chart_slug,
      chart_title: row.chart_title,
      rank: row.rank,
    })
  );

  const credits = await loadCredits("podcast_credits", "podcast_id", p.id);

  return {
    podcast: p,
    primary_company: (primary_company as Company | null) ?? null,
    companies: [],
    genres,
    chart_placements,
    seasons: seasonList,
    episode_cards,
    credits,
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
          "role_id, billing_order, character_name, credit_roles(label), podcasts(id, slug, title, cover_image_url, rating_average, rating_count)"
        )
        .eq("person_id", pe.id)
        .order("billing_order"),
      supabase
        .from("episode_credits")
        .select(
          "role_id, billing_order, character_name, credit_roles(label), episodes(id, slug, title, cover_image_url, published_at, podcast_id, podcasts(id, slug, title, cover_image_url))"
        )
        .eq("person_id", pe.id)
        .order("billing_order"),
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
