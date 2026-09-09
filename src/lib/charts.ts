import { supabase } from "@/lib/supabase";
import type { Chart, ChartBoard, ChartEntry } from "@/lib/types";

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
        subtitle: kind === "genre" ? genre?.replace(/-/g, " ") ?? null : "Sample catalog",
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

export async function getChartBoards(): Promise<{
  boards: ChartBoard[];
  source: "live" | "demo";
}> {
  try {
    const { data: charts, error } = await supabase
      .from("charts")
      .select("id, slug, title, kind, genre_slug, description")
      .order("title");

    if (error || !charts || charts.length === 0) {
      return { boards: demoBoards(), source: "demo" };
    }

    const boards: ChartBoard[] = [];
    for (const chart of charts as Chart[]) {
      const { data: rows } = await supabase
        .from("chart_entries")
        .select(
          "rank, podcasts(id, slug, title, subtitle, cover_image_url, status, companies:primary_company_id(name))"
        )
        .eq("chart_id", chart.id)
        .order("rank")
        .limit(10);

      const entries: ChartEntry[] = (rows ?? []).flatMap((row: any) => {
        const p = row.podcasts;
        if (!p) return [];
        return [
          {
            rank: row.rank,
            podcast: {
              id: p.id,
              slug: p.slug,
              title: p.title,
              subtitle: p.subtitle,
              cover_image_url: p.cover_image_url,
              status: p.status,
              primary_company_name: p.companies?.name ?? null,
            },
          },
        ];
      });

      boards.push({ chart, entries });
    }

    if (boards.every((b) => b.entries.length === 0)) {
      return { boards: demoBoards(), source: "demo" };
    }

    return { boards, source: "live" };
  } catch {
    return { boards: demoBoards(), source: "demo" };
  }
}
