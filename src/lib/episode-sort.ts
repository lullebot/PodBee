import type { EpisodeCard } from "@/lib/types";

/** Title-page episode orderings. Rating sorts keep unrated episodes last. */
export type EpisodeSort = "newest" | "oldest" | "top" | "lowest";

export const EPISODE_SORTS: ReadonlyArray<{ id: EpisodeSort; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "top", label: "Top rated" },
  { id: "lowest", label: "Lowest rated" },
];

function time(card: EpisodeCard): number | null {
  if (!card.published_at) return null;
  const t = Date.parse(card.published_at);
  return Number.isNaN(t) ? null : t;
}

function score(card: EpisodeCard): number | null {
  return (card.rating_count ?? 0) > 0 && card.avg_rating != null ? Number(card.avg_rating) : null;
}

/** Newest first; undated episodes last. */
function byNewest(a: EpisodeCard, b: EpisodeCard): number {
  const ta = time(a);
  const tb = time(b);
  if (ta == null || tb == null) return ta == null ? (tb == null ? 0 : 1) : -1;
  return tb - ta;
}

export function sortEpisodeCards(cards: EpisodeCard[], sort: EpisodeSort): EpisodeCard[] {
  const list = cards.slice();
  if (sort === "newest") return list.sort(byNewest);
  if (sort === "oldest") {
    return list.sort((a, b) => {
      const ta = time(a);
      const tb = time(b);
      if (ta == null || tb == null) return ta == null ? (tb == null ? 0 : 1) : -1;
      return ta - tb;
    });
  }
  const direction = sort === "top" ? -1 : 1;
  return list.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa == null || sb == null) {
      if (sa == null && sb == null) return byNewest(a, b);
      return sa == null ? 1 : -1;
    }
    if (sa !== sb) return direction * (sa - sb);
    // Same score: more votes first, then newest.
    const ca = a.rating_count ?? 0;
    const cb = b.rating_count ?? 0;
    if (ca !== cb) return cb - ca;
    return byNewest(a, b);
  });
}

/** Whether any card has a crowd score (rating sorts are pointless otherwise). */
export function hasRatedEpisodes(cards: EpisodeCard[]): boolean {
  return cards.some((c) => score(c) != null);
}

// ---------------------------------------------------------------------------
// Server-side list view: every episode is sorted/filtered on the server and
// only one page is sent to the browser (a show can have thousands).
// ---------------------------------------------------------------------------

export const EPISODE_PAGE_SIZE = 50;

export type EpisodeQuery = {
  sort: EpisodeSort;
  season: number | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEpisodeQuery(params: SearchParams | undefined): EpisodeQuery {
  const rawSort = first(params?.sort);
  const sort = EPISODE_SORTS.some((s) => s.id === rawSort) ? (rawSort as EpisodeSort) : "newest";
  const rawSeason = Number(first(params?.season));
  const rawPage = Number(first(params?.page));
  return {
    sort,
    season: Number.isSafeInteger(rawSeason) && rawSeason > 0 ? rawSeason : null,
    page: Number.isSafeInteger(rawPage) && rawPage > 1 ? rawPage : 1,
  };
}

export function episodeListHref(basePath: string, query: EpisodeQuery): string {
  const params = new URLSearchParams();
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.season != null) params.set("season", String(query.season));
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}#episodes`;
}

export type EpisodeListView = {
  /** Only the current page. */
  cards: EpisodeCard[];
  query: EpisodeQuery;
  /** All episodes of the show. */
  total: number;
  /** After the season filter. */
  filteredTotal: number;
  seasons: number[];
  pageCount: number;
  /** 1-based positions of the first/last card on this page (0 when empty). */
  start: number;
  end: number;
  hasRated: boolean;
};

export function episodeListView(
  all: EpisodeCard[],
  query: EpisodeQuery,
  pageSize: number = EPISODE_PAGE_SIZE
): EpisodeListView {
  const seasons = [
    ...new Set(
      all.map((c) => c.season_number).filter((n): n is number => n != null && n > 0)
    ),
  ].sort((a, b) => a - b);
  const season = query.season != null && seasons.includes(query.season) ? query.season : null;
  const filtered = sortEpisodeCards(
    season == null ? all : all.filter((c) => c.season_number === season),
    query.sort
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(query.page, pageCount);
  const offset = (page - 1) * pageSize;
  const cards = filtered.slice(offset, offset + pageSize);
  return {
    cards,
    query: { sort: query.sort, season, page },
    total: all.length,
    filteredTotal: filtered.length,
    seasons,
    pageCount,
    start: cards.length > 0 ? offset + 1 : 0,
    end: offset + cards.length,
    hasRated: hasRatedEpisodes(filtered),
  };
}
