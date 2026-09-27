"use client";

import { useState } from "react";
import type { EpisodeCard, Season } from "@/lib/types";
import { TITLE_EPISODE_PREVIEW } from "@/lib/title-cast";
import {
  EPISODE_SORTS,
  hasRatedEpisodes,
  sortEpisodeCards,
  type EpisodeSort,
} from "@/lib/episode-sort";
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
  const [sort, setSort] = useState<EpisodeSort>("newest");
  const [expanded, setExpanded] = useState(false);
  const seasonNums = [
    ...new Set(seasons.map((s) => s.number).filter((n) => Number.isFinite(n))),
  ].sort((a, b) => a - b);
  const showChips = seasonNums.length > 0;
  const filtered = sortEpisodeCards(
    season === "all" ? cards : cards.filter((c) => c.season_number === season),
    sort
  );
  const ratingSort = sort === "top" || sort === "lowest";
  const catalogTotal = season === "all" ? total : filtered.length;
  const more = !expanded && filtered.length > TITLE_EPISODE_PREVIEW;
  const visible = more
    ? filtered.slice(0, TITLE_EPISODE_PREVIEW)
    : filtered;

  return (
    <section id="episodes" className="mt-16 scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Episodes</h2>
        <span className="text-[13px] text-white/45">
          Showing {visible.length} of {catalogTotal}
        </span>
      </div>

      {cards.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Sort episodes">
          {EPISODE_SORTS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              active={sort === option.id}
              onClick={() => {
                setSort(option.id);
                setExpanded(false);
              }}
            />
          ))}
        </div>
      ) : null}

      {ratingSort && !hasRatedEpisodes(filtered) ? (
        <p className="mt-3 text-[13px] text-white/45">
          No episode ratings yet — open an episode to rate it.
        </p>
      ) : null}

      {showChips ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip
            label="All"
            active={season === "all"}
            onClick={() => {
              setSeason("all");
              setExpanded(false);
            }}
          />
          {seasonNums.map((n) => (
            <Chip
              key={n}
              label={`S${n}`}
              active={season === n}
              onClick={() => {
                setSeason(n);
                setExpanded(false);
              }}
            />
          ))}
        </div>
      ) : null}

      <Card className="mt-6 px-6 sm:px-8">
        {filtered.length === 0 ? (
          <p className="py-10 text-[15px] text-white/45">
            {cards.length === 0
              ? "No episodes in the catalog yet."
              : "No episodes from this season in the catalog."}
          </p>
        ) : (
          visible.map((card) => <EpisodeCardRow key={card.id} card={card} />)
        )}
        {more ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full py-4 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
          >
            Show more
          </button>
        ) : null}
      </Card>
    </section>
  );
}

function Chip({
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
