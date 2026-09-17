"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreditOnWork } from "@/lib/types";
import {
  LONG_EPISODE_LIST,
  buildShowFilmography,
  chipsForCredits,
  groupEpisodeCreditsByShow,
  matchesRoleFilter,
  newestFirst,
  roleLine,
  type EpisodeShowGroup,
  type ShowFilmographyRow,
} from "@/lib/person-credits";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { formatDate } from "@/lib/format";

function RoleChips({
  chips,
  filter,
  onChange,
}: {
  chips: ReturnType<typeof chipsForCredits>;
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

function showMeta(row: ShowFilmographyRow): string | null {
  const parts: string[] = [];
  const role = roleLine(row);
  if (role) parts.push(role);
  if (row.episode_count > 0) {
    parts.push(
      `${row.episode_count} episode${row.episode_count === 1 ? "" : "s"}`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ShowFilmography({ rows }: { rows: ShowFilmographyRow[] }) {
  return (
    <ul className="px-5 sm:px-6">
      {rows.map((row) => {
        const meta = showMeta(row);
        return (
          <li
            key={row.podcast.id}
            className="border-b border-white/10 last:border-0"
          >
            <Link
              href={`/podcasts/${row.podcast.slug}`}
              className="flex items-center gap-4 py-4 group"
            >
              <Cover
                src={row.podcast.cover_image_url}
                alt={row.podcast.title}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight text-white group-hover:text-[#007AFF] transition-colors truncate">
                  {row.podcast.title}
                </p>
                {meta ? (
                  <p className="mt-1 text-[13px] text-white/55 truncate">
                    {meta}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EpisodeTable({ credits }: { credits: CreditOnWork[] }) {
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
  collapsed,
  onExpand,
}: {
  groups: EpisodeShowGroup[];
  collapsed: boolean;
  onExpand: () => void;
}) {
  const visible = collapsed && groups.length > 1 ? groups.slice(0, 1) : groups;
  const hidden = collapsed && groups.length > 1 ? groups.slice(1) : [];
  const hiddenEpisodes = hidden.reduce((n, g) => n + g.credits.length, 0);
  const moreLabel =
    hidden.length === 1
      ? `See 1 more show`
      : `See ${hidden.length} more shows`;

  return (
    <div>
      {visible.map((group) => (
        <div
          key={group.podcast.id}
          className="border-b border-white/10 last:border-0"
        >
          <div className="flex items-baseline justify-between gap-4 px-5 sm:px-6 pt-5 pb-2">
            <h3 className="min-w-0 text-[15px] font-semibold tracking-tight">
              <Link
                href={`/podcasts/${group.podcast.slug}`}
                className="text-white hover:text-[#007AFF] transition-colors"
              >
                {group.podcast.title}
              </Link>
            </h3>
            <span className="shrink-0 text-[13px] text-white/45">
              {group.credits.length} episode
              {group.credits.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul>
            {group.credits.map((c, i) =>
              c.work.kind === "episode" ? (
                <li
                  key={`${c.role_id}-${c.work.episode.id}-${i}`}
                  className="border-t border-white/10"
                >
                  <Link
                    href={`/podcasts/${c.work.podcast.slug}/${c.work.episode.slug}`}
                    className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 px-5 sm:px-6 py-3.5 group"
                  >
                    <span className="sm:w-32 shrink-0 text-[14px] tabular-nums text-white/55">
                      {formatDate(c.work.episode.published_at) ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-white group-hover:text-[#007AFF] transition-colors">
                      {c.work.episode.title}
                    </span>
                    <span className="sm:w-36 shrink-0 text-[14px] text-white/65 sm:text-right">
                      {roleLine(c)}
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        </div>
      ))}
      {hidden.length > 0 ? (
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={false}
          className="w-full py-4 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
        >
          {moreLabel}
          {hiddenEpisodes > 0 ? (
            <span className="text-white/45">
              {` · ${hiddenEpisodes} episode${hiddenEpisodes === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

export function CreditsTable({ credits }: { credits: CreditOnWork[] }) {
  const [filter, setFilter] = useState("all");
  const [expandedShows, setExpandedShows] = useState(false);

  const filmography = useMemo(
    () => buildShowFilmography(credits),
    [credits]
  );
  const episodeCredits = useMemo(
    () => newestFirst(credits.filter((c) => c.work.kind === "episode")),
    [credits]
  );

  const chips = chipsForCredits(credits);

  const visibleShows =
    filter === "all"
      ? filmography
      : filmography.filter((row) =>
          row.role_ids.some((id) => matchesRoleFilter(id, filter))
        );
  const visibleEpisodes =
    filter === "all"
      ? episodeCredits
      : episodeCredits.filter((c) => matchesRoleFilter(c.role_id, filter));

  const grouped = useMemo(
    () =>
      visibleEpisodes.length >= LONG_EPISODE_LIST
        ? groupEpisodeCreditsByShow(visibleEpisodes)
        : null,
    [visibleEpisodes]
  );

  const hasShows = filmography.length > 0;

  return (
    <div className="mt-16">
      <RoleChips
        chips={chips}
        filter={filter}
        onChange={(id) => {
          setFilter(id);
          setExpandedShows(false);
        }}
      />

      {hasShows ? (
        <section id="shows" className="scroll-mt-28">
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">Shows</h2>
          <Card className="mt-6 overflow-hidden">
            {visibleShows.length === 0 ? (
              <p className="px-6 py-10 text-[15px] text-white/45">
                No shows in this role.
              </p>
            ) : (
              <ShowFilmography rows={visibleShows} />
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
          ) : grouped ? (
            <GroupedEpisodeList
              groups={grouped}
              collapsed={!expandedShows}
              onExpand={() => setExpandedShows(true)}
            />
          ) : (
            <EpisodeTable credits={visibleEpisodes} />
          )}
        </Card>
      </section>
    </div>
  );
}
