"use server";

import { createClient } from "@/lib/supabase/server";
import { loadLongTailEpisode, loadLongTailPodcast, longTailSigningSecret } from "@/lib/long-tail";
import {
  indexEpisodeSlug,
  longTailEpisodePayload,
  longTailShowPayload,
  signLongTailPayload,
  type LongTailPayloadBody,
} from "@/lib/podcast-index";
import { upsertEpisodeRating, upsertPodcastRating } from "@/app/actions/ratings";
import { toggleListenListEpisode, toggleListenListShow } from "@/app/actions/listen-list";

/**
 * Long-tail shows/episodes get a Supabase row the first time a signed-in user
 * rates, reviews, or lists them. The row's data comes from Podcast Index on
 * this server (never from the browser) and is HMAC-signed so the database can
 * tell it apart from anything a client could send to the RPC directly.
 * See supabase/migrations/20260927150000_long_tail_ratings.sql.
 */

function assertId(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${what}.`);
}

// Checked before a row is created so a bad rating never leaves one behind.
function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("Rating must be a whole number from 1 to 10.");
  }
}

async function requireUser(message: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(message);
  return supabase;
}

async function materialize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rpc: "materialize_index_podcast" | "materialize_index_episode",
  body: LongTailPayloadBody
): Promise<string> {
  const secret = longTailSigningSecret();
  if (!secret) throw new Error("Ratings for this show aren't available yet.");
  const { payload, signature } = signLongTailPayload(body, secret);
  const { data, error } = await supabase.rpc(rpc, { payload, signature });
  if (error || typeof data !== "string") {
    console.warn(`[long-tail] ${rpc} failed:`, error?.message);
    throw new Error("Could not save — please try again.");
  }
  return data;
}

async function showRow(feedId: number, message: string) {
  assertId(feedId, "show");
  const supabase = await requireUser(message);
  const podcast = await loadLongTailPodcast(feedId);
  if (!podcast) throw new Error("This show is unavailable right now.");
  const podcastId = await materialize(supabase, "materialize_index_podcast", {
    kind: "podcast",
    show: longTailShowPayload(podcast),
  });
  return { podcastId, slug: podcast.slug };
}

async function episodeRow(feedId: number, episodeId: number, message: string) {
  assertId(feedId, "show");
  assertId(episodeId, "episode");
  const supabase = await requireUser(message);
  const loaded = await loadLongTailEpisode(feedId, episodeId);
  if (!loaded) throw new Error("This episode is unavailable right now.");
  const id = await materialize(supabase, "materialize_index_episode", {
    kind: "episode",
    show: longTailShowPayload(loaded.podcast),
    episode: longTailEpisodePayload(loaded.episode),
  });
  return {
    episodeId: id,
    showSlug: loaded.podcast.slug,
    episodeSlug: indexEpisodeSlug(loaded.episode.id, loaded.episode.title),
  };
}

export async function rateLongTailPodcast(
  feedId: number,
  rating: number,
  reviewText: string | null
) {
  assertRating(rating);
  const row = await showRow(feedId, "Sign in to rate this show.");
  await upsertPodcastRating(row.podcastId, row.slug, rating, reviewText);
}

export async function toggleLongTailListenListShow(feedId: number, wasInList: boolean) {
  const row = await showRow(feedId, "Sign in to use your Listen List.");
  await toggleListenListShow(row.podcastId, row.slug, wasInList);
}

export async function rateLongTailEpisode(
  feedId: number,
  episodeId: number,
  rating: number,
  reviewText: string | null
) {
  assertRating(rating);
  const row = await episodeRow(feedId, episodeId, "Sign in to rate this episode.");
  await upsertEpisodeRating(row.episodeId, row.showSlug, row.episodeSlug, rating, reviewText);
}

export async function toggleLongTailListenListEpisode(
  feedId: number,
  episodeId: number,
  wasInList: boolean
) {
  const row = await episodeRow(feedId, episodeId, "Sign in to use your Listen List.");
  await toggleListenListEpisode(row.episodeId, row.showSlug, row.episodeSlug, wasInList);
}
