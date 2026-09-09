import Link from "next/link";
import type { ChartEntry } from "@/lib/types";
import { StarRating } from "@/components/ui/StarRating";

export function PosterCard({ entry }: { entry: ChartEntry }) {
  const { rank, podcast } = entry;

  return (
    <Link
      href={`/podcasts/${podcast.slug}`}
      className="group w-[140px] sm:w-[168px] shrink-0"
    >
      <div className="relative">
        <span className="absolute -left-1 -top-1 z-10 flex h-8 min-w-8 px-1.5 items-center justify-center rounded-full bg-[#F5C518] text-[13px] font-bold text-[#0B1C2C] shadow">
          {rank}
        </span>
        {podcast.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={podcast.cover_image_url}
            alt={podcast.title}
            className="aspect-[2/3] w-full rounded-[16px] object-cover bg-white/10 ring-1 ring-white/10 group-hover:ring-[#007AFF] transition"
          />
        ) : (
          <div className="aspect-[2/3] w-full rounded-[16px] bg-gradient-to-br from-[#1a3350] to-[#0B1C2C] ring-1 ring-white/10 flex items-end p-3">
            <span className="text-[13px] font-semibold leading-snug line-clamp-4">
              {podcast.title}
            </span>
          </div>
        )}
      </div>
      <p className="mt-3 text-[14px] font-semibold leading-snug line-clamp-2 group-hover:text-[#007AFF] transition-colors">
        {podcast.title}
      </p>
      <div className="mt-1.5">
        <StarRating
          average={podcast.rating_average ?? null}
          count={podcast.rating_count ?? null}
          size="sm"
        />
      </div>
    </Link>
  );
}
