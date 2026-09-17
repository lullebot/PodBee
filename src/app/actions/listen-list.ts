"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleListenListShow(
  podcastId: string,
  podcastSlug: string,
  wasInList: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use your Listen List.");

  const { error } = wasInList
    ? await supabase
        .from("listen_list_shows")
        .delete()
        .eq("user_id", user.id)
        .eq("podcast_id", podcastId)
    : await supabase
        .from("listen_list_shows")
        .insert({ user_id: user.id, podcast_id: podcastId });
  if (error) throw new Error(error.message);

  revalidatePath(`/podcasts/${podcastSlug}`);
  revalidatePath("/profile");
}

export async function toggleListenListEpisode(
  episodeId: string,
  podcastSlug: string,
  episodeSlug: string,
  wasInList: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use your Listen List.");

  const { error } = wasInList
    ? await supabase
        .from("listen_list_episodes")
        .delete()
        .eq("user_id", user.id)
        .eq("episode_id", episodeId)
    : await supabase
        .from("listen_list_episodes")
        .insert({ user_id: user.id, episode_id: episodeId });
  if (error) throw new Error(error.message);

  revalidatePath(`/podcasts/${podcastSlug}/${episodeSlug}`);
  revalidatePath("/profile");
}
