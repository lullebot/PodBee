export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChartSection } from "@/components/charts/ChartSection";
import { getChartBoards } from "@/lib/charts";

const GENRE_CHIPS = [
  { label: "Top", href: "#top-overall" },
  { label: "Comedy", href: "#top-comedy" },
  { label: "True Crime", href: "#top-true-crime" },
  { label: "News", href: "#top-news" },
];

export default async function HomePage() {
  const { boards, source } = await getChartBoards();

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-20 sm:pt-28 pb-32">
        <header>
          <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
            Charts
          </p>
          <h1 className="mt-3 text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.02]">
            PodBee
          </h1>
          <p className="mt-5 max-w-xl text-lg sm:text-xl text-neutral-500 leading-snug">
            Rankings for podcasts — by overall popularity and by type. A
            catalog, not a player.
          </p>

          <nav className="mt-10 flex flex-wrap gap-2">
            {GENRE_CHIPS.map((chip) => (
              <a
                key={chip.href}
                href={chip.href}
                className="rounded-full border border-black/[0.08] bg-neutral-50 px-4 py-2 text-[14px] font-medium text-black hover:border-[#007AFF] hover:text-[#007AFF] transition-colors"
              >
                {chip.label}
              </a>
            ))}
          </nav>

          {source === "demo" ? (
            <p className="mt-6 text-[13px] text-neutral-400">
              Showing sample rankings until live chart data is loaded.{" "}
              <Link href="/podcasts/example" className="text-[#007AFF]">
                Profile pages
              </Link>{" "}
              stay ready for real slugs.
            </p>
          ) : null}
        </header>

        {boards.map((board) => (
          <div key={board.chart.slug} id={board.chart.slug}>
            <ChartSection board={board} />
          </div>
        ))}
      </div>
    </main>
  );
}
