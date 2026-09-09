import { supabase } from "@/lib/supabase";
import type { Chart, ChartBoard, ChartKind } from "@/lib/types";

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

const CHART_ORDER = [
  "top-overall",
  "top-comedy",
  "top-true-crime",
  "top-news",
] as const;

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
        subtitle:
          row.rating_average != null
            ? `${row.rating_average.toFixed(1)}/10${
                row.rating_count != null
                  ? ` · ${row.rating_count.toLocaleString()} ratings`
                  : ""
              }`
            : null,
        cover_image_url: row.cover_image_url,
        status: row.status,
        primary_company_name: null,
      },
    });
  }

  const ordered: ChartBoard[] = [];
  for (const slug of CHART_ORDER) {
    const b = bySlug.get(slug);
    if (b) ordered.push(b);
  }
  for (const [slug, b] of bySlug) {
    if (!CHART_ORDER.includes(slug as (typeof CHART_ORDER)[number])) {
      ordered.push(b);
    }
  }
  return ordered;
}

export async function getChartBoards(): Promise<{
  boards: ChartBoard[];
  source: "live" | "demo";
}> {
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
}
