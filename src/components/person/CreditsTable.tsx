"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreditOnWork, CreditRoleId } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { formatDate, yearOf } from "@/lib/format";

const ROLE_CHIPS: Array<{
  id: string;
  label: string;
  roles: CreditRoleId[] | null;
}> = [
  { id: "all", label: "All", roles: null },
  { id: "host", label: "Host", roles: ["host", "co_host"] },
  { id: "guest", label: "Guest", roles: ["guest"] },
  { id: "correspondent", label: "Correspondent", roles: ["correspondent"] },
  { id: "producer", label: "Producer", roles: ["producer", "executive_producer"] },
  { id: "writer", label: "Writer", roles: ["writer"] },
  { id: "editor", label: "Editor", roles: ["editor"] },
  { id: "narrator", label: "Narrator", roles: ["narrator"] },
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

function newestFirst(credits: CreditOnWork[]): CreditOnWork[] {
  return credits.slice().sort((a, b) => {
    const ta = creditTime(a);
    const tb = creditTime(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  });
}

function roleLine(c: CreditOnWork): string {
  return c.character_name
    ? `${c.role_label} · as ${c.character_name}`
    : c.role_label;
}

function RoleChips({
  chips,
  filter,
  onChange,
}: {
  chips: typeof ROLE_CHIPS;
  filter: string;
  onChange: (id: string) => void;
}) {
  if (chips.length <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
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
  );
}

export function CreditsTable({ credits }: { credits: CreditOnWork[] }) {
  const [filter, setFilter] = useState("all");

  const showCredits = useMemo(
    () => newestFirst(credits.filter((c) => c.work.kind === "podcast")),
    [credits]
  );
  const episodeCredits = useMemo(
    () => newestFirst(credits.filter((c) => c.work.kind === "episode")),
    [credits]
  );

  const chips = ROLE_CHIPS.filter((chip) => {
    if (chip.roles == null) return true;
    return credits.some((c) => chip.roles!.includes(c.role_id));
  });

  const visibleShows =
    filter === "all"
      ? showCredits
      : showCredits.filter((c) => {
          const chip = ROLE_CHIPS.find((x) => x.id === filter);
          return chip?.roles?.includes(c.role_id) ?? false;
        });
  const visibleEpisodes =
    filter === "all"
      ? episodeCredits
      : episodeCredits.filter((c) => {
          const chip = ROLE_CHIPS.find((x) => x.id === filter);
          return chip?.roles?.includes(c.role_id) ?? false;
        });

  const hasShows = showCredits.length > 0;

  return (
    <div className="mt-16">
      <RoleChips chips={chips} filter={filter} onChange={setFilter} />

      {hasShows ? (
        <section id="shows" className="scroll-mt-28">
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">Shows</h2>
          <Card className="mt-6 overflow-x-auto">
            {visibleShows.length === 0 ? (
              <p className="px-6 py-10 text-[15px] text-white/45">
                No shows in this role.
              </p>
            ) : (
              <table className="w-full min-w-[24rem] text-left">
                <thead>
                  <tr className="text-[12px] uppercase tracking-wide text-white/40 border-b border-white/10">
                    <th className="px-5 sm:px-6 py-3 font-medium w-20">Year</th>
                    <th className="px-3 py-3 font-medium">Show</th>
                    <th className="px-5 sm:px-6 py-3 font-medium w-40">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleShows.map((c, i) =>
                    c.work.kind === "podcast" ? (
                      <tr
                        key={`${c.role_id}-${c.work.podcast.id}-${i}`}
                        className="border-b border-white/10 last:border-0"
                      >
                        <td className="px-5 sm:px-6 py-3.5 text-[14px] tabular-nums text-white/55 align-top">
                          {yearOf(c.work.podcast.published_at) ?? "—"}
                        </td>
                        <td className="px-3 py-3.5 align-top">
                          <Link
                            href={`/podcasts/${c.work.podcast.slug}`}
                            className="text-[15px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors"
                          >
                            {c.work.podcast.title}
                          </Link>
                        </td>
                        <td className="px-5 sm:px-6 py-3.5 text-[14px] text-white/65 align-top">
                          {roleLine(c)}
                        </td>
                      </tr>
                    ) : null
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </section>
      ) : null}

      <section
        id="episodes"
        className={`${hasShows ? "mt-16" : chips.length > 1 ? "mt-8" : ""} scroll-mt-28`}
      >
        <h2 className="text-2xl font-semibold tracking-tight">Episodes</h2>
        <Card className="mt-6 overflow-x-auto">
          {episodeCredits.length === 0 ? (
            <p className="px-6 py-10 text-[15px] text-white/45">
              No episode appearances in the catalog yet.
            </p>
          ) : visibleEpisodes.length === 0 ? (
            <p className="px-6 py-10 text-[15px] text-white/45">
              No episode appearances in this role.
            </p>
          ) : (
            <table className="w-full min-w-[32rem] text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-white/40 border-b border-white/10">
                  <th className="px-5 sm:px-6 py-3 font-medium w-32">Date</th>
                  <th className="px-3 py-3 font-medium">Episode</th>
                  <th className="px-3 py-3 font-medium">Show</th>
                  <th className="px-5 sm:px-6 py-3 font-medium w-36">Role</th>
                </tr>
              </thead>
              <tbody>
                {visibleEpisodes.map((c, i) =>
                  c.work.kind === "episode" ? (
                    <tr
                      key={`${c.role_id}-${c.work.episode.id}-${i}`}
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="px-5 sm:px-6 py-3.5 text-[14px] tabular-nums text-white/55 align-top whitespace-nowrap">
                        {formatDate(c.work.episode.published_at) ?? "—"}
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <Link
                          href={`/podcasts/${c.work.podcast.slug}/${c.work.episode.slug}`}
                          className="text-[15px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors"
                        >
                          {c.work.episode.title}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <Link
                          href={`/podcasts/${c.work.podcast.slug}`}
                          className="text-[14px] text-white/65 hover:text-[#007AFF] transition-colors"
                        >
                          {c.work.podcast.title}
                        </Link>
                      </td>
                      <td className="px-5 sm:px-6 py-3.5 text-[14px] text-white/65 align-top">
                        {roleLine(c)}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}
