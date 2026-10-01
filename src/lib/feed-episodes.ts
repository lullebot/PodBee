/**
 * Full episode lists from each show's public RSS feed — pure helpers.
 *
 * The database keeps rich rows (credits, seasons) for the newest episodes the
 * pipeline ingests (ops cap: 60/show), plus a row for any episode someone has
 * rated or listed. Everything else — e.g. all ~2,400 Joe Rogan episodes —
 * comes from the show's own RSS feed, parsed server-side and cached, then
 * merged with those rows so every show page lists every episode and "Top
 * rated" ranks across all of them. Podcast Index can't do this: its episode
 * API stops at the newest 1,000.
 */

import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { EpisodeCard, EpisodeType } from "@/lib/types";
import { htmlToText, slugifyTitle } from "@/lib/podcast-index";

/** Episodes kept per feed (newest first). ~200 B each keeps the cache entry < 2 MB. */
export const FEED_EPISODE_LIMIT = 8000;
const DESCRIPTION_MAX = 4000;

/** One RSS item, trimmed to what an episode list/page needs (no description). */
export type FeedEpisode = {
  /** 12-hex stable id: sha1 of guid (else enclosure URL, else title + date). */
  key: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
  season_number: number | null;
  episode_type: EpisodeType;
  explicit: boolean;
  audio_url: string | null;
  /** Null when identical to the channel artwork. */
  cover_image_url: string | null;
};

/** A database episode of the same show (pipeline row or rated/listed row). */
export type DbEpisode = {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
  season_number: number | null;
  episode_type: EpisodeType;
  cover_image_url: string | null;
  audio_url: string | null;
  feed_item_key: string | null;
  avg_rating: number | null;
  rating_count: number;
};

// ---------------------------------------------------------------------------
// Keys + slugs
// ---------------------------------------------------------------------------

const FEED_SLUG_RE = /^e-([0-9a-f]{12})(?:-[a-z0-9-]*)?$/;

export function feedEpisodeKey(
  guid: string | null,
  audioUrl: string | null,
  title: string,
  pubDate: string | null
): string {
  const basis = guid?.trim() || audioUrl?.trim() || `${title}|${pubDate ?? ""}`;
  return createHash("sha1").update(basis, "utf8").digest("hex").slice(0, 12);
}

/** `e-{key}-{title}` — never collides with pipeline slugs (plain title slugs). */
export function feedEpisodeSlug(key: string, title: string): string {
  const tail = slugifyTitle(title);
  return tail ? `e-${key}-${tail}` : `e-${key}`;
}

export function parseFeedEpisodeSlug(slug: string): string | null {
  return FEED_SLUG_RE.exec(slug)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  // Show notes are HTML; keep them as raw strings instead of parsing them as XML.
  stopNodes: ["*.description", "*.content:encoded", "*.itunes:summary"],
  isArray: (_name, jpath) => jpath === "rss.channel.item",
});

function text(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return text((value as Node)["#text"]);
  return null;
}

function attr(value: unknown, name: string): string | null {
  const node = Array.isArray(value) ? value[0] : value;
  if (!node || typeof node !== "object") return null;
  const raw = (node as Node)[`@_${name}`];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function httpUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

function cleanTitle(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const clean = htmlToText(raw, 500);
  return clean ? clean.replace(/\s+/g, " ").trim() : null;
}

/** "1:02:03", "62:03", "3723", "3723.4" → seconds. */
export function parseItunesDuration(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Math.round(Number(v));
    return n > 0 ? n : null;
  }
  const parts = v.split(":").map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) {
    return null;
  }
  const seconds = parts.reduce((total, p) => total * 60 + p, 0);
  return seconds > 0 ? Math.round(seconds) : null;
}

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

function episodeType(value: string | null): EpisodeType {
  const v = value?.toLowerCase();
  return v === "trailer" || v === "bonus" ? v : "full";
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function channelOf(xml: string): Node | null {
  const doc = parser.parse(xml) as Node;
  const rss = doc.rss as Node | undefined;
  const channel = rss?.channel;
  return channel && typeof channel === "object" ? (channel as Node) : null;
}

function itemKey(item: Node, title: string): string {
  return feedEpisodeKey(
    text(item.guid),
    httpUrl(attr(item.enclosure, "url")),
    title,
    text(item.pubDate)
  );
}

/** All episodes in an RSS feed, newest first (capped at FEED_EPISODE_LIMIT). */
export function parseFeedEpisodes(xml: string): FeedEpisode[] {
  const channel = channelOf(xml);
  if (!channel) throw new Error("not an RSS feed");
  const channelImage =
    httpUrl(attr(channel["itunes:image"], "href")) ??
    httpUrl(text((channel.image as Node | undefined)?.url));
  const items = Array.isArray(channel.item) ? (channel.item as Node[]) : [];

  const seen = new Set<string>();
  const episodes: FeedEpisode[] = [];
  for (const item of items) {
    const title = cleanTitle(item.title);
    if (!title) continue;
    const key = itemKey(item, title);
    if (seen.has(key)) continue;
    seen.add(key);
    const cover = httpUrl(attr(item["itunes:image"], "href"));
    const explicit = text(item["itunes:explicit"])?.toLowerCase();
    episodes.push({
      key,
      title,
      published_at: isoDate(text(item.pubDate)),
      duration_seconds: parseItunesDuration(text(item["itunes:duration"])),
      episode_number: positiveInt(text(item["itunes:episode"])),
      season_number: positiveInt(text(item["itunes:season"])),
      episode_type: episodeType(text(item["itunes:episodeType"])),
      explicit: explicit === "yes" || explicit === "true" || explicit === "explicit",
      audio_url: httpUrl(attr(item.enclosure, "url")),
      cover_image_url: cover && cover !== channelImage ? cover : null,
    });
  }

  episodes.sort((a, b) => {
    if (!a.published_at || !b.published_at) return a.published_at ? -1 : b.published_at ? 1 : 0;
    return b.published_at.localeCompare(a.published_at);
  });
  return episodes.slice(0, FEED_EPISODE_LIMIT);
}

/** Show notes for one episode (plain text), or null. */
export function parseFeedEpisodeDescription(xml: string, key: string): string | null {
  const channel = channelOf(xml);
  const items = Array.isArray(channel?.item) ? (channel!.item as Node[]) : [];
  for (const item of items) {
    const title = cleanTitle(item.title);
    if (!title || itemKey(item, title) !== key) continue;
    const raw =
      text(item["content:encoded"]) ?? text(item.description) ?? text(item["itunes:summary"]);
    // Stop nodes keep their raw markup, CDATA wrappers included.
    return htmlToText(raw?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"), DESCRIPTION_MAX);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Compact cache encoding (keeps big feeds under the 2 MB cache-entry limit)
// ---------------------------------------------------------------------------

type Packed = [
  string,
  string,
  number | null,
  number | null,
  number | null,
  number | null,
  0 | 1 | 2,
  0 | 1,
  string | null,
  string | null,
];
const TYPES: EpisodeType[] = ["full", "trailer", "bonus"];

export function packFeedEpisodes(episodes: FeedEpisode[]): Packed[] {
  return episodes.map((e) => [
    e.key,
    e.title,
    e.published_at ? Math.floor(Date.parse(e.published_at) / 1000) : null,
    e.duration_seconds,
    e.episode_number,
    e.season_number,
    TYPES.indexOf(e.episode_type) as 0 | 1 | 2,
    e.explicit ? 1 : 0,
    e.audio_url,
    e.cover_image_url,
  ]);
}

export function unpackFeedEpisodes(packed: Packed[]): FeedEpisode[] {
  return packed.map((p) => ({
    key: p[0],
    title: p[1],
    published_at: p[2] == null ? null : new Date(p[2] * 1000).toISOString(),
    duration_seconds: p[3],
    episode_number: p[4],
    season_number: p[5],
    episode_type: TYPES[p[6]] ?? "full",
    explicit: p[7] === 1,
    audio_url: p[8],
    cover_image_url: p[9],
  }));
}

// ---------------------------------------------------------------------------
// Merge feed + database episodes into one list of cards
// ---------------------------------------------------------------------------

export type ShowRefForCards = {
  podcast_id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
};

function score(row: DbEpisode | undefined) {
  return row && row.rating_count > 0 && row.avg_rating != null
    ? { avg_rating: Number(row.avg_rating), rating_count: row.rating_count }
    : { avg_rating: null, rating_count: row?.rating_count ?? 0 };
}

/** Enclosure URL without query/fragment — hosts add `?updated=…` that changes on re-publish. */
function audioBase(url: string | null): string | null {
  return url ? url.split(/[?#]/)[0].toLowerCase() : null;
}

function titleDayKey(title: string, publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return words ? `${publishedAt.slice(0, 10)}|${words}` : null;
}

/**
 * Finds a feed episode's database row. Same tiers as the database's
 * long_tail_upsert_episode: feed key → exact enclosure URL → enclosure URL
 * without query string → same title on the same day.
 */
export class DbEpisodeMatcher {
  private byKey = new Map<string, DbEpisode>();
  private byAudio = new Map<string, DbEpisode>();
  private byAudioBase = new Map<string, DbEpisode>();
  private byTitleDay = new Map<string, DbEpisode>();
  private used = new Set<string>();

  constructor(private rows: DbEpisode[]) {
    for (const row of rows) {
      if (row.feed_item_key) this.byKey.set(row.feed_item_key, row);
      const base = audioBase(row.audio_url);
      const td = titleDayKey(row.title, row.published_at);
      if (row.audio_url && !this.byAudio.has(row.audio_url)) this.byAudio.set(row.audio_url, row);
      if (base && !this.byAudioBase.has(base)) this.byAudioBase.set(base, row);
      if (td && !this.byTitleDay.has(td)) this.byTitleDay.set(td, row);
    }
  }

  /** The row for this feed episode (each row is handed out once). */
  match(ep: FeedEpisode): DbEpisode | undefined {
    const base = audioBase(ep.audio_url);
    const td = titleDayKey(ep.title, ep.published_at);
    for (const row of [
      this.byKey.get(ep.key),
      ep.audio_url ? this.byAudio.get(ep.audio_url) : undefined,
      base ? this.byAudioBase.get(base) : undefined,
      td ? this.byTitleDay.get(td) : undefined,
    ]) {
      if (!row || this.used.has(row.id)) continue;
      // A row already keyed to another feed item belongs to that item.
      if (row.feed_item_key && row.feed_item_key !== ep.key) continue;
      this.used.add(row.id);
      return row;
    }
    return undefined;
  }

  unmatched(): DbEpisode[] {
    return this.rows.filter((row) => !this.used.has(row.id));
  }
}

/**
 * Every episode of a show: each feed item, matched to its database row (see
 * DbEpisodeMatcher) for the rating and the catalog slug, plus any database
 * episodes no longer in the feed.
 */
export function mergeShowEpisodes(
  show: ShowRefForCards,
  feed: FeedEpisode[],
  db: DbEpisode[]
): EpisodeCard[] {
  const matcher = new DbEpisodeMatcher(db);
  const base = {
    podcast_id: show.podcast_id,
    podcast_slug: show.slug,
    podcast_title: show.title,
    podcast_cover_url: show.cover_image_url,
    season_title: null,
  };
  const cards: EpisodeCard[] = [];

  for (const ep of feed) {
    const row = matcher.match(ep);
    const cover = row?.cover_image_url ?? ep.cover_image_url;
    cards.push({
      ...base,
      id: row?.id ?? `feed-${ep.key}`,
      episode_slug: row?.slug ?? feedEpisodeSlug(ep.key, ep.title),
      episode_title: row?.title ?? ep.title,
      episode_number: row?.episode_number ?? ep.episode_number,
      episode_type: row?.episode_type ?? ep.episode_type,
      duration_seconds: row?.duration_seconds ?? ep.duration_seconds,
      published_at: row?.published_at ?? ep.published_at,
      episode_cover_url: cover && cover !== show.cover_image_url ? cover : null,
      season_number: row?.season_number ?? ep.season_number,
      ...score(row),
    });
  }

  for (const row of matcher.unmatched()) {
    cards.push({
      ...base,
      id: row.id,
      episode_slug: row.slug,
      episode_title: row.title,
      episode_number: row.episode_number,
      episode_type: row.episode_type,
      duration_seconds: row.duration_seconds,
      published_at: row.published_at,
      episode_cover_url:
        row.cover_image_url && row.cover_image_url !== show.cover_image_url
          ? row.cover_image_url
          : null,
      season_number: row.season_number,
      ...score(row),
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Signed payload for the ensure_episode_row RPC
// ---------------------------------------------------------------------------

export type FeedEpisodePayload = {
  key: string;
  slug: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  episode_type: EpisodeType;
  explicit: boolean;
  audio_url: string | null;
  cover_image_url: string | null;
};

export function feedEpisodePayload(ep: FeedEpisode, showCover: string | null): FeedEpisodePayload {
  return {
    key: ep.key,
    slug: feedEpisodeSlug(ep.key, ep.title),
    title: ep.title,
    published_at: ep.published_at,
    duration_seconds: ep.duration_seconds,
    episode_type: ep.episode_type,
    explicit: ep.explicit,
    audio_url: ep.audio_url,
    cover_image_url: ep.cover_image_url ?? showCover,
  };
}
