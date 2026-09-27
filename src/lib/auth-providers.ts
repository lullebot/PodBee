const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Which OAuth providers are switched on in the Supabase dashboard, read from
 * the public Auth settings endpoint — so a sign-in button only shows up once
 * its provider actually works, with no deploy needed.
 */
export async function getEnabledOAuthProviders(): Promise<{ google: boolean }> {
  if (!url || !anon) return { google: false };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anon },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { google: false };
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return { google: settings.external?.google === true };
  } catch {
    return { google: false };
  }
}
