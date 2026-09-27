import { createClient } from "@/lib/supabase/server";
import type { CommunityMember } from "@/lib/types";

export async function getMyCommunityMembership(
  userId: string
): Promise<CommunityMember | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("community_members")
    .select(
      "user_id, email, signup_method, signed_up_at, marketing_opt_in, marketing_opt_in_changed_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
