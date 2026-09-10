import { NextRequest } from "next/server";
import { searchPeople } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Light people suggestions for header / search typeahead. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const people = await searchPeople(q, 6);
  return Response.json({ people });
}
