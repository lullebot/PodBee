import { supabase } from "@/lib/supabase";

export type SearchHit =
  | {
      kind: "podcast";
      id: string;
      slug: string;
      title: string;
      cover_image_url: string | null;
      rating_average: number | null;
    }
  | {
      kind: "person";
      id: string;
      slug: string;
      display_name: string;
      image_url: string | null;
    };

export async function searchCatalog(q: string): Promise<SearchHit[]> {
  const term = q.trim().replace(/[%_,]/g, " ");
  if (term.length < 2) return [];

  const pattern = `%${term}%`;

  const [{ data: podcasts }, { data: people }] = await Promise.all([
    supabase
      .from("podcasts")
      .select("id, slug, title, cover_image_url, rating_average")
      .ilike("title", pattern)
      .order("rating_average", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("people")
      .select("id, slug, display_name, image_url")
      .ilike("display_name", pattern)
      .limit(8),
  ]);

  // Also match subtitle if title miss is thin
  let morePodcasts = podcasts ?? [];
  if (morePodcasts.length < 6) {
    const { data: bySub } = await supabase
      .from("podcasts")
      .select("id, slug, title, cover_image_url, rating_average")
      .ilike("subtitle", pattern)
      .limit(8);
    const seen = new Set(morePodcasts.map((p) => p.id));
    for (const p of bySub ?? []) {
      if (!seen.has(p.id)) morePodcasts.push(p);
    }
  }

  const hits: SearchHit[] = [];
  for (const p of morePodcasts) {
    hits.push({
      kind: "podcast",
      id: p.id,
      slug: p.slug,
      title: p.title,
      cover_image_url: p.cover_image_url,
      rating_average: p.rating_average,
    });
  }
  for (const person of people ?? []) {
    hits.push({
      kind: "person",
      id: person.id,
      slug: person.slug,
      display_name: person.display_name,
      image_url: person.image_url,
    });
  }
  return hits;
}
