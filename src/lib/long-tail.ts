/**
 * Long-tail catalog loaders (server only).
 *
 * Every Podcast Index feed gets a PodBee page without a Supabase row:
 * `/podcasts/pi-{feedId}-{title}` renders show metadata live from the Podcast
 * Index API and every episode from the show's own RSS feed (show-episodes.ts).
 * PI responses are trimmed and cached with `unstable_cache` — NOT fetch caching:
 * PI auth headers carry a per-second timestamp and Next.js includes headers in
 * the fetch cache key, so a cached `fetch` would never hit.
 *
 * Disabled (search stays catalog-only, pi- slugs show the not-found state)
 * unless PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET are set server-side.
 * Never expose them as NEXT_PUBLIC_*. Design: docs/FULL_CATALOG.md
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { PodcastSearchHit } from "@/lib/search-hits";
import {
  feedUrlVariants,
  isPiFeed,
  parseIndexPodcastSlug,
  podcastIndexAuthHeaders,
  toIndexPodcast,
  toPodcastSearchHit,
  type IndexPodcast,
} from "@/lib/podcast-index";
import { feedEpisodeSlug, parseFeedEpisodeSlug, type FeedEpisode } from "@/lib/feed-episodes";
import {
  findEpisodeRow,
  getFeedEpisode,
  getFeedEpisodeDescription,
  loadShowEpisodes,
} from "@/lib/show-episodes";
import type { EpisodeCard } from "@/lib/types";

/** Overridable for local mocks/tests only. */
const API_BASE =
  process.env.PODCAST_INDEX_API_BASE?.trim() || "https://api.podcastindex.org/api/1.0";
const USER_AGENT = "PodBee/1.0 (+https://podbee.vercel.app; structured podcast database)";
const TIMEOUT_MS = 4000;
const SEARCH_MIN_CHARS = 3; // 2-char typeahead prefixes return noise and burn API calls
const SEARCH_MAX = 20;
const CACHE_TAG = "podcast-index";

/** Seconds. Long enough that bots and repeat views cost cache reads, not API calls. */
const REVALIDATE_SEARCH = 86400;
const REVALIDATE_FEED = 43200;

function credentials(): { key: string; secret: string } | null {
  const key = process.env.PODCAST_INDEX_API_KEY?.trim();
  const secret = process.env.PODCAST_INDEX_API_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

export function longTailEnabled(): boolean {
  return credentials() != null;
}

/** HMAC secret shared with Supabase Vault — signs long-tail row payloads. */
export function longTailSigningSecret(): string | null {
  const secret = process.env.LONG_TAIL_SIGNING_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

/** Ratings/reviews/Listen List on long-tail pages (needs PI + the signing secret). */
export function longTailRatingsEnabled(): boolean {
  return longTailEnabled() && longTailSigningSecret() != null;
}

/**
 * Long-tail pages are noindex by default so crawlers can't walk 4.7M URLs
 * through the Hobby function/cache quota. Flip with PODBEE_LONG_TAIL_INDEXABLE=1.
 */
export function longTailIndexable(): boolean {
  return process.env.PODBEE_LONG_TAIL_INDEXABLE === "1";
}

/** Throws on transport/HTTP errors so unstable_cache never stores a failure. */
async function piGet(path: string, params: Record<string, string>): Promise<unknown> {
  const creds = credentials();
  if (!creds) throw new Error("Podcast Index credentials not configured");
  const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    headers: podcastIndexAuthHeaders(creds.key, creds.secret, USER_AGENT),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Podcast Index ${path} → HTTP ${response.status}`);
  }
  return response.json();
}

const cachedSearch = unstable_cache(
  async (term: string): Promise<PodcastSearchHit[]> => {
    const data = (await piGet("/search/byterm", {
      q: term,
      max: String(SEARCH_MAX),
    })) as { feeds?: unknown };
    const feeds = Array.isArray(data.feeds) ? data.feeds : [];
    return feeds.flatMap((feed) => {
      const hit = isPiFeed(feed) ? toPodcastSearchHit(feed) : null;
      return hit ? [hit] : [];
    });
  },
  ["pi-search-v1"],
  { revalidate: REVALIDATE_SEARCH, tags: [CACHE_TAG] }
);

const cachedFeed = unstable_cache(
  async (feedId: number): Promise<IndexPodcast | null> => {
    const data = (await piGet("/podcasts/byfeedid", { id: String(feedId) })) as {
      feed?: unknown;
    };
    return isPiFeed(data.feed) ? toIndexPodcast(data.feed) : null;
  },
  ["pi-feed-v1"],
  { revalidate: REVALIDATE_FEED, tags: [CACHE_TAG] }
);

/** Long-tail podcast hits for a search term; [] when disabled or PI is down. */
export async function searchLongTailPodcasts(term: string): Promise<PodcastSearchHit[]> {
  const key = term.trim().toLowerCase().replace(/\s+/g, " ");
  if (!longTailEnabled() || key.length < SEARCH_MIN_CHARS) return [];
  try {
    return await cachedSearch(key);
  } catch (error) {
    console.warn("[long-tail] search failed:", (error as Error).message);
    return [];
  }
}

const loadFeed = cache(async (feedId: number): Promise<IndexPodcast | null> => {
  if (!longTailEnabled()) return null;
  try {
    return await cachedFeed(feedId);
  } catch (error) {
    console.warn("[long-tail] feed failed:", (error as Error).message);
    return null;
  }
});

function isLongTailRow(slug: string): boolean {
  return parseIndexPodcastSlug(slug) != null;
}

/**
 * Supabase row for a feed: either a promoted catalog show (pipeline slug) or
 * the long-tail row created when someone first rated/listed it (pi- slug).
 */
async function findPodcastRow(
  feedId: number,
  feedUrls: string[]
): Promise<{ id: string; slug: string } | null> {
  // Errors (e.g. podcast_index_id not migrated yet) fall through to the URL match.
  const byId = await supabase
    .from("podcasts")
    .select("id, slug")
    .eq("podcast_index_id", feedId)
    .limit(1)
    .maybeSingle();
  if (!byId.error && byId.data) return byId.data as { id: string; slug: string };

  const variants = feedUrlVariants(feedUrls);
  if (variants.length === 0) return null;
  const { data } = await supabase
    .from("podcasts")
    .select("id, slug")
    .in("rss_url", variants)
    .limit(5);
  const rows = (data ?? []) as Array<{ id: string; slug: string }>;
  // A pipeline catalog row wins over a long-tail row for the same feed.
  return rows.find((r) => !isLongTailRow(r.slug)) ?? rows[0] ?? null;
}

export type LongTailShowScore = {
  id: string;
  display_score: number | null;
  display_count: number | null;
};

async function loadShowScore(podcastId: string): Promise<LongTailShowScore | null> {
  const { data } = await supabase
    .from("podcasts_display")
    .select("id, display_score, display_count")
    .eq("id", podcastId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; display_score: number | string | null; display_count: number | null };
  return {
    id: row.id,
    display_score: row.display_score == null ? null : Number(row.display_score),
    display_count: row.display_count,
  };
}

export type LongTailResult<T> =
  | { kind: "page"; data: T }
  | { kind: "redirect"; href: string }
  | null;

export type LongTailPodcastDetail = {
  podcast: IndexPodcast;
  /** Every episode: the show's RSS feed merged with its rated/listed rows. */
  cards: EpisodeCard[];
  feedLoaded: boolean;
  /** Supabase row + crowd score once someone has rated or listed the show. */
  score: LongTailShowScore | null;
};

/** Title (for metadata) of a long-tail show slug; shares the page's cached read. */
export async function getLongTailPodcastTitle(slug: string): Promise<string | null> {
  const feedId = parseIndexPodcastSlug(slug);
  return feedId ? ((await loadFeed(feedId))?.title ?? null) : null;
}

/** Live Podcast Index show data for server actions (same cached read as the pages). */
export async function loadLongTailPodcast(feedId: number): Promise<IndexPodcast | null> {
  return loadFeed(feedId);
}

/**
 * Resolve `/podcasts/{slug}` for a pi- slug:
 * promoted feed → catalog page; wrong title in slug → canonical slug; else live page
 * (with crowd ratings from the long-tail row, if one exists).
 */
export async function getLongTailPodcast(
  slug: string
): Promise<LongTailResult<LongTailPodcastDetail>> {
  const feedId = parseIndexPodcastSlug(slug);
  if (!feedId) return null;
  const podcast = await loadFeed(feedId);
  if (!podcast) return null;

  const row = await findPodcastRow(feedId, podcast.feed_urls);
  if (row && !isLongTailRow(row.slug)) {
    return { kind: "redirect", href: `/podcasts/${row.slug}` };
  }
  if (slug !== podcast.slug) {
    return { kind: "redirect", href: `/podcasts/${podcast.slug}` };
  }

  const [episodes, score] = await Promise.all([
    loadShowEpisodes(
      {
        podcast_id: row?.id ?? `pi-${podcast.feed_id}`,
        slug: podcast.slug,
        title: podcast.title,
        cover_image_url: podcast.cover_image_url,
      },
      podcast.feed_urls[0],
      row?.id ?? null
    ),
    row ? loadShowScore(row.id) : Promise.resolve(null),
  ]);
  return {
    kind: "page",
    data: { podcast, cards: episodes.cards, feedLoaded: episodes.feedLoaded, score },
  };
}

// ---------------------------------------------------------------------------
// Feed episodes (`e-{key}-{title}` slugs) — on catalog and long-tail shows
// ---------------------------------------------------------------------------

/** Which show a feed episode belongs to — passed (bound) to the rating actions. */
export type FeedShowRef = { podcastId: string } | { feedId: number };

export type FeedEpisodeShow = {
  ref: FeedShowRef;
  slug: string;
  title: string;
  cover_image_url: string | null;
  feed_url: string | null;
  /** Supabase row id, if the show has one (catalog show, or rated long-tail show). */
  row_id: string | null;
  /** Present for long-tail shows — the payload the signed RPC needs. */
  index_podcast: IndexPodcast | null;
};

const CATALOG_SHOW_COLUMNS = "id, slug, title, cover_image_url, rss_url";

async function catalogShow(
  column: "slug" | "id",
  value: string
): Promise<FeedEpisodeShow | null> {
  const { data } = await supabase
    .from("podcasts")
    .select(CATALOG_SHOW_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    slug: string;
    title: string;
    cover_image_url: string | null;
    rss_url: string | null;
  };
  return {
    ref: { podcastId: row.id },
    slug: row.slug,
    title: row.title,
    cover_image_url: row.cover_image_url,
    feed_url: row.rss_url,
    row_id: row.id,
    index_podcast: null,
  };
}

async function longTailShow(podcast: IndexPodcast, rowId: string | null): Promise<FeedEpisodeShow> {
  return {
    ref: { feedId: podcast.feed_id },
    slug: podcast.slug,
    title: podcast.title,
    cover_image_url: podcast.cover_image_url,
    feed_url: podcast.feed_urls[0] ?? null,
    row_id: rowId,
    index_podcast: podcast,
  };
}

/** Resolve a show for a feed-episode action (the ref comes from the browser — re-check it). */
export async function resolveFeedShow(ref: FeedShowRef): Promise<FeedEpisodeShow | null> {
  if ("podcastId" in ref) {
    if (!/^[0-9a-f-]{36}$/i.test(ref.podcastId)) return null;
    return catalogShow("id", ref.podcastId);
  }
  if (!Number.isSafeInteger(ref.feedId) || ref.feedId <= 0) return null;
  const podcast = await loadFeed(ref.feedId);
  if (!podcast) return null;
  const row = await findPodcastRow(ref.feedId, podcast.feed_urls);
  // Promoted since the page rendered: act on the catalog row.
  if (row && !isLongTailRow(row.slug)) return catalogShow("id", row.id);
  return longTailShow(podcast, row?.id ?? null);
}

export type FeedEpisodeScore = {
  id: string;
  avg_rating: number | null;
  rating_count: number;
};

export type FeedEpisodeDetail = {
  show: FeedEpisodeShow;
  episode: FeedEpisode;
  description: string | null;
  /** Supabase row + crowd score once someone has rated or listed the episode. */
  score: FeedEpisodeScore | null;
};

/** Title (for metadata) of a feed episode page. */
export async function getFeedEpisodeTitle(
  showSlug: string,
  episodeSlug: string
): Promise<string | null> {
  const key = parseFeedEpisodeSlug(episodeSlug);
  if (!key) return null;
  const show = await showForSlug(showSlug);
  if (!show || show.kind !== "show") return null;
  return (await getFeedEpisode(show.show.feed_url, key))?.title ?? null;
}

const showForSlug = cache(
  async (
    showSlug: string
  ): Promise<{ kind: "show"; show: FeedEpisodeShow } | { kind: "redirect"; slug: string } | null> => {
    const feedId = parseIndexPodcastSlug(showSlug);
    if (feedId && longTailEnabled()) {
      const podcast = await loadFeed(feedId);
      if (podcast) {
        const row = await findPodcastRow(feedId, podcast.feed_urls);
        if (row && !isLongTailRow(row.slug)) return { kind: "redirect", slug: row.slug };
        if (showSlug !== podcast.slug) return { kind: "redirect", slug: podcast.slug };
        return { kind: "show", show: await longTailShow(podcast, row?.id ?? null) };
      }
    }
    const show = await catalogShow("slug", showSlug);
    return show ? { kind: "show", show } : null;
  }
);

/**
 * Resolve `/podcasts/{showSlug}/e-{key}-{title}` on any show: the episode comes
 * from the show's RSS feed. If the pipeline has a full catalog row for it, go
 * there (credits, etc.); otherwise render live with its crowd score.
 */
export async function getFeedEpisodePage(
  showSlug: string,
  episodeSlug: string
): Promise<LongTailResult<FeedEpisodeDetail>> {
  const key = parseFeedEpisodeSlug(episodeSlug);
  if (!key) return null;
  const resolved = await showForSlug(showSlug);
  if (!resolved) return null;
  if (resolved.kind === "redirect") {
    return { kind: "redirect", href: `/podcasts/${resolved.slug}/${episodeSlug}` };
  }
  const { show } = resolved;
  const episode = await getFeedEpisode(show.feed_url, key);
  if (!episode) return null;

  const row = show.row_id ? await findEpisodeRow(show.row_id, episode) : null;
  if (row && parseFeedEpisodeSlug(row.slug) == null) {
    return { kind: "redirect", href: `/podcasts/${show.slug}/${row.slug}` };
  }
  const canonical = feedEpisodeSlug(episode.key, episode.title);
  if (episodeSlug !== canonical) {
    return { kind: "redirect", href: `/podcasts/${show.slug}/${canonical}` };
  }

  const description = await getFeedEpisodeDescription(show.feed_url, key);
  const score = row
    ? { id: row.id, avg_rating: row.avg_rating, rating_count: row.rating_count }
    : null;
  return { kind: "page", data: { show, episode, description, score } };
}
