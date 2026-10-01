import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EpisodeCardRow } from "@/components/podcast/EpisodeCardRow";
import {
  EPISODE_SORTS,
  episodeListHref,
  type EpisodeListView,
} from "@/lib/episode-sort";

/**
 * Every episode of a show, sorted and paged on the server (a show can have
 * thousands — only the current page is sent to the browser). Sort, season,
 * and page are URL params so any view is linkable.
 */
export function EpisodeList({
  view,
  basePath,
  note,
}: {
  view: EpisodeListView;
  basePath: string;
  /** Shown when the full list couldn't be loaded (e.g. the feed is down). */
  note?: string | null;
}) {
  const { cards, query, filteredTotal, seasons, pageCount, start, end } = view;
  const ratingSort = query.sort === "top" || query.sort === "lowest";
  const href = (patch: Partial<typeof query>) =>
    episodeListHref(basePath, { ...query, page: 1, ...patch });

  return (
    <section id="episodes" className="mt-16 scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Episodes</h2>
        <span className="text-[13px] text-white/45 tabular-nums">
          {filteredTotal > 0
            ? `${start.toLocaleString()}–${end.toLocaleString()} of ${filteredTotal.toLocaleString()}`
            : "0 episodes"}
        </span>
      </div>

      {view.total > 1 ? (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Sort episodes">
          {EPISODE_SORTS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              active={query.sort === option.id}
              href={href({ sort: option.id })}
            />
          ))}
        </nav>
      ) : null}

      {ratingSort && !view.hasRated ? (
        <p className="mt-3 text-[13px] text-white/45">
          No episode ratings yet — open an episode to rate it.
        </p>
      ) : null}

      {seasons.length > 0 ? (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Filter by season">
          <Chip label="All" active={query.season == null} href={href({ season: null })} />
          {seasons.map((n) => (
            <Chip
              key={n}
              label={`S${n}`}
              active={query.season === n}
              href={href({ season: n })}
            />
          ))}
        </nav>
      ) : null}

      {note ? <p className="mt-3 text-[13px] text-white/45">{note}</p> : null}

      <Card className="mt-6 px-6 sm:px-8">
        {cards.length === 0 ? (
          <p className="py-10 text-[15px] text-white/45">
            {view.total === 0
              ? "No episodes found yet."
              : "No episodes from this season."}
          </p>
        ) : (
          cards.map((card) => <EpisodeCardRow key={card.id} card={card} />)
        )}
      </Card>

      {pageCount > 1 ? (
        <nav
          className="mt-5 flex items-center justify-between text-[15px] font-medium"
          aria-label="Episode pages"
        >
          {query.page > 1 ? (
            <Link
              href={episodeListHref(basePath, { ...query, page: query.page - 1 })}
              className="text-[#007AFF] hover:opacity-80"
            >
              ← Previous page
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-white/45 tabular-nums">
            Page {query.page.toLocaleString()} of {pageCount.toLocaleString()}
          </span>
          {query.page < pageCount ? (
            <Link
              href={episodeListHref(basePath, { ...query, page: query.page + 1 })}
              className="text-[#007AFF] hover:opacity-80"
            >
              Next page →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function Chip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-[#007AFF] border border-[#007AFF] text-white"
          : "border border-white/20 bg-white/5 text-white/80 hover:border-[#007AFF]"
      }`}
    >
      {label}
    </Link>
  );
}
