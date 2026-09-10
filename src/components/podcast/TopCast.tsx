"use client";

import { useState } from "react";
import type { PersonCreditRef } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { LinkChip } from "@/components/ui/LinkChip";

export function TopCast({ credits }: { credits: PersonCreditRef[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = credits
    .slice()
    .sort((a, b) => a.billing_order - b.billing_order);
  const visible = expanded ? sorted : sorted.slice(0, 6);
  const more = sorted.length > 6;

  return (
    <section id="cast" className="mt-16 scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Top cast</h2>
        <span className="text-[13px] text-white/45">
          {sorted.length} credited
        </span>
      </div>
      <Card className="mt-6 px-6 sm:px-8 py-2">
        <ul>
          {visible.map((c) => (
            <li
              key={`${c.person.id}-${c.role_id}`}
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
              <span className="text-[15px] text-white/55 shrink-0">
                {c.role_label}
              </span>
            </li>
          ))}
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
