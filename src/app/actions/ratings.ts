"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function normalizeReview(reviewText: string | null): string | null {
  const trimmed = reviewText?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function assertValidRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("Rating must be a whole number from 1 to 10.");
  }
}

/**
 * Upsert a show rating. Bare number and number+review are the same
 * mutation — review_text is just an optional field. A blank review keeps
 * the rating anonymous (RLS-enforced), a non-empty one publishes it.
 */
export async function upsertPodcastRating(
  podcastId: string,
  podcastSlug: string,
  rating: number,
  reviewText: string | null
) {
  assertValidRating(rating);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to rate this show.");

  const { error } = await supabase.from("podcast_ratings").upsert(
    {
      user_id: user.id,
      podcast_id: podcastId,
      rating,
      review_text: normalizeReview(reviewText),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,podcast_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/podcasts/${podcastSlug}`);
}

export async function upsertEpisodeRating(
  episodeId: string,
  podcastSlug: string,
  episodeSlug: string,
  rating: number,
  reviewText: string | null
) {
  assertValidRating(rating);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to rate this episode.");

  const { error } = await supabase.from("episode_ratings").upsert(
    {
      user_id: user.id,
      episode_id: episodeId,
      rating,
      review_text: normalizeReview(reviewText),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,episode_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/podcasts/${podcastSlug}/${episodeSlug}`);
}
