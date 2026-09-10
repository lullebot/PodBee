"use client";

import { useState } from "react";
import type { EpisodeCard, Season } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EpisodeCardRow } from "@/components/podcast/EpisodeCardRow";

export function EpisodeList({
  cards,
  total,
  seasons,
}: {
  cards: EpisodeCard[];
  total: number;
  seasons: Season[];
}) {
  const [season, setSeason] = useState<number | "all">("all");
  const seasonNums = [
    ...new Set(
      cards
        .map((c) => c.season_number)
        .filter((n): n is number => n != null)
    ),
  ].sort((a, b) => a - b);
  const showChips = seasons.length > 0 && seasonNums.length > 0;
  const filtered =
    season === "all"
      ? cards
      : cards.filter((c) => c.season_number === season);

  return (
    <section id="episodes" className="mt-16 scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Episodes</h2>
        {total > 0 ? (
          <span className="text-[13px] text-white/45">
            Showing {Math.min(cards.length, total)} of {total}
          </span>
        ) : null}
      </div>

      {showChips ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <SeasonChip
            label="All"
            active={season === "all"}
            onClick={() => setSeason("all")}
          />
          {seasonNums.map((n) => (
            <SeasonChip
              key={n}
              label={`S${n}`}
              active={season === n}
              onClick={() => setSeason(n)}
            />
          ))}
        </div>
      ) : null}

      <Card className="mt-6 px-6 sm:px-8">
        {filtered.length === 0 ? (
          <p className="py-10 text-[15px] text-white/45">
            {cards.length === 0
              ? "No episodes in the catalog yet."
              : "No episodes from this season in the latest 25."}
          </p>
        ) : (
          filtered.map((card) => <EpisodeCardRow key={card.id} card={card} />)
        )}
      </Card>
    </section>
  );
}

function SeasonChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-[#007AFF] border border-[#007AFF] text-white"
          : "border border-white/20 bg-white/5 text-white/80 hover:border-[#007AFF]"
      }`}
    >
      {label}
    </button>
  );
}
