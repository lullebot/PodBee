"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPassword(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function withParam(path: string, key: string, value: string): string {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

/** Origin of the actual request (works for localhost, Vercel previews, and production alike). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(formData: FormData) {
  const name = asString(formData.get("name"));
  const email = asString(formData.get("email"));
  const password = asPassword(formData.get("password"));
  const marketingOptIn = formData.get("marketing_opt_in") === "true";

  if (!email || !password) {
    redirect(withParam("/signup", "error", "Email and password are required."));
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger into profiles + community_members.
      data: {
        ...(name ? { display_name: name } : {}),
        marketing_opt_in: marketingOptIn,
      },
      // Without this Supabase falls back to the project's default Site URL
      // (dashboard: Authentication -> URL Configuration), which must also
      // list this origin under Redirect URLs or it's ignored.
      emailRedirectTo: `${origin}/auth/callback?source=email`,
    },
  });

  if (error) {
    redirect(withParam("/signup", "error", error.message));
  }

  // Signed in straight away when email confirmation is turned off.
  if (data.session) {
    redirect("/profile");
  }

  redirect(withParam("/login", "message", "Check your email to confirm your account."));
}

export async function signIn(formData: FormData) {
  const email = asString(formData.get("email"));
  const password = asPassword(formData.get("password"));

  if (!email || !password) {
    redirect(withParam("/login", "error", "Email and password are required."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withParam("/login", "error", error.message));
  }

  redirect("/profile");
}

/** Starts Google OAuth; Google sends the user back through /auth/callback. */
export async function signInWithGoogle(formData: FormData) {
  const origin = await getOrigin();
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("source", "google");
  if (formData.get("marketing_opt_in") === "true") {
    callback.searchParams.set("marketing", "1");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) {
    redirect(withParam("/login", "error", error?.message ?? "Could not start Google sign-in."));
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
