"use client";

import { useState } from "react";
import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import {
  SEARCH_EPISODE_PREVIEW,
  episodeHref,
  episodeSearchSubtitle,
  type EpisodeSearchHit,
} from "@/lib/search-hits";

export function EpisodeResults({ hits }: { hits: EpisodeSearchHit[] }) {
  const [expanded, setExpanded] = useState(false);
  const more = hits.length > SEARCH_EPISODE_PREVIEW;
  const visible = expanded ? hits : hits.slice(0, SEARCH_EPISODE_PREVIEW);

  return (
    <section id="episodes">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Episodes</h2>
        {more && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 text-[14px] font-medium text-[#007AFF] hover:opacity-80"
          >
            See all
          </button>
        ) : null}
      </div>
      <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
        {visible.map((ep) => {
          const subtitle = episodeSearchSubtitle(ep);
          return (
            <li key={ep.id}>
              <Link
                href={episodeHref(ep)}
                className="flex items-center gap-4 py-3 group"
              >
                <Cover src={ep.cover_image_url} alt={ep.episode_title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold group-hover:text-[#007AFF] transition-colors truncate">
                    {ep.episode_title}
                  </p>
                  {subtitle ? (
                    <p className="mt-0.5 text-[13px] text-white/55 truncate">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
