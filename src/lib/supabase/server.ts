import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Server client for Server Components / Route Handlers / Server Actions —
 * anon key only, session comes from the request's cookies. In a Server
 * Component render, cookie writes are ignored (no-op) since Next forbids
 * mutating cookies there; middleware is what actually refreshes the
 * session cookie on the response.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    url || "https://placeholder.supabase.co",
    anon || "public-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — middleware refreshes instead.
          }
        },
      },
    }
  );
}
