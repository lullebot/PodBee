import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Current signed-in user + their profile row, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<{
  id: string;
  email: string | null;
  profile: Profile | null;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, email: user.email ?? null, profile: (profile as Profile) ?? null };
});
