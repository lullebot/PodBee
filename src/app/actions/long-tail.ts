"use server";

import { createClient } from "@/lib/supabase/server";
import {
  loadLongTailPodcast,
  longTailSigningSecret,
  resolveFeedShow,
  type FeedShowRef,
} from "@/lib/long-tail";
import {
  longTailShowPayload,
  signLongTailPayload,
  type LongTailPayloadBody,
} from "@/lib/podcast-index";
import { feedEpisodePayload, feedEpisodeSlug } from "@/lib/feed-episodes";
import { getFeedEpisode } from "@/lib/show-episodes";
import { upsertEpisodeRating, upsertPodcastRating } from "@/app/actions/ratings";
import { toggleListenListEpisode, toggleListenListShow } from "@/app/actions/listen-list";

/**
 * Shows and episodes that aren't in the database yet get a row the first time
 * a signed-in user rates, reviews, or lists them: long-tail shows (live from
 * Podcast Index) and any episode read from a show's RSS feed. The row's data
 * is loaded on this server (never taken from the browser) and HMAC-signed so
 * the database can tell it apart from anything a client could send to the
 * RPC directly. See supabase/migrations/20260927150000_long_tail_ratings.sql.
 */

/** Expected failures, shown to the user as-is (other errors get a generic message). */
class ActionError extends Error {}

type ActionResult = void | { error: string };

async function run(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    console.warn("[long-tail] action failed:", (error as Error).message);
    return { error: "Could not save — please try again." };
  }
}

function assertId(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new ActionError(`Invalid ${what}.`);
}

// Checked before a row is created so a bad rating never leaves one behind.
function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new ActionError("Rating must be a whole number from 1 to 10.");
  }
}

async function requireUser(message: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionError(message);
  return supabase;
}

async function materialize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rpc: "ensure_podcast_row" | "ensure_episode_row",
  body: LongTailPayloadBody
): Promise<string> {
  const secret = longTailSigningSecret();
  if (!secret) throw new ActionError("Ratings for this show aren't available yet.");
  const { payload, signature } = signLongTailPayload(body, secret);
  const { data, error } = await supabase.rpc(rpc, { payload, signature });
  if (error || typeof data !== "string") {
    console.warn(`[long-tail] ${rpc} failed:`, error?.message);
    throw new ActionError("Could not save — please try again.");
  }
  return data;
}

async function showRow(feedId: number, message: string) {
  assertId(feedId, "show");
  const supabase = await requireUser(message);
  const podcast = await loadLongTailPodcast(feedId);
  if (!podcast) throw new ActionError("This show is unavailable right now.");
  const podcastId = await materialize(supabase, "ensure_podcast_row", {
    kind: "podcast",
    show: longTailShowPayload(podcast),
  });
  return { podcastId, slug: podcast.slug };
}

async function episodeRow(ref: FeedShowRef, key: string, message: string) {
  if (!/^[0-9a-f]{12}$/.test(key)) throw new ActionError("Invalid episode.");
  const supabase = await requireUser(message);
  const show = await resolveFeedShow(ref);
  const episode = show ? await getFeedEpisode(show.feed_url, key) : null;
  if (!show || !episode) throw new ActionError("This episode is unavailable right now.");
  const payload = feedEpisodePayload(episode, show.cover_image_url);
  const body: LongTailPayloadBody = show.index_podcast
    ? { kind: "episode", show: longTailShowPayload(show.index_podcast), episode: payload }
    : { kind: "episode", podcast_id: show.row_id!, episode: payload };
  const id = await materialize(supabase, "ensure_episode_row", body);
  return { episodeId: id, showSlug: show.slug, episodeSlug: feedEpisodeSlug(key, episode.title) };
}

export async function rateLongTailPodcast(
  feedId: number,
  rating: number,
  reviewText: string | null
): Promise<ActionResult> {
  return run(async () => {
    assertRating(rating);
    const row = await showRow(feedId, "Sign in to rate this show.");
    await upsertPodcastRating(row.podcastId, row.slug, rating, reviewText);
  });
}

export async function toggleLongTailListenListShow(
  feedId: number,
  wasInList: boolean
): Promise<ActionResult> {
  return run(async () => {
    const row = await showRow(feedId, "Sign in to use your Listen List.");
    await toggleListenListShow(row.podcastId, row.slug, wasInList);
  });
}

/** Rate any episode read from a show's RSS feed (catalog or long-tail show). */
export async function rateFeedEpisode(
  ref: FeedShowRef,
  key: string,
  rating: number,
  reviewText: string | null
): Promise<ActionResult> {
  return run(async () => {
    assertRating(rating);
    const row = await episodeRow(ref, key, "Sign in to rate this episode.");
    await upsertEpisodeRating(row.episodeId, row.showSlug, row.episodeSlug, rating, reviewText);
  });
}

export async function toggleFeedEpisodeListenList(
  ref: FeedShowRef,
  key: string,
  wasInList: boolean
): Promise<ActionResult> {
  return run(async () => {
    const row = await episodeRow(ref, key, "Sign in to use your Listen List.");
    await toggleListenListEpisode(row.episodeId, row.showSlug, row.episodeSlug, wasInList);
  });
}
