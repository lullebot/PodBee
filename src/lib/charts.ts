import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Chart,
  ChartBoard,
  ChartKind,
  ChartPodcastSummary,
  ChartRankingRow,
} from "@/lib/types";

export type { ChartRankingRow };

const CHART_RANKINGS_SELECT = [
  "chart_slug",
  "chart_title",
  "chart_type",
  "genre_slug",
  "genre_name",
  "rank",
  "score",
  "snapshot_at",
  "podcast_id",
  "podcast_slug",
  "podcast_title",
  "cover_image_url",
  "rating_average",
  "rating_count",
  "status",
  "primary_company_name",
  "primary_company_slug",
  "episode_count",
  "podbee_score",
  "trend_score",
  "freshness_score",
  "volume_score",
  "score_updated_at",
].join(", ");

function emptyScores(): Pick<
  ChartPodcastSummary,
  | "podbee_score"
  | "trend_score"
  | "freshness_score"
  | "volume_score"
  | "score_updated_at"
> {
  return {
    podbee_score: null,
    trend_score: null,
    freshness_score: null,
    volume_score: null,
    score_updated_at: null,
  };
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
        primary_company_slug: "sample-network",
        rating_average: i === 0 ? 8.4 : null,
        rating_count: i === 0 ? 128 : null,
        episode_count: 40 + i * 12,
        ...emptyScores(),
        // First demo row shows both ★ and PodBee Score; the rest stay hidden.
        podbee_score: i === 0 ? 87.3 : null,
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

function chartPodcastFromRow(row: ChartRankingRow): ChartPodcastSummary {
  return {
    id: row.podcast_id,
    slug: row.podcast_slug,
    title: row.podcast_title,
    subtitle: null,
    cover_image_url: row.cover_image_url,
    status: row.status,
    primary_company_name: row.primary_company_name,
    primary_company_slug: row.primary_company_slug,
    rating_average: row.rating_average,
    rating_count: row.rating_count,
    episode_count: row.episode_count,
    podbee_score: row.podbee_score,
    trend_score: row.trend_score,
    freshness_score: row.freshness_score,
    volume_score: row.volume_score,
    score_updated_at: row.score_updated_at,
  };
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
      podcast: chartPodcastFromRow(row),
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

export const getChartBoards = cache(async (): Promise<{
  boards: ChartBoard[];
  source: "live" | "demo";
}> => {
  try {
    const { data, error } = await supabase
      .from("chart_rankings")
      .select(CHART_RANKINGS_SELECT)
      .order("rank")
      .returns<ChartRankingRow[]>();

    if (error || !data || data.length === 0) {
      return { boards: demoBoards(), source: "demo" };
    }

    const boards = boardsFromRankings(data);
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
      .select(CHART_RANKINGS_SELECT)
      .eq("chart_slug", slug)
      .order("rank")
      .returns<ChartRankingRow[]>();

    if (!error && data && data.length > 0) {
      const boards = boardsFromRankings(data);
      const board = boards[0];
      if (board) return { board, source: "live" };
    }
  } catch {
    // fall through to demo for known slugs
  }

  const demo = demoBoards().find((b) => b.chart.slug === slug);
  return demo ? { board: demo, source: "demo" } : null;
});
