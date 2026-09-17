"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreditOnWork } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { formatDate } from "@/lib/format";
import {
  LONG_EPISODE_LIST,
  ROLE_CHIPS,
  groupEpisodesByShow,
  matchesRoleFilter,
  newestFirst,
  personShowRows,
  roleChipsFor,
  roleLine,
  showMatchesRoleFilter,
  showRowMeta,
  type EpisodeShowGroup,
} from "@/lib/person-credits";

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
  const [moreShowsOpen, setMoreShowsOpen] = useState(false);

  const showRows = useMemo(() => personShowRows(credits), [credits]);
  const episodeCredits = useMemo(
    () => newestFirst(credits.filter((c) => c.work.kind === "episode")),
    [credits]
  );

  const chips = roleChipsFor(credits);

  const visibleShows =
    filter === "all"
      ? showRows
      : showRows.filter((row) => showMatchesRoleFilter(row, filter));
  const visibleEpisodes =
    filter === "all"
      ? episodeCredits
      : episodeCredits.filter((c) => matchesRoleFilter(c, filter));

  const hasShows = showRows.length > 0;
  const groupEpisodes = visibleEpisodes.length >= LONG_EPISODE_LIST;
  const episodeGroups = groupEpisodes
    ? groupEpisodesByShow(visibleEpisodes)
    : [];

  return (
    <div className="mt-16">
      <RoleChips
        chips={chips}
        filter={filter}
        onChange={(id) => {
          setFilter(id);
          setMoreShowsOpen(false);
        }}
      />

      {hasShows ? (
        <section id="shows" className="scroll-mt-28">
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">Shows</h2>
          <Card className="mt-6 px-5 sm:px-6">
            {visibleShows.length === 0 ? (
              <p className="py-10 text-[15px] text-white/45">
                No shows in this role.
              </p>
            ) : (
              <ul>
                {visibleShows.map((row) => {
                  const meta = showRowMeta(row);
                  return (
                    <li
                      key={row.podcast.id}
                      className="border-b border-white/10 last:border-0"
                    >
                      <Link
                        href={`/podcasts/${row.podcast.slug}`}
                        className="flex items-center gap-4 py-3.5 group"
                      >
                        <Cover
                          src={row.podcast.cover_image_url}
                          alt={row.podcast.title}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] sm:text-[16px] font-semibold tracking-tight text-white truncate group-hover:text-[#007AFF] transition-colors">
                            {row.podcast.title}
                          </p>
                          {meta ? (
                            <p className="mt-0.5 text-[13px] text-white/55 truncate">
                              {meta}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
          ) : groupEpisodes ? (
            <GroupedEpisodeList
              groups={episodeGroups}
              expanded={moreShowsOpen}
              onExpand={() => setMoreShowsOpen(true)}
            />
          ) : (
            <FlatEpisodeTable credits={visibleEpisodes} />
          )}
        </Card>
      </section>
    </div>
  );
}

function FlatEpisodeTable({ credits }: { credits: CreditOnWork[] }) {
  return (
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
        {credits.map((c, i) =>
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
  );
}

function GroupedEpisodeList({
  groups,
  expanded,
  onExpand,
}: {
  groups: EpisodeShowGroup[];
  expanded: boolean;
  onExpand: () => void;
}) {
  const top = groups[0];
  const rest = groups.slice(1);
  const hiddenCount = rest.reduce((n, g) => n + g.credits.length, 0);
  const visibleRest = expanded ? rest : [];

  if (!top) return null;

  return (
    <div>
      <ShowEpisodeGroup group={top} />
      {visibleRest.map((g) => (
        <ShowEpisodeGroup key={g.podcast.id} group={g} />
      ))}
      {rest.length > 0 && !expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onExpand}
          className="w-full py-4 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
        >
          See {hiddenCount} more on {rest.length} show
          {rest.length === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}

function ShowEpisodeGroup({ group }: { group: EpisodeShowGroup }) {
  const n = group.credits.length;
  return (
    <div className="border-b border-white/10 last:border-0">
      <div className="flex items-baseline justify-between gap-4 px-5 sm:px-6 py-3 bg-white/[0.04]">
        <Link
          href={`/podcasts/${group.podcast.slug}`}
          className="text-[14px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors truncate"
        >
          {group.podcast.title}
        </Link>
        <span className="shrink-0 text-[12px] tabular-nums text-white/45">
          {n} episode{n === 1 ? "" : "s"}
        </span>
      </div>
      <ul>
        {group.credits.map((c, i) =>
          c.work.kind === "episode" ? (
            <li
              key={`${c.role_id}-${c.work.episode.id}-${i}`}
              className="flex items-start gap-4 px-5 sm:px-6 py-3 border-t border-white/10"
            >
              <span className="w-[6.5rem] shrink-0 text-[13px] tabular-nums text-white/45 whitespace-nowrap pt-0.5">
                {formatDate(c.work.episode.published_at) ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/podcasts/${c.work.podcast.slug}/${c.work.episode.slug}`}
                  className="text-[15px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors"
                >
                  {c.work.episode.title}
                </Link>
                <p className="mt-0.5 text-[13px] text-white/55">{roleLine(c)}</p>
              </div>
            </li>
          ) : null
        )}
      </ul>
    </div>
  );
}
