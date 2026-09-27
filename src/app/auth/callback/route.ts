import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null, origin: string): URL {
  const fallback = new URL("/profile", origin);
  if (!value) return fallback;
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? target : fallback;
  } catch {
    return fallback;
  }
}

/** Return point for Supabase email confirmations and Google sign-in. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const source = searchParams.get("source");

  const toLogin = (key: "error" | "message", text: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set(key, text);
    return NextResponse.redirect(url);
  };

  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) {
    return toLogin(
      "error",
      errorCode === "otp_expired"
        ? "That link has expired or was already used. If you've already confirmed your email, just sign in below."
        : (searchParams.get("error_description") ?? "Sign-in didn't complete. Please try again.")
    );
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (searchParams.get("marketing") === "1") {
        await supabase.rpc("set_marketing_opt_in", { opt_in: true });
      }
      return NextResponse.redirect(safeNext(searchParams.get("next"), origin));
    }
    if (source === "email") {
      // Supabase has already confirmed the address before redirecting here;
      // the exchange only fails when the link is opened in a different
      // browser than the one used to sign up.
      return toLogin("message", "Your email is confirmed — sign in to continue.");
    }
  }

  return toLogin(
    "error",
    source === "google"
      ? "Google sign-in didn't complete. Please try again."
      : "Could not confirm your account."
  );
}
