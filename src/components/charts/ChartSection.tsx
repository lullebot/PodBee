import type { ChartBoard } from "@/lib/types";
import { PosterCard } from "@/components/charts/PosterCard";

const THIN = 20;

export function ChartSection({ board }: { board: ChartBoard }) {
  const n = board.entries.length;
  const thin = n > 0 && n < THIN;

  return (
    <section
      id={board.chart.slug}
      className="mt-14 sm:mt-16 scroll-mt-20 sm:scroll-mt-24"
    >
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {board.chart.title}
          </h2>
          <p className="mt-1 text-[13px] text-white/40">
            {n} title{n === 1 ? "" : "s"} · tap a poster
            {board.chart.kind === "genre" && board.chart.genre_slug
              ? ` · ${board.chart.genre_slug.replace(/-/g, " ")}`
              : ""}
          </p>
        </div>
      </div>

      {n === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-[15px] text-white/55">
            This chart is still filling up.
          </p>
          <p className="mt-2 text-[13px] text-white/35">
            Check Top Overall meanwhile — more titles land as the catalog grows.
          </p>
        </div>
      ) : (
        <>
          {thin ? (
            <p className="mt-3 text-[13px] text-[#F5C518]/90">
              Still growing — more genre-fit shows coming.
            </p>
          ) : null}
          <div className="mt-8 -mx-6 sm:-mx-8 px-6 sm:px-8 pt-2 overflow-x-auto pb-2">
            <div className="flex gap-4 sm:gap-5 min-w-min">
              {board.entries.map((entry) => (
                <PosterCard
                  key={`${board.chart.id}-${entry.rank}-${entry.podcast.id}`}
                  entry={entry}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
