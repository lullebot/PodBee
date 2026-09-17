"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Origin of the actual request (works for localhost, Vercel previews, and production alike). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(formData: FormData) {
  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  const username = asString(formData.get("username"));

  if (!email || !password) {
    redirect("/signup?error=Email and password are required");
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: username ? { username } : undefined,
      // Without this Supabase falls back to the project's default Site URL
      // (dashboard: Authentication -> URL Configuration), which must also
      // list this origin under Redirect URLs or it's ignored.
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Check your email to confirm your account");
}

export async function signIn(formData: FormData) {
  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));

  if (!email || !password) {
    redirect("/login?error=Email and password are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/profile");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
