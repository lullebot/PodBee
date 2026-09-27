/**
 * Long-tail catalog loaders (server only).
 *
 * Every Podcast Index feed gets a PodBee page without a Supabase row:
 * `/podcasts/pi-{feedId}-{title}` renders live from the Podcast Index API.
 * Responses are trimmed and cached with `unstable_cache` — NOT fetch caching:
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
  indexPodcastSlug,
  isPiFeed,
  parseIndexEpisodeSlug,
  parseIndexPodcastSlug,
  podcastIndexAuthHeaders,
  toIndexEpisode,
  toIndexEpisodeSummary,
  toIndexPodcast,
  toPodcastSearchHit,
  indexEpisodeSlug,
  type IndexEpisode,
  type IndexEpisodeSummary,
  type IndexPodcast,
  type PiEpisode,
} from "@/lib/podcast-index";

/** Overridable for local mocks/tests only. */
const API_BASE =
  process.env.PODCAST_INDEX_API_BASE?.trim() || "https://api.podcastindex.org/api/1.0";
const USER_AGENT = "PodBee/1.0 (+https://podbee.vercel.app; structured podcast database)";
const TIMEOUT_MS = 4000;
const SEARCH_MIN_CHARS = 3; // 2-char typeahead prefixes return noise and burn API calls
const SEARCH_MAX = 20;
const EPISODES_MAX = 25; // ≈5 KB trimmed → one 8 KB cache unit; matches the catalog page preview
const CACHE_TAG = "podcast-index";

/** Seconds. Long enough that bots and repeat views cost cache reads, not API calls. */
const REVALIDATE_SEARCH = 86400;
const REVALIDATE_FEED = 43200;
const REVALIDATE_EPISODE = 604800;

function credentials(): { key: string; secret: string } | null {
  const key = process.env.PODCAST_INDEX_API_KEY?.trim();
  const secret = process.env.PODCAST_INDEX_API_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

export function longTailEnabled(): boolean {
  return credentials() != null;
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

const cachedFeedEpisodes = unstable_cache(
  async (feedId: number, showCover: string | null): Promise<IndexEpisodeSummary[]> => {
    const data = (await piGet("/episodes/byfeedid", {
      id: String(feedId),
      max: String(EPISODES_MAX),
    })) as { items?: unknown };
    const items = Array.isArray(data.items) ? (data.items as PiEpisode[]) : [];
    return items.flatMap((item) => {
      const ep = toIndexEpisodeSummary(item, showCover);
      return ep ? [ep] : [];
    });
  },
  ["pi-feed-episodes-v1"],
  { revalidate: REVALIDATE_FEED, tags: [CACHE_TAG] }
);

const cachedEpisode = unstable_cache(
  async (episodeId: number): Promise<IndexEpisode | null> => {
    const data = (await piGet("/episodes/byid", {
      id: String(episodeId),
      fulltext: "",
    })) as { episode?: unknown };
    const ep = data.episode;
    if (typeof ep !== "object" || ep === null || Array.isArray(ep)) return null;
    return toIndexEpisode(ep as PiEpisode);
  },
  ["pi-episode-v1"],
  { revalidate: REVALIDATE_EPISODE, tags: [CACHE_TAG] }
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

async function loadFeedEpisodes(podcast: IndexPodcast): Promise<IndexEpisodeSummary[]> {
  try {
    return await cachedFeedEpisodes(podcast.feed_id, podcast.cover_image_url);
  } catch (error) {
    console.warn("[long-tail] episodes failed:", (error as Error).message);
    return [];
  }
}

const loadEpisode = cache(async (episodeId: number): Promise<IndexEpisode | null> => {
  if (!longTailEnabled()) return null;
  try {
    return await cachedEpisode(episodeId);
  } catch (error) {
    console.warn("[long-tail] episode failed:", (error as Error).message);
    return null;
  }
});

/** Catalog slug for a feed that has since been promoted into Supabase. */
async function findCatalogSlug(feedUrls: string[]): Promise<{ id: string; slug: string } | null> {
  const variants = feedUrlVariants(feedUrls);
  if (variants.length === 0) return null;
  const { data } = await supabase
    .from("podcasts")
    .select("id, slug")
    .in("rss_url", variants)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; slug: string } | null) ?? null;
}

export type LongTailResult<T> =
  | { kind: "page"; data: T }
  | { kind: "redirect"; href: string }
  | null;

export type LongTailPodcastDetail = {
  podcast: IndexPodcast;
  episodes: IndexEpisodeSummary[];
};

export type LongTailEpisodeDetail = {
  podcast: IndexPodcast;
  episode: IndexEpisode;
};

/** Title (for metadata) of a long-tail show slug; shares the page's cached read. */
export async function getLongTailPodcastTitle(slug: string): Promise<string | null> {
  const feedId = parseIndexPodcastSlug(slug);
  return feedId ? ((await loadFeed(feedId))?.title ?? null) : null;
}

/**
 * Resolve `/podcasts/{slug}` when the slug isn't a catalog show:
 * promoted feed → catalog page; wrong title in slug → canonical slug; else live page.
 */
export async function getLongTailPodcast(
  slug: string
): Promise<LongTailResult<LongTailPodcastDetail>> {
  const feedId = parseIndexPodcastSlug(slug);
  if (!feedId) return null;
  const podcast = await loadFeed(feedId);
  if (!podcast) return null;

  const promoted = await findCatalogSlug(podcast.feed_urls);
  if (promoted) return { kind: "redirect", href: `/podcasts/${promoted.slug}` };
  if (slug !== podcast.slug) {
    return { kind: "redirect", href: `/podcasts/${podcast.slug}` };
  }

  const episodes = await loadFeedEpisodes(podcast);
  return { kind: "page", data: { podcast, episodes } };
}

export async function getLongTailEpisodeTitle(
  showSlug: string,
  episodeSlug: string
): Promise<string | null> {
  const feedId = parseIndexPodcastSlug(showSlug);
  const episodeId = parseIndexEpisodeSlug(episodeSlug);
  if (!feedId || !episodeId) return null;
  const episode = await loadEpisode(episodeId);
  return episode?.feed_id === feedId ? episode.title : null;
}

/** Resolve `/podcasts/{showSlug}/{episodeSlug}` for a long-tail show. */
export async function getLongTailEpisode(
  showSlug: string,
  episodeSlug: string
): Promise<LongTailResult<LongTailEpisodeDetail>> {
  const feedId = parseIndexPodcastSlug(showSlug);
  const episodeId = parseIndexEpisodeSlug(episodeSlug);
  if (!feedId || !episodeId) return null;

  const [podcast, episode] = await Promise.all([loadFeed(feedId), loadEpisode(episodeId)]);
  if (!podcast || !episode || episode.feed_id !== feedId) return null;

  const promoted = await findCatalogSlug(podcast.feed_urls);
  if (promoted) {
    const match = episode.enclosure_url
      ? await supabase
          .from("episodes")
          .select("slug")
          .eq("podcast_id", promoted.id)
          .eq("audio_url", episode.enclosure_url)
          .limit(1)
          .maybeSingle()
      : { data: null };
    const epSlug = (match.data as { slug?: string } | null)?.slug;
    return {
      kind: "redirect",
      href: epSlug ? `/podcasts/${promoted.slug}/${epSlug}` : `/podcasts/${promoted.slug}`,
    };
  }

  const canonicalShow = indexPodcastSlug(podcast.feed_id, podcast.title);
  const canonicalEpisode = indexEpisodeSlug(episode.id, episode.title);
  if (showSlug !== canonicalShow || episodeSlug !== canonicalEpisode) {
    return { kind: "redirect", href: `/podcasts/${canonicalShow}/${canonicalEpisode}` };
  }

  return { kind: "page", data: { podcast, episode } };
}
