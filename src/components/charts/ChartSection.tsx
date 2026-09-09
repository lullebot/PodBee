import type { ChartBoard } from "@/lib/types";
import { PosterCard } from "@/components/charts/PosterCard";

export function ChartSection({ board }: { board: ChartBoard }) {
  return (
    <section className="mt-14 sm:mt-16">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {board.chart.title}
          </h2>
          {board.chart.kind === "genre" && board.chart.genre_slug ? (
            <p className="mt-1 text-[13px] uppercase tracking-wide text-white/40">
              {board.chart.genre_slug.replace(/-/g, " ")}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-white/40">
              Ranked catalog · tap a poster
            </p>
          )}
        </div>
      </div>

      {board.entries.length === 0 ? (
        <p className="mt-8 text-[15px] text-white/45">No titles in this chart yet.</p>
      ) : (
        <div className="mt-6 -mx-6 sm:-mx-8 px-6 sm:px-8 overflow-x-auto pb-2 scrollbar-thin">
          <div className="flex gap-4 sm:gap-5 min-w-min">
            {board.entries.map((entry) => (
              <PosterCard
                key={`${board.chart.id}-${entry.rank}-${entry.podcast.id}`}
                entry={entry}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
