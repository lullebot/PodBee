import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Chart, ChartBoard, ChartEntry, ChartKind } from "@/lib/types";

/** Matches live chart_rankings view (schema v0.2 / migration 003). */
export interface ChartRankingRow {
  chart_slug: string;
  chart_title: string;
  chart_type: ChartKind | string;
  genre_slug: string | null;
  genre_name: string | null;
  rank: number;
  score: number | null;
  snapshot_at: string | null;
  podcast_id: string;
  podcast_slug: string;
  podcast_title: string;
  cover_image_url: string | null;
  rating_average: number | null;
  rating_count: number | null;
  status: "active" | "completed" | "hiatus" | "cancelled";
  primary_company_name?: string | null;
  primary_company_slug?: string | null;
  episode_count?: number | null;
  podbee_score?: number | null;
  trend_score?: number | null;
  freshness_score?: number | null;
  volume_score?: number | null;
  score_updated_at?: string | null;
}

function demoBoards(): ChartBoard[] {
  const covers = [
    "https://picsum.photos/seed/podbee1/400/400",
    "https://picsum.photos/seed/podbee2/400/400",
    "https://picsum.photos/seed/podbee3/400/400",
    "https://picsum.photos/seed/podbee4/400/400",
    "https://picsum.photos/seed/podbee5/400/400",
  ];
  const mk = (
    title: string,
    slug: string,
    kind: Chart["kind"],
    genre: string | null,
    names: string[]
  ): ChartBoard => ({
    chart: {
      id: slug,
      slug,
      title,
      kind,
      genre_slug: genre,
      description: null,
    },
    entries: names.map((name, i) => ({
      rank: i + 1,
      podcast: {
        id: `${slug}-${i}`,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: name,
        subtitle:
          kind === "genre" ? genre?.replace(/-/g, " ") ?? null : "Sample catalog",
        cover_image_url: covers[i % covers.length],
        status: "active" as const,
        primary_company_name: "Sample network",
      },
    })),
  });

  return [
    mk("Top podcasts", "top-overall", "overall", null, [
      "The Daily Brief",
      "Longform Conversations",
      "Crime Desk",
      "Tech Signal",
      "Kitchen Table Stories",
    ]),
    mk("Top Comedy", "top-comedy", "genre", "comedy", [
      "Laugh Track",
      "Two Mic Tuesday",
      "Bit Factory",
      "Crowd Work Diary",
      "Punchline Hour",
    ]),
    mk("Top True Crime", "top-true-crime", "genre", "true-crime", [
      "Case Files Weekly",
      "Cold Open",
      "Witness Stand",
      "Unsolved Atlas",
      "Night Desk",
    ]),
    mk("Top News & Politics", "top-news", "genre", "news", [
      "Morning Wire",
      "Capitol Loop",
      "World Desk",
      "Policy Brief",
      "Press Row",
    ]),
  ];
}

export const CHART_SLUGS = [
  "top-overall",
  "top-comedy",
  "top-true-crime",
  "top-news",
] as const;

export type ChartSlug = (typeof CHART_SLUGS)[number];

const METHOD_BLURB: Record<ChartSlug, string> = {
  "top-overall":
    "Ranked by rating when scores exist; otherwise recency, episode depth, and cover art.",
  "top-comedy":
    "Comedy-tagged shows, ranked by rating when scores exist; otherwise recency, episode depth, and cover art.",
  "top-true-crime":
    "True crime–tagged shows, ranked by rating when scores exist; otherwise recency, episode depth, and cover art.",
  "top-news":
    "News-tagged shows, ranked by rating when scores exist; otherwise recency, episode depth, and cover art.",
};

const GENERIC_METHOD =
  "Ranked by rating when scores exist; otherwise recency, episode depth, and cover art.";

export function chartMethodBlurb(slug: string, kind?: ChartKind | string): string {
  if ((CHART_SLUGS as readonly string[]).includes(slug)) {
    return METHOD_BLURB[slug as ChartSlug];
  }
  if (kind === "genre") {
    return `Genre-tagged shows. ${GENERIC_METHOD}`;
  }
  return GENERIC_METHOD;
}

function boardsFromRankings(rows: ChartRankingRow[]): ChartBoard[] {
  const bySlug = new Map<string, ChartBoard>();

  for (const row of rows) {
    let board = bySlug.get(row.chart_slug);
    if (!board) {
      const kind = (row.chart_type === "genre" ||
      row.chart_type === "overall" ||
      row.chart_type === "format"
        ? row.chart_type
        : "overall") as ChartKind;
      board = {
        chart: {
          id: row.chart_slug,
          slug: row.chart_slug,
          title: row.chart_title,
          kind,
          genre_slug: row.genre_slug,
          description: null,
        },
        entries: [],
      };
      bySlug.set(row.chart_slug, board);
    }
    board.entries.push({
      rank: row.rank,
      podcast: {
        id: row.podcast_id,
        slug: row.podcast_slug,
        title: row.podcast_title,
        subtitle: null,
        cover_image_url: row.cover_image_url,
        status: row.status,
        primary_company_name: row.primary_company_name ?? null,
        rating_average: row.rating_average,
        rating_count: row.rating_count,
        episode_count:
          typeof row.episode_count === "number" && row.episode_count > 0
            ? row.episode_count
            : null,
        podbee_score: row.podbee_score ?? null,
        primary_company_slug: row.primary_company_slug ?? null,
      },
    });
  }

  const ordered: ChartBoard[] = [];
  for (const slug of CHART_SLUGS) {
    const b = bySlug.get(slug);
    if (b) ordered.push(b);
  }
  for (const [slug, b] of bySlug) {
    if (!(CHART_SLUGS as readonly string[]).includes(slug)) {
      ordered.push(b);
    }
  }
  return ordered;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Join network name + episode counts onto chart rows. Omit when the join has nothing. */
async function enrichChartEntries(entries: ChartEntry[]): Promise<ChartEntry[]> {
  const ids = [...new Set(entries.map((e) => e.podcast.id))];
  if (ids.length === 0) return entries;

  const companyByPodcast = new Map<string, string>();
  const episodesByPodcast = new Map<string, number>();

  for (const idChunk of chunk(ids, 80)) {
    const { data: pods } = await supabase
      .from("podcasts")
      .select("id, primary_company_id")
      .in("id", idChunk);

    const companyIds = [
      ...new Set(
        (pods ?? [])
          .map((p: { primary_company_id: string | null }) => p.primary_company_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      const byId = new Map(
        (companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
      );
      for (const p of pods ?? []) {
        const row = p as { id: string; primary_company_id: string | null };
        const n = row.primary_company_id
          ? byId.get(row.primary_company_id)
          : undefined;
        if (n) companyByPodcast.set(row.id, n);
      }
    }

    // Exact per-show counts. Nested embeds and paged .in() selects under-count
    // when PostgREST max-rows is small (TAL showed 15 instead of the real total).
    const countChunk = chunk(idChunk, 20);
    for (const ids of countChunk) {
      const results = await Promise.all(
        ids.map(async (id) => {
          const { count, error } = await supabase
            .from("episodes")
            .select("id", { count: "exact", head: true })
            .eq("podcast_id", id);
          return [id, error ? null : count] as const;
        })
      );
      for (const [id, count] of results) {
        if (typeof count === "number" && count > 0) {
          episodesByPodcast.set(id, count);
        }
      }
    }
  }

  return entries.map((entry) => ({
    ...entry,
    podcast: {
      ...entry.podcast,
      primary_company_name:
        entry.podcast.primary_company_name ??
        companyByPodcast.get(entry.podcast.id) ??
        null,
      episode_count: (() => {
        if (typeof entry.podcast.episode_count === "number" && entry.podcast.episode_count > 0) {
          return entry.podcast.episode_count;
        }
        const n = episodesByPodcast.get(entry.podcast.id);
        return n && n > 0 ? n : null;
      })(),
    },
  }));
}

export const getChartBoards = cache(async (): Promise<{
  boards: ChartBoard[];
  source: "live" | "demo";
}> => {
  try {
    const { data, error } = await supabase
      .from("chart_rankings")
      .select("*")
      .order("rank");

    if (error || !data || data.length === 0) {
      return { boards: demoBoards(), source: "demo" };
    }

    const boards = boardsFromRankings(data as ChartRankingRow[]);
    if (boards.every((b) => b.entries.length === 0)) {
      return { boards: demoBoards(), source: "demo" };
    }

    return { boards, source: "live" };
  } catch {
    return { boards: demoBoards(), source: "demo" };
  }
});

export const getChartBoardBySlug = cache(async (
  slug: string
): Promise<{ board: ChartBoard; source: "live" | "demo" } | null> => {
  try {
    const { data, error } = await supabase
      .from("chart_rankings")
      .select("*")
      .eq("chart_slug", slug)
      .order("rank");

    if (!error && data && data.length > 0) {
      const boards = boardsFromRankings(data as ChartRankingRow[]);
      const board = boards[0];
      if (board) {
        const needsJoin = board.entries.some(
          (e) =>
            !e.podcast.primary_company_name ||
            e.podcast.episode_count == null
        );
        const entries = needsJoin
          ? await enrichChartEntries(board.entries)
          : board.entries;
        return { board: { ...board, entries }, source: "live" };
      }
    }
  } catch {
    // fall through to demo for known slugs
  }

  const demo = demoBoards().find((b) => b.chart.slug === slug);
  return demo ? { board: demo, source: "demo" } : null;
});
