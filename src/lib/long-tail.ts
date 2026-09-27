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
  type RatedIndexEpisode,
} from "@/lib/podcast-index";

/** Overridable for local mocks/tests only. */
const API_BASE =
  process.env.PODCAST_INDEX_API_BASE?.trim() || "https://api.podcastindex.org/api/1.0";
const USER_AGENT = "PodBee/1.0 (+https://podbee.vercel.app; structured podcast database)";
const TIMEOUT_MS = 4000;
const SEARCH_MIN_CHARS = 3; // 2-char typeahead prefixes return noise and burn API calls
const SEARCH_MAX = 20;
// Deep enough that "Oldest" / "Top rated" cover the whole back catalog of most
// shows (~60 KB trimmed per cache entry; fine at PodBee's traffic).
const EPISODES_MAX = 300;
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

async function loadRatedEpisodes(podcastId: string): Promise<RatedIndexEpisode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select(
      "podcast_index_id, slug, title, published_at, duration_seconds, episode_type, cover_image_url, avg_rating, rating_count"
    )
    .eq("podcast_id", podcastId)
    .not("podcast_index_id", "is", null)
    .limit(1000);
  if (error || !data) return [];
  return (data as Array<RatedIndexEpisode & { avg_rating: number | string | null }>).map((row) => ({
    ...row,
    podcast_index_id: row.podcast_index_id == null ? null : Number(row.podcast_index_id),
    avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
  }));
}

export type LongTailResult<T> =
  | { kind: "page"; data: T }
  | { kind: "redirect"; href: string }
  | null;

export type LongTailPodcastDetail = {
  podcast: IndexPodcast;
  episodes: IndexEpisodeSummary[];
  /** Supabase row + crowd score once someone has rated or listed the show. */
  score: LongTailShowScore | null;
  /** Episodes of this show that have Supabase rows (rated or listed). */
  rated_episodes: RatedIndexEpisode[];
};

export type LongTailEpisodeScore = {
  id: string;
  avg_rating: number | null;
  rating_count: number;
};

export type LongTailEpisodeDetail = {
  podcast: IndexPodcast;
  episode: IndexEpisode;
  /** Supabase row + crowd score once someone has rated or listed the episode. */
  score: LongTailEpisodeScore | null;
};

/** Title (for metadata) of a long-tail show slug; shares the page's cached read. */
export async function getLongTailPodcastTitle(slug: string): Promise<string | null> {
  const feedId = parseIndexPodcastSlug(slug);
  return feedId ? ((await loadFeed(feedId))?.title ?? null) : null;
}

/** Live Podcast Index data for server actions (same cached reads as the pages). */
export async function loadLongTailPodcast(feedId: number): Promise<IndexPodcast | null> {
  return loadFeed(feedId);
}

export async function loadLongTailEpisode(
  feedId: number,
  episodeId: number
): Promise<{ podcast: IndexPodcast; episode: IndexEpisode } | null> {
  const [podcast, episode] = await Promise.all([loadFeed(feedId), loadEpisode(episodeId)]);
  if (!podcast || !episode || episode.feed_id !== feedId) return null;
  return { podcast, episode };
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

  const [episodes, score, rated_episodes] = await Promise.all([
    loadFeedEpisodes(podcast),
    row ? loadShowScore(row.id) : Promise.resolve(null),
    row ? loadRatedEpisodes(row.id) : Promise.resolve([]),
  ]);
  return { kind: "page", data: { podcast, episodes, score, rated_episodes } };
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

async function findEpisodeRow(
  episodeId: number
): Promise<{ id: string; slug: string; podcast_id: string; avg_rating: number | null; rating_count: number } | null> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, slug, podcast_id, avg_rating, rating_count")
    .eq("podcast_index_id", episodeId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; slug: string; podcast_id: string; avg_rating: number | string | null; rating_count: number };
  return { ...row, avg_rating: row.avg_rating == null ? null : Number(row.avg_rating) };
}

/** Resolve `/podcasts/{showSlug}/{episodeSlug}` for a pi- show slug. */
export async function getLongTailEpisode(
  showSlug: string,
  episodeSlug: string
): Promise<LongTailResult<LongTailEpisodeDetail>> {
  const feedId = parseIndexPodcastSlug(showSlug);
  const episodeId = parseIndexEpisodeSlug(episodeSlug);
  if (!feedId || !episodeId) return null;

  const loaded = await loadLongTailEpisode(feedId, episodeId);
  if (!loaded) return null;
  const { podcast, episode } = loaded;

  const [row, epRow] = await Promise.all([
    findPodcastRow(feedId, podcast.feed_urls),
    findEpisodeRow(episodeId),
  ]);

  if (row && !isLongTailRow(row.slug)) {
    // Promoted: land on the catalog episode (by PI id, else enclosure URL), else the show.
    let epSlug = epRow?.podcast_id === row.id ? epRow.slug : null;
    if (!epSlug && episode.enclosure_url) {
      const { data } = await supabase
        .from("episodes")
        .select("slug")
        .eq("podcast_id", row.id)
        .eq("audio_url", episode.enclosure_url)
        .limit(1)
        .maybeSingle();
      epSlug = (data as { slug?: string } | null)?.slug ?? null;
    }
    return {
      kind: "redirect",
      href: epSlug ? `/podcasts/${row.slug}/${epSlug}` : `/podcasts/${row.slug}`,
    };
  }

  const canonicalShow = indexPodcastSlug(podcast.feed_id, podcast.title);
  const canonicalEpisode = indexEpisodeSlug(episode.id, episode.title);
  if (showSlug !== canonicalShow || episodeSlug !== canonicalEpisode) {
    return { kind: "redirect", href: `/podcasts/${canonicalShow}/${canonicalEpisode}` };
  }

  const score = epRow
    ? { id: epRow.id, avg_rating: epRow.avg_rating, rating_count: epRow.rating_count }
    : null;
  return { kind: "page", data: { podcast, episode, score } };
}
