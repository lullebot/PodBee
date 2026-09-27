/**
 * Long-tail catalog: pure helpers for the open Podcast Index (~4.7M feeds).
 *
 * The long tail is never copied into Supabase. Show and episode pages for
 * feeds outside the curated catalog are rendered on demand from the Podcast
 * Index API and cached (see src/lib/long-tail.ts). This module holds the
 * side-effect-free parts — slugs, auth, response mapping, search merging —
 * so they can be unit tested without Next.js or network access.
 *
 * Design + free-tier math: docs/FULL_CATALOG.md
 */

import { createHash } from "node:crypto";
import type { EpisodeCard, EpisodeType } from "@/lib/types";
import { searchNameRank, type PodcastSearchHit } from "@/lib/search-hits";

/** Long-tail show slugs look like `pi-920666-hardcore-history`. */
const PODCAST_SLUG_RE = /^pi-(\d{1,12})(?:-[a-z0-9-]*)?$/;
/** Long-tail episode slugs look like `16795090-the-destroyer-of-worlds`. */
const EPISODE_SLUG_RE = /^(\d{1,15})(?:-[a-z0-9-]*)?$/;

const SLUG_TITLE_MAX = 60;
const DESCRIPTION_MAX = 3000;
const EPISODE_DESCRIPTION_MAX = 4000;
const GENRE_CHIP_MAX = 4;

// ---------------------------------------------------------------------------
// Podcast Index API response shapes (only the fields PodBee reads).
// https://podcastindex-org.github.io/docs-api/
// ---------------------------------------------------------------------------

export type PiFeed = {
  id: number;
  title?: string | null;
  url?: string | null;
  originalUrl?: string | null;
  link?: string | null;
  description?: string | null;
  author?: string | null;
  ownerName?: string | null;
  image?: string | null;
  artwork?: string | null;
  language?: string | null;
  explicit?: boolean | number | null;
  dead?: number | null;
  episodeCount?: number | null;
  newestItemPubdate?: number | null;
  categories?: Record<string, string> | null;
};

export type PiEpisode = {
  id: number;
  title?: string | null;
  description?: string | null;
  datePublished?: number | null;
  duration?: number | null;
  explicit?: number | null;
  episode?: number | null;
  episodeType?: string | null;
  season?: number | null;
  image?: string | null;
  feedImage?: string | null;
  feedId?: number | null;
  feedTitle?: string | null;
  enclosureUrl?: string | null;
};

// ---------------------------------------------------------------------------
// View models — trimmed before caching so each cache entry stays small
// (Vercel meters cache reads/writes in 8 KB units).
// ---------------------------------------------------------------------------

export type IndexPodcast = {
  feed_id: number;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  language: string | null;
  explicit: boolean;
  episode_count: number | null;
  latest_published_at: string | null;
  genres: string[];
  /** Feed URLs (current + original) — used only to detect catalog promotion. */
  feed_urls: string[];
};

export type IndexEpisodeSummary = {
  id: number;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
  season_number: number | null;
  episode_type: EpisodeType;
  /** Null when identical to the show cover (saves cache bytes). */
  cover_image_url: string | null;
};

export type IndexEpisode = IndexEpisodeSummary & {
  feed_id: number;
  feed_title: string | null;
  description: string | null;
  explicit: boolean;
  enclosure_url: string | null;
};

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

export function slugifyTitle(value: string | null | undefined): string {
  const base = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= SLUG_TITLE_MAX) return base;
  return base.slice(0, SLUG_TITLE_MAX).replace(/-[^-]*$/, "").replace(/-+$/, "");
}

export function indexPodcastSlug(feedId: number, title?: string | null): string {
  const tail = slugifyTitle(title);
  return tail ? `pi-${feedId}-${tail}` : `pi-${feedId}`;
}

/** Feed id for a long-tail show slug, or null for anything else. */
export function parseIndexPodcastSlug(slug: string): number | null {
  const match = PODCAST_SLUG_RE.exec(slug);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function indexEpisodeSlug(episodeId: number, title?: string | null): string {
  const tail = slugifyTitle(title);
  return tail ? `${episodeId}-${tail}` : String(episodeId);
}

export function parseIndexEpisodeSlug(slug: string): number | null {
  const match = EPISODE_SLUG_RE.exec(slug);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// ---------------------------------------------------------------------------
// Auth — Amazon-style: sha1(key + secret + unixSeconds), lowercase hex.
// ---------------------------------------------------------------------------

export function podcastIndexAuthHeaders(
  apiKey: string,
  apiSecret: string,
  userAgent: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Record<string, string> {
  const date = String(Math.floor(nowSeconds));
  const token = createHash("sha1")
    .update(`${apiKey}${apiSecret}${date}`, "utf8")
    .digest("hex");
  return {
    "User-Agent": userAgent,
    "X-Auth-Key": apiKey,
    "X-Auth-Date": date,
    Authorization: token,
  };
}

// ---------------------------------------------------------------------------
// Text + URL cleanup
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Feed HTML → plain text for React to render (React still escapes it). */
export function htmlToText(
  html: string | null | undefined,
  max: number = DESCRIPTION_MAX
): string | null {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value ? decodeEntities(value).replace(/\s+/g, " ").trim() : "";
  return text || null;
}

function httpUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** Comparable form of a feed URL: no scheme, lowercase host, no trailing slash. */
export function normalizeFeedUrl(value: string | null | undefined): string | null {
  const url = httpUrl(value);
  if (!url) return null;
  const withoutScheme = url.replace(/^https?:\/\//i, "");
  const slash = withoutScheme.indexOf("/");
  const host = (slash === -1 ? withoutScheme : withoutScheme.slice(0, slash)).toLowerCase();
  const path = slash === -1 ? "" : withoutScheme.slice(slash);
  return `${host}${path}`.replace(/\/+$/, "");
}

/**
 * Exact-string variants of a feed URL (http/https, trailing slash) so a plain
 * `rss_url IN (…)` lookup can find the catalog row without a functional index.
 */
export function feedUrlVariants(urls: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    const normalized = normalizeFeedUrl(raw);
    if (!normalized || /["\\]/.test(normalized)) continue;
    const original = raw!.trim();
    out.add(original);
    for (const scheme of ["https://", "http://"]) {
      out.add(`${scheme}${normalized}`);
      out.add(`${scheme}${normalized}/`);
    }
  }
  return [...out];
}

function unixToIso(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function positiveInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function episodeType(value: string | null | undefined): EpisodeType {
  return value === "trailer" || value === "bonus" ? value : "full";
}

function genreNames(categories: PiFeed["categories"]): string[] {
  if (!categories || typeof categories !== "object") return [];
  const names: string[] = [];
  for (const name of Object.values(categories)) {
    const clean = typeof name === "string" ? name.trim() : "";
    if (clean && !names.includes(clean)) names.push(clean);
    if (names.length >= GENRE_CHIP_MAX) break;
  }
  return names;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** PI returns `feed: []` (not null) for unknown ids — treat anything id-less as missing. */
export function isPiFeed(value: unknown): value is PiFeed {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "number"
  );
}

export function toIndexPodcast(feed: PiFeed): IndexPodcast | null {
  const title = cleanText(feed.title);
  if (!title || !Number.isSafeInteger(feed.id) || feed.id <= 0) return null;
  const author = cleanText(feed.author) ?? cleanText(feed.ownerName);
  return {
    feed_id: feed.id,
    slug: indexPodcastSlug(feed.id, title),
    title,
    author: author && author.toLowerCase() !== title.toLowerCase() ? author : null,
    description: htmlToText(feed.description, DESCRIPTION_MAX),
    cover_image_url: httpUrl(feed.artwork) ?? httpUrl(feed.image),
    website_url: httpUrl(feed.link),
    language: cleanText(feed.language),
    explicit: feed.explicit === true || feed.explicit === 1,
    episode_count: positiveInt(feed.episodeCount),
    latest_published_at: unixToIso(feed.newestItemPubdate),
    genres: genreNames(feed.categories),
    feed_urls: [httpUrl(feed.url), httpUrl(feed.originalUrl)].filter(
      (u, i, all): u is string => u != null && all.indexOf(u) === i
    ),
  };
}

export function toIndexEpisodeSummary(
  item: PiEpisode,
  showCover: string | null
): IndexEpisodeSummary | null {
  const title = cleanText(item.title);
  if (!title || !Number.isSafeInteger(item.id) || item.id <= 0) return null;
  const cover = httpUrl(item.image) ?? httpUrl(item.feedImage);
  return {
    id: item.id,
    title,
    published_at: unixToIso(item.datePublished),
    duration_seconds: positiveInt(item.duration),
    episode_number: positiveInt(item.episode),
    season_number: positiveInt(item.season),
    episode_type: episodeType(item.episodeType),
    cover_image_url: cover && cover !== showCover ? cover : null,
  };
}

export function toIndexEpisode(item: PiEpisode): IndexEpisode | null {
  const summary = toIndexEpisodeSummary(item, null);
  if (!summary || !positiveInt(item.feedId)) return null;
  return {
    ...summary,
    cover_image_url: httpUrl(item.image) ?? httpUrl(item.feedImage),
    feed_id: item.feedId!,
    feed_title: cleanText(item.feedTitle),
    description: htmlToText(item.description, EPISODE_DESCRIPTION_MAX),
    explicit: item.explicit === 1,
    enclosure_url: httpUrl(item.enclosureUrl),
  };
}

/** Adapt long-tail episodes to the catalog's EpisodeCard so EpisodeList renders them as-is. */
export function indexEpisodeCards(
  podcast: IndexPodcast,
  episodes: IndexEpisodeSummary[]
): EpisodeCard[] {
  return episodes.map((ep) => ({
    id: `pi-ep-${ep.id}`,
    episode_slug: indexEpisodeSlug(ep.id, ep.title),
    episode_title: ep.title,
    episode_number: ep.episode_number,
    episode_type: ep.episode_type,
    duration_seconds: ep.duration_seconds,
    published_at: ep.published_at,
    episode_cover_url: ep.cover_image_url,
    podcast_id: `pi-${podcast.feed_id}`,
    podcast_slug: podcast.slug,
    podcast_title: podcast.title,
    podcast_cover_url: podcast.cover_image_url,
    season_number: ep.season_number,
    season_title: null,
  }));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** One PI search result → the same row shape as a catalog podcast hit. */
export function toPodcastSearchHit(feed: PiFeed): PodcastSearchHit | null {
  if (feed.dead === 1) return null;
  if (feed.episodeCount != null && feed.episodeCount <= 0) return null;
  const podcast = toIndexPodcast(feed);
  if (!podcast) return null;
  return {
    kind: "podcast",
    id: `pi-${podcast.feed_id}`,
    slug: podcast.slug,
    title: podcast.title,
    cover_image_url: podcast.cover_image_url,
    rating_average: null,
    genre_name: podcast.genres[0] ?? null,
    episode_count: podcast.episode_count,
    network_name: podcast.author,
    feed_urls: podcast.feed_urls,
    source: "index",
  };
}

/**
 * Catalog hits first on ties; long-tail hits fill the rest. Index hits whose
 * feed is already in the catalog are dropped so a show never appears twice.
 */
export function mergePodcastHits(
  catalog: PodcastSearchHit[],
  index: PodcastSearchHit[],
  term: string,
  limit: number
): PodcastSearchHit[] {
  const known = new Set<string>();
  for (const hit of catalog) {
    for (const url of hit.feed_urls ?? []) {
      const key = normalizeFeedUrl(url);
      if (key) known.add(key);
    }
  }

  const seen = new Set(catalog.map((h) => h.id));
  const fresh: PodcastSearchHit[] = [];
  for (const hit of index) {
    if (seen.has(hit.id)) continue;
    const keys = (hit.feed_urls ?? [])
      .map((u) => normalizeFeedUrl(u))
      .filter((k): k is string => k != null);
    if (keys.some((k) => known.has(k))) continue;
    seen.add(hit.id);
    for (const k of keys) known.add(k);
    fresh.push(hit);
  }

  const order = new Map<string, number>();
  [...catalog, ...fresh].forEach((hit, i) => order.set(hit.id, i));
  return [...catalog, ...fresh]
    .sort((a, b) => {
      const ra = searchNameRank(a.title, term);
      const rb = searchNameRank(b.title, term);
      if (ra !== rb) return ra - rb;
      const ia = a.source === "index" ? 1 : 0;
      const ib = b.source === "index" ? 1 : 0;
      if (ia !== ib) return ia - ib;
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    })
    .slice(0, limit);
}
