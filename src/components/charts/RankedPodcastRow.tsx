import Link from "next/link";
import { PODBEE_SCORE_LABEL, type ChartEntry } from "@/lib/types";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";

function formatPodbeeScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function RankedPodcastRow({ entry }: { entry: ChartEntry }) {
  const { rank, podcast } = entry;
  const network = podcast.primary_company_name?.trim() || null;
  const episodeCount =
    typeof podcast.episode_count === "number" && podcast.episode_count > 0
      ? podcast.episode_count
      : null;
  const meta = [
    network,
    episodeCount != null ? `${episodeCount.toLocaleString()} eps` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const podbee = podcast.podbee_score;

  return (
    <Link
      href={`/podcasts/${podcast.slug}`}
      className="flex items-center gap-4 sm:gap-5 group py-3.5 border-b border-white/10 last:border-0"
    >
      <span className="w-8 sm:w-10 shrink-0 text-right text-xl sm:text-2xl font-semibold tracking-tight text-white/35 tabular-nums group-hover:text-[#007AFF] transition-colors">
        {rank}
      </span>
      <Cover src={podcast.cover_image_url} alt={podcast.title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-white truncate group-hover:text-[#007AFF] transition-colors">
          {podcast.title}
        </p>
        {meta ? (
          <p className="mt-0.5 text-[13px] text-white/55 truncate">{meta}</p>
        ) : null}
        {podbee != null ? (
          <p className="mt-1 text-[12px] text-white/45 truncate">
            {PODBEE_SCORE_LABEL}{" "}
            <span className="tabular-nums text-white/70">
              {formatPodbeeScore(podbee)}
            </span>
          </p>
        ) : null}
      </div>
      <div className="shrink-0 pl-2">
        <StarRating
          average={podcast.rating_average ?? null}
          count={podcast.rating_count ?? null}
          size="sm"
          empty="dash"
        />
      </div>
    </Link>
  );
}
