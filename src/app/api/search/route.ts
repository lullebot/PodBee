import { NextRequest } from "next/server";
import { searchEpisodeAppearances, searchPeople } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Light people + episode appearance suggestions for header / search typeahead. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [people, episodes] = await Promise.all([
    searchPeople(q, 4),
    searchEpisodeAppearances(q, 6),
  ]);
  return Response.json({ people, episodes });
}
