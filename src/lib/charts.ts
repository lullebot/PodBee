import { supabase } from "@/lib/supabase";
import type { Chart, ChartBoard, ChartEntry, ChartKind } from "@/lib/types";

export interface ChartRankingRow {
  chart_id: string;
  chart_slug: string;
  chart_title: string;
  chart_kind: ChartKind;
  genre_slug: string | null;
  genre_name: string | null;
  rank: number;
  podcast_id: string;
  podcast_slug: string;
  podcast_title: string;
  podcast_subtitle: string | null;
  podcast_cover_url: string | null;
  podcast_status: "active" | "completed" | "hiatus" | "cancelled";
  rating_average: number | null;
  rating_count: number | null;
  primary_company_name: string | null;
}

/** Demo boards so the home looks like IMDb while ranking tables / seed land. */
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
      board = {
        chart: {
          id: row.chart_id,
          slug: row.chart_slug,
          title: row.chart_title,
          kind: row.chart_kind,
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
        subtitle: row.podcast_subtitle,
        cover_image_url: row.podcast_cover_url,
        status: row.podcast_status,
        primary_company_name: row.primary_company_name,
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

export async function getChartBoard(
  slug: string
): Promise<ChartBoard | null> {
  const { data, error } = await supabase
    .from("chart_rankings")
    .select("*")
    .eq("chart_slug", slug)
    .order("rank");

  if (error || !data || data.length === 0) return null;
  const boards = boardsFromRankings(data as ChartRankingRow[]);
  return boards[0] ?? null;
}
