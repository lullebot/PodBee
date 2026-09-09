import Link from "next/link";
import type { EpisodeCard } from "@/lib/types";
import { Cover } from "@/components/ui/Cover";
import { formatDate, formatDuration } from "@/lib/format";

export function EpisodeCardRow({ card }: { card: EpisodeCard }) {
  const cover = card.episode_cover_url ?? card.podcast_cover_url;
  const meta = [
    card.season_number != null ? `S${card.season_number}` : null,
    card.episode_number != null ? `E${card.episode_number}` : null,
    formatDuration(card.duration_seconds),
    formatDate(card.published_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/podcasts/${card.podcast_slug}/${card.episode_slug}`}
      className="flex gap-5 items-center group py-5 border-b border-black/[0.06] last:border-0"
    >
      <Cover src={cover} alt={card.episode_title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold text-black tracking-tight truncate group-hover:text-[#007AFF] transition-colors">
          {card.episode_title}
        </p>
        {meta ? (
          <p className="mt-1 text-[13px] text-neutral-500">{meta}</p>
        ) : null}
      </div>
    </Link>
  );
}
