"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function signUp(formData: FormData) {
  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  const username = asString(formData.get("username"));

  if (!email || !password) {
    redirect("/signup?error=Email and password are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: username ? { username } : undefined,
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
