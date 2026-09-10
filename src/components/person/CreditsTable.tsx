"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreditOnWork, CreditRoleId } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { yearOf } from "@/lib/format";

const ROLE_CHIPS: Array<{
  id: "all" | "host" | "guest" | "producer";
  label: string;
  roles: CreditRoleId[] | null;
}> = [
  { id: "all", label: "All", roles: null },
  { id: "host", label: "Host", roles: ["host", "co_host"] },
  { id: "guest", label: "Guest", roles: ["guest"] },
  { id: "producer", label: "Producer", roles: ["producer", "executive_producer"] },
];

function creditTime(c: CreditOnWork): number | null {
  const iso =
    c.work.kind === "episode"
      ? c.work.episode.published_at
      : c.work.podcast.published_at;
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function creditYear(c: CreditOnWork): string | null {
  const iso =
    c.work.kind === "episode"
      ? c.work.episode.published_at
      : c.work.podcast.published_at;
  const y = yearOf(iso);
  return y != null ? String(y) : null;
}

function workTitle(c: CreditOnWork): string {
  return c.work.kind === "podcast" ? c.work.podcast.title : c.work.episode.title;
}

export function CreditsTable({ credits }: { credits: CreditOnWork[] }) {
  const [filter, setFilter] = useState<(typeof ROLE_CHIPS)[number]["id"]>("all");

  const sorted = useMemo(
    () =>
      credits.slice().sort((a, b) => {
        const ta = creditTime(a);
        const tb = creditTime(b);
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return tb - ta;
      }),
    [credits]
  );

  const chips = ROLE_CHIPS.filter((chip) => {
    if (chip.roles == null) return true;
    return sorted.some((c) => chip.roles!.includes(c.role_id));
  });

  const visible =
    filter === "all"
      ? sorted
      : sorted.filter((c) => {
          const chip = ROLE_CHIPS.find((x) => x.id === filter);
          return chip?.roles?.includes(c.role_id) ?? false;
        });

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">Credits</h2>
      {chips.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                filter === chip.id
                  ? "bg-[#007AFF] border border-[#007AFF] text-white"
                  : "border border-white/20 bg-white/5 text-white/80 hover:border-[#007AFF]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <Card className="mt-6 overflow-x-auto">
        {visible.length === 0 ? (
          <p className="px-6 py-10 text-[15px] text-white/45">
            No credits in this role.
          </p>
        ) : (
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-wide text-white/40 border-b border-white/10">
                <th className="px-5 sm:px-6 py-3 font-medium w-20">Year</th>
                <th className="px-3 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium w-32">Role</th>
                <th className="px-5 sm:px-6 py-3 font-medium">Context</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr
                  key={`${c.role_id}-${c.work.kind === "podcast" ? c.work.podcast.id : c.work.episode.id}-${i}`}
                  className="border-b border-white/10 last:border-0"
                >
                  <td className="px-5 sm:px-6 py-3.5 text-[14px] tabular-nums text-white/55 align-top">
                    {creditYear(c) ?? "—"}
                  </td>
                  <td className="px-3 py-3.5 align-top">
                    <Link
                      href={`/podcasts/${c.work.podcast.slug}`}
                      className="text-[15px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors"
                    >
                      {workTitle(c)}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-[14px] text-white/65 align-top">
                    {c.role_label}
                    {c.character_name ? ` · as ${c.character_name}` : ""}
                  </td>
                  <td className="px-5 sm:px-6 py-3.5 text-[14px] text-white/55 align-top">
                    {c.work.kind === "episode" ? (
                      <Link
                        href={`/podcasts/${c.work.podcast.slug}`}
                        className="hover:text-[#007AFF] transition-colors"
                      >
                        {c.work.podcast.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
