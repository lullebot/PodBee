import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Browser client for Client Components — anon key only. */
export function createClient() {
  return createBrowserClient(
    url || "https://placeholder.supabase.co",
    anon || "public-anon-key"
  );
}
