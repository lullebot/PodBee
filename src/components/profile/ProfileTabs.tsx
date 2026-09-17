"use client";

import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { formatDate } from "@/lib/format";
import type {
  ListenListEpisodeSummary,
  ListenListShowSummary,
  RatedEpisodeSummary,
  RatedPodcastSummary,
} from "@/lib/types";

type Tab = "ratings" | "listen-list";

export function ProfileTabs({
  ratedPodcasts,
  ratedEpisodes,
  listenListShows,
  listenListEpisodes,
}: {
  ratedPodcasts: RatedPodcastSummary[];
  ratedEpisodes: RatedEpisodeSummary[];
  listenListShows: ListenListShowSummary[];
  listenListEpisodes: ListenListEpisodeSummary[];
}) {
  const [tab, setTab] = useState<Tab>("ratings");
  const ratingsCount = ratedPodcasts.length + ratedEpisodes.length;
  const listenListCount = listenListShows.length + listenListEpisodes.length;

  return (
    <div className="mt-10">
      <div className="flex gap-6 border-b border-white/10 text-[15px] font-medium">
        <button
          type="button"
          onClick={() => setTab("ratings")}
          className={`-mb-px border-b-2 pb-3 transition-colors ${
            tab === "ratings"
              ? "border-[#007AFF] text-white"
              : "border-transparent text-white/45 hover:text-white/70"
          }`}
        >
          Your Ratings ({ratingsCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("listen-list")}
          className={`-mb-px border-b-2 pb-3 transition-colors ${
            tab === "listen-list"
              ? "border-[#007AFF] text-white"
              : "border-transparent text-white/45 hover:text-white/70"
          }`}
        >
          Your Listen List ({listenListCount})
        </button>
      </div>

      {tab === "ratings" ? (
        <div className="mt-6">
          {ratingsCount === 0 ? (
            <p className="text-[14px] text-white/45">
              No ratings yet — rate a show or episode to see it here.
            </p>
          ) : (
            <ul>
              {ratedPodcasts.map((r) => (
                <li key={r.podcast.id}>
                  <RatingRow
                    href={`/podcasts/${r.podcast.slug}`}
                    title={r.podcast.title}
                    cover={r.podcast.cover_image_url}
                    kind="Show"
                    rating={r.rating}
                    hasReview={Boolean(r.review_text)}
                    updatedAt={r.updated_at}
                  />
                </li>
              ))}
              {ratedEpisodes.map((r) => (
                <li key={r.episode.id}>
                  <RatingRow
                    href={`/podcasts/${r.podcast.slug}/${r.episode.slug}`}
                    title={r.episode.title}
                    subtitle={r.podcast.title}
                    cover={r.episode.cover_image_url}
                    kind="Episode"
                    rating={r.rating}
                    hasReview={Boolean(r.review_text)}
                    updatedAt={r.updated_at}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {listenListCount === 0 ? (
            <p className="text-[14px] text-white/45">
              Your Listen List is empty — add a show or episode to see it here.
            </p>
          ) : (
            <ul>
              {listenListShows.map((item) => (
                <li key={item.podcast.id}>
                  <ListenListRow
                    href={`/podcasts/${item.podcast.slug}`}
                    title={item.podcast.title}
                    cover={item.podcast.cover_image_url}
                    kind="Show"
                    addedAt={item.added_at}
                  />
                </li>
              ))}
              {listenListEpisodes.map((item) => (
                <li key={item.episode.id}>
                  <ListenListRow
                    href={`/podcasts/${item.podcast.slug}/${item.episode.slug}`}
                    title={item.episode.title}
                    subtitle={item.podcast.title}
                    cover={item.episode.cover_image_url}
                    kind="Episode"
                    addedAt={item.added_at}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RatingRow({
  href,
  title,
  subtitle,
  cover,
  kind,
  rating,
  hasReview,
  updatedAt,
}: {
  href: string;
  title: string;
  subtitle?: string;
  cover: string | null;
  kind: "Show" | "Episode";
  rating: number;
  hasReview: boolean;
  updatedAt: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 py-4 border-b border-white/10 last:border-0 group"
    >
      <Cover src={cover} alt={title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium uppercase tracking-wide text-white/40">
          {kind}
        </p>
        <p className="text-[16px] font-semibold text-white truncate group-hover:text-[#007AFF] transition-colors">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-white/55 truncate">{subtitle}</p>
        ) : null}
        <p className="mt-0.5 text-[12px] text-white/40">
          {hasReview ? "Reviewed" : "Rating only"} · {formatDate(updatedAt)}
        </p>
      </div>
      <div className="shrink-0 text-[17px] font-semibold tabular-nums text-white">
        {rating}/10
      </div>
    </Link>
  );
}

function ListenListRow({
  href,
  title,
  subtitle,
  cover,
  kind,
  addedAt,
}: {
  href: string;
  title: string;
  subtitle?: string;
  cover: string | null;
  kind: "Show" | "Episode";
  addedAt: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 py-4 border-b border-white/10 last:border-0 group"
    >
      <Cover src={cover} alt={title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium uppercase tracking-wide text-white/40">
          {kind}
        </p>
        <p className="text-[16px] font-semibold text-white truncate group-hover:text-[#007AFF] transition-colors">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-white/55 truncate">{subtitle}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-[12px] text-white/40">Added {formatDate(addedAt)}</div>
    </Link>
  );
}
