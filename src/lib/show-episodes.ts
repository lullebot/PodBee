/**
 * Server loaders for full episode lists (catalog and long-tail shows alike).
 *
 * The show's RSS feed is fetched server-side, parsed, trimmed, and cached for
 * 12h (unstable_cache — a plain RSS fetch has no per-request auth headers,
 * but the parsed+packed result is far smaller than the raw XML). It's merged
 * with the show's database episodes so ratings and catalog pages line up.
 * Design: docs/FULL_CATALOG.md → "Every episode of every show".
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { EpisodeCard, EpisodeType } from "@/lib/types";
import {
  DbEpisodeMatcher,
  mergeShowEpisodes,
  packFeedEpisodes,
  parseFeedEpisodeDescription,
  parseFeedEpisodes,
  unpackFeedEpisodes,
  type DbEpisode,
  type FeedEpisode,
  type ShowRefForCards,
} from "@/lib/feed-episodes";

const USER_AGENT = "PodBee/1.0 (+https://podbee.vercel.app; structured podcast database)";
const FEED_TIMEOUT_MS = 20000;
const MAX_FEED_BYTES = 60 * 1024 * 1024;
const REVALIDATE_FEED = 43200;
const REVALIDATE_DESCRIPTION = 604800;
const DB_PAGE = 1000; // Supabase API max rows per request

function feedUrlOk(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

/** Throws on failure so unstable_cache never stores an error. */
async function fetchFeedXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`feed ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_FEED_BYTES) throw new Error(`feed too large (${length} bytes)`);
  const xml = await response.text();
  if (xml.length > MAX_FEED_BYTES) throw new Error("feed too large");
  return xml;
}

const cachedFeedEpisodes = unstable_cache(
  async (url: string) => packFeedEpisodes(parseFeedEpisodes(await fetchFeedXml(url))),
  ["feed-episodes-v1"],
  { revalidate: REVALIDATE_FEED, tags: ["feed-episodes"] }
);

const cachedFeedEpisodeDescription = unstable_cache(
  async (url: string, key: string) => parseFeedEpisodeDescription(await fetchFeedXml(url), key),
  ["feed-episode-description-v1"],
  { revalidate: REVALIDATE_DESCRIPTION, tags: ["feed-episodes"] }
);

/** Every episode in the show's feed (newest first), or null if it can't be loaded. */
export const getFeedEpisodes = cache(
  async (feedUrl: string | null | undefined): Promise<FeedEpisode[] | null> => {
    if (!feedUrlOk(feedUrl)) return null;
    try {
      return unpackFeedEpisodes(await cachedFeedEpisodes(feedUrl.trim()));
    } catch (error) {
      console.warn("[feed] episodes failed:", feedUrl, (error as Error).message);
      return null;
    }
  }
);

export async function getFeedEpisode(
  feedUrl: string | null | undefined,
  key: string
): Promise<FeedEpisode | null> {
  return (await getFeedEpisodes(feedUrl))?.find((e) => e.key === key) ?? null;
}

export async function getFeedEpisodeDescription(
  feedUrl: string | null | undefined,
  key: string
): Promise<string | null> {
  if (!feedUrlOk(feedUrl)) return null;
  try {
    return await cachedFeedEpisodeDescription(feedUrl.trim(), key);
  } catch (error) {
    console.warn("[feed] description failed:", feedUrl, (error as Error).message);
    return null;
  }
}

type DbEpisodeRow = Omit<DbEpisode, "season_number" | "feed_item_key" | "avg_rating"> & {
  feed_item_key?: string | null;
  avg_rating: number | string | null;
  seasons: { number: number | null } | { number: number | null }[] | null;
};

const DB_COLUMNS =
  "id, slug, title, published_at, duration_seconds, episode_number, episode_type, cover_image_url, audio_url, avg_rating, rating_count, seasons(number)";

/** All database episodes of a show, paged past the 1,000-row API limit. */
export async function loadDbEpisodes(podcastId: string): Promise<DbEpisode[]> {
  // feed_item_key arrives with the long-tail ratings migration; tolerate its absence.
  let columns = `${DB_COLUMNS}, feed_item_key`;
  const rows: DbEpisodeRow[] = [];
  for (let offset = 0; offset < 50 * DB_PAGE; offset += DB_PAGE) {
    let result = await supabase
      .from("episodes")
      .select(columns)
      .eq("podcast_id", podcastId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + DB_PAGE - 1);
    if (result.error && columns !== DB_COLUMNS) {
      columns = DB_COLUMNS;
      result = await supabase
        .from("episodes")
        .select(columns)
        .eq("podcast_id", podcastId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + DB_PAGE - 1);
    }
    const page = (result.data ?? []) as unknown as DbEpisodeRow[];
    rows.push(...page);
    if (page.length < DB_PAGE) break;
  }
  return rows.map((row) => {
    const season = Array.isArray(row.seasons) ? row.seasons[0] : row.seasons;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      published_at: row.published_at,
      duration_seconds: row.duration_seconds,
      episode_number: row.episode_number,
      season_number: season?.number ?? null,
      episode_type: (row.episode_type ?? "full") as EpisodeType,
      cover_image_url: row.cover_image_url,
      audio_url: row.audio_url,
      feed_item_key: row.feed_item_key ?? null,
      avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
      rating_count: row.rating_count ?? 0,
    };
  });
}

export type ShowEpisodes = {
  cards: EpisodeCard[];
  /** False when the feed couldn't be loaded — only database episodes are listed. */
  feedLoaded: boolean;
};

/** Every episode of a show: its RSS feed merged with its database rows (if any). */
export async function loadShowEpisodes(
  show: ShowRefForCards,
  feedUrl: string | null | undefined,
  podcastRowId: string | null
): Promise<ShowEpisodes> {
  const [feed, db] = await Promise.all([
    getFeedEpisodes(feedUrl),
    podcastRowId ? loadDbEpisodes(podcastRowId) : Promise.resolve([]),
  ]);
  return { cards: mergeShowEpisodes(show, feed ?? [], db), feedLoaded: feed != null };
}

/** Database row (pipeline or rated/listed) for a feed episode of this show — same matching as the list. */
export async function findEpisodeRow(
  podcastRowId: string,
  episode: FeedEpisode
): Promise<DbEpisode | null> {
  return new DbEpisodeMatcher(await loadDbEpisodes(podcastRowId)).match(episode) ?? null;
}
