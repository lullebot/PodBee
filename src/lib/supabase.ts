import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Browser + server anon client only — never service_role. */
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anon || "public-anon-key"
);
