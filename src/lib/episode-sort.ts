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
