import type { ChartBoard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { RankedPodcastRow } from "@/components/charts/RankedPodcastRow";

export function ChartList({ board }: { board: ChartBoard }) {
  if (board.entries.length === 0) {
    return (
      <div className="mt-10 rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] px-6 py-10 text-center">
        <p className="text-[15px] text-white/55">This chart is still filling up.</p>
        <p className="mt-2 text-[13px] text-white/35">
          Check Top Overall meanwhile — more titles land as the catalog grows.
        </p>
      </div>
    );
  }

  return (
    <Card className="mt-10 px-5 sm:px-6">
      {board.entries.map((entry) => (
        <RankedPodcastRow
          key={`${board.chart.slug}-${entry.rank}-${entry.podcast.id}`}
          entry={entry}
        />
      ))}
    </Card>
  );
}
