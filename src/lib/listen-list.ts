import { createClient } from "@/lib/supabase/server";
import type {
  ListenListEpisodeSummary,
  ListenListShowSummary,
} from "@/lib/types";

export async function isInListenListShow(
  userId: string,
  podcastId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listen_list_shows")
    .select("podcast_id")
    .eq("user_id", userId)
    .eq("podcast_id", podcastId)
    .maybeSingle();
  return data != null;
}

export async function isInListenListEpisode(
  userId: string,
  episodeId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listen_list_episodes")
    .select("episode_id")
    .eq("user_id", userId)
    .eq("episode_id", episodeId)
    .maybeSingle();
  return data != null;
}

export async function getMyListenListShows(
  userId: string
): Promise<ListenListShowSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listen_list_shows")
    .select("added_at, podcasts(id, slug, title, cover_image_url)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    added_at: string;
    podcasts: ListenListShowSummary["podcast"] | null;
  }>)
    .filter((row) => row.podcasts != null)
    .map((row) => ({ podcast: row.podcasts!, added_at: row.added_at }));
}

export async function getMyListenListEpisodes(
  userId: string
): Promise<ListenListEpisodeSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listen_list_episodes")
    .select(
      "added_at, episodes(id, slug, title, cover_image_url, podcast_id, podcasts(slug, title))"
    )
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    added_at: string;
    episodes:
      | (ListenListEpisodeSummary["episode"] & {
          podcasts: ListenListEpisodeSummary["podcast"] | null;
        })
      | null;
  }>)
    .filter((row) => row.episodes?.podcasts != null)
    .map((row) => ({
      episode: row.episodes!,
      podcast: row.episodes!.podcasts!,
      added_at: row.added_at,
    }));
}
