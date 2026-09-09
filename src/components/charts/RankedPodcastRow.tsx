import Link from "next/link";
import type { ChartEntry } from "@/lib/types";
import { Cover } from "@/components/ui/Cover";

export function RankedPodcastRow({ entry }: { entry: ChartEntry }) {
  const { rank, podcast } = entry;
  return (
    <Link
      href={`/podcasts/${podcast.slug}`}
      className="flex items-center gap-5 sm:gap-6 group py-4 border-b border-black/[0.06] last:border-0"
    >
      <span className="w-10 sm:w-14 shrink-0 text-right text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-300 tabular-nums group-hover:text-[#007AFF] transition-colors">
        {rank}
      </span>
      <Cover src={podcast.cover_image_url} alt={podcast.title} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-black truncate group-hover:text-[#007AFF] transition-colors">
          {podcast.title}
        </p>
        {podcast.subtitle ? (
          <p className="mt-1 text-[13px] sm:text-[15px] text-neutral-500 truncate">
            {podcast.subtitle}
          </p>
        ) : podcast.primary_company_name ? (
          <p className="mt-1 text-[13px] sm:text-[15px] text-neutral-500 truncate">
            {podcast.primary_company_name}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
