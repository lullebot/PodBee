import type { ChartBoard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { RankedPodcastRow } from "@/components/charts/RankedPodcastRow";

export function ChartSection({ board }: { board: ChartBoard }) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {board.chart.title}
        </h2>
        {board.chart.kind === "genre" && board.chart.genre_slug ? (
          <span className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
            {board.chart.genre_slug.replace(/-/g, " ")}
          </span>
        ) : null}
      </div>
      {board.chart.description ? (
        <p className="mt-3 text-[15px] text-neutral-500 max-w-xl">
          {board.chart.description}
        </p>
      ) : null}
      <Card className="mt-8 px-5 sm:px-8">
        {board.entries.length === 0 ? (
          <p className="py-12 text-[15px] text-neutral-400 text-center">
            Rankings fill as the catalog grows.
          </p>
        ) : (
          board.entries.map((entry) => (
            <RankedPodcastRow
              key={`${board.chart.id}-${entry.rank}-${entry.podcast.id}`}
              entry={entry}
            />
          ))
        )}
      </Card>
    </section>
  );
}
