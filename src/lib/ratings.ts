import { createClient } from "@/lib/supabase/server";
import type {
  EpisodeRating,
  EpisodeReview,
  PodcastRating,
  PodcastReview,
  Profile,
  RatedEpisodeSummary,
  RatedPodcastSummary,
} from "@/lib/types";

export async function getMyPodcastRating(
  userId: string,
  podcastId: string
): Promise<Pick<PodcastRating, "rating" | "review_text"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("podcast_ratings")
    .select("rating, review_text")
    .eq("user_id", userId)
    .eq("podcast_id", podcastId)
    .maybeSingle();
  return data;
}

export async function getMyEpisodeRating(
  userId: string,
  episodeId: string
): Promise<Pick<EpisodeRating, "rating" | "review_text"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("episode_ratings")
    .select("rating, review_text")
    .eq("user_id", userId)
    .eq("episode_id", episodeId)
    .maybeSingle();
  return data;
}

async function attachProfiles<T extends { user_id: string }>(
  rows: T[]
): Promise<(T & { profile: Pick<Profile, "username" | "display_name"> | null })[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
}

/** Reviews (rating rows with review_text) for a show — RLS already scopes rows to reviewed-or-own. */
export async function getPodcastReviews(podcastId: string): Promise<PodcastReview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("podcast_ratings")
    .select("user_id, podcast_id, rating, review_text, created_at, updated_at")
    .eq("podcast_id", podcastId)
    .not("review_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  return attachProfiles((data ?? []) as PodcastRating[]);
}

export async function getEpisodeReviews(episodeId: string): Promise<EpisodeReview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("episode_ratings")
    .select("user_id, episode_id, rating, review_text, created_at, updated_at")
    .eq("episode_id", episodeId)
    .not("review_text", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  return attachProfiles((data ?? []) as EpisodeRating[]);
}

/** "Your Ratings" tab — every show the signed-in user has rated, own score always visible. */
export async function getMyRatedPodcasts(userId: string): Promise<RatedPodcastSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("podcast_ratings")
    .select("rating, review_text, updated_at, podcasts(id, slug, title, cover_image_url)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    rating: number;
    review_text: string | null;
    updated_at: string;
    podcasts: RatedPodcastSummary["podcast"] | null;
  }>)
    .filter((row) => row.podcasts != null)
    .map((row) => ({
      podcast: row.podcasts!,
      rating: row.rating,
      review_text: row.review_text,
      updated_at: row.updated_at,
    }));
}

export async function getMyRatedEpisodes(userId: string): Promise<RatedEpisodeSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("episode_ratings")
    .select(
      "rating, review_text, updated_at, episodes(id, slug, title, cover_image_url, podcast_id, podcasts(slug, title))"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    rating: number;
    review_text: string | null;
    updated_at: string;
    episodes:
      | (RatedEpisodeSummary["episode"] & {
          podcasts: RatedEpisodeSummary["podcast"] | null;
        })
      | null;
  }>)
    .filter((row) => row.episodes?.podcasts != null)
    .map((row) => ({
      episode: row.episodes!,
      podcast: row.episodes!.podcasts!,
      rating: row.rating,
      review_text: row.review_text,
      updated_at: row.updated_at,
    }));
}
