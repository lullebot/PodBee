import { NextRequest } from "next/server";
import {
  loadEpisodeSearchHits,
  searchPeople,
  searchPodcasts,
} from "@/lib/search";
import { rankEpisodes, TYPEAHEAD_GROUP_LIMIT } from "@/lib/search-hits";

export const dynamic = "force-dynamic";

/** Typeahead groups: People / Podcasts / Episodes (max 5 each). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [people, podcasts, rawEpisodes] = await Promise.all([
    searchPeople(q, TYPEAHEAD_GROUP_LIMIT),
    searchPodcasts(q, TYPEAHEAD_GROUP_LIMIT),
    loadEpisodeSearchHits(q),
  ]);
  return Response.json({
    people,
    podcasts,
    episodes: rankEpisodes(rawEpisodes, q, people).slice(
      0,
      TYPEAHEAD_GROUP_LIMIT
    ),
  });
}
