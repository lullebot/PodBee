"use client";

import { useState } from "react";
import type { TitleCastMember } from "@/lib/types";
import { episodeCountLabel, TITLE_CAST_PREVIEW } from "@/lib/title-cast";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { LinkChip } from "@/components/ui/LinkChip";

export function TopCast({
  members,
  showEpisodeCount = true,
}: {
  members: TitleCastMember[];
  showEpisodeCount?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? members : members.slice(0, TITLE_CAST_PREVIEW);
  const more = members.length > TITLE_CAST_PREVIEW;

  return (
    <section id="cast" className="mt-16 scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Top cast</h2>
        <span className="text-[13px] text-white/45">
          {members.length} credited
        </span>
      </div>
      <Card className="mt-6 px-6 sm:px-8 py-2">
        <ul>
          {visible.map((c) => {
            const count =
              showEpisodeCount && c.episode_count > 0
                ? episodeCountLabel(c.episode_count)
                : null;
            const meta = [c.role_label, count].filter(Boolean).join(" · ");
            return (
              <li
                key={c.person.id}
                className="flex items-center justify-between gap-6 py-4 border-b border-white/10 last:border-0"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Cover
                    src={c.person.image_url}
                    alt={c.person.display_name}
                    size="sm"
                    rounded="full"
                    monogram
                  />
                  <LinkChip href={`/people/${c.person.slug}`}>
                    {c.person.display_name}
                  </LinkChip>
                </div>
                {meta ? (
                  <span className="text-[15px] text-white/55 shrink-0">
                    {meta}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {more && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full py-4 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
          >
            See all cast
          </button>
        ) : null}
      </Card>
    </section>
  );
}
