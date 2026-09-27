"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setMarketingOptIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("set_marketing_opt_in", {
    opt_in: formData.get("opt_in") === "true",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}

/** Unsubscribe from a link in an email — works without signing in. */
export async function unsubscribe(formData: FormData) {
  const token = formData.get("token");
  let ok = false;
  if (typeof token === "string" && token) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unsubscribe_by_token", { token });
    ok = !error && data === true;
  }
  redirect(`/unsubscribe?status=${ok ? "done" : "invalid"}`);
}
