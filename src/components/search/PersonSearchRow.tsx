import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import { personHref, personSearchSubtitle } from "@/lib/search-hits";
import type { PersonSearchHit } from "@/lib/search-hits";

export function PersonSearchRow({ hit }: { hit: PersonSearchHit }) {
  const subtitle = personSearchSubtitle(hit);
  return (
    <Link
      href={personHref(hit)}
      className="flex items-center gap-4 py-3 group"
    >
      <Cover
        src={hit.image_url}
        alt={hit.display_name}
        size="sm"
        rounded="full"
        monogram
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold group-hover:text-[#007AFF] transition-colors truncate">
          {hit.display_name}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-white/55 truncate">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
