import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import { podcastHref, podcastSearchSubtitle } from "@/lib/search-hits";
import type { PodcastSearchHit } from "@/lib/search-hits";

/** Denser podcast row: poster · genre · ★/eps · network (nulls hidden). */
export function PodcastSearchRow({ hit }: { hit: PodcastSearchHit }) {
  const subtitle = podcastSearchSubtitle(hit);
  return (
    <Link
      href={podcastHref(hit)}
      className="flex items-center gap-4 py-3 group"
    >
      <Cover src={hit.cover_image_url} alt={hit.title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold group-hover:text-[#007AFF] transition-colors truncate">
          {hit.title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-white/55 truncate">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
