import Link from "next/link";
import type { CreditOnWork } from "@/lib/types";
import { StarRating } from "@/components/ui/StarRating";

export function KnownFor({
  credits,
  limit = 6,
}: {
  credits: CreditOnWork[];
  limit?: number;
}) {
  const byId = new Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      cover_image_url: string | null;
      rating_average: number | null;
      rating_count: number | null;
    }
  >();

  for (const c of credits) {
    const pod = c.work.podcast;
    const rating = pod.rating_average ?? null;
    const count = pod.rating_count ?? null;
    const existing = byId.get(pod.id);
    const nextScore = rating ?? -1;
    const prevScore = existing?.rating_average ?? -1;
    if (!existing || nextScore > prevScore) {
      byId.set(pod.id, {
        id: pod.id,
        slug: pod.slug,
        title: pod.title,
        cover_image_url: pod.cover_image_url,
        rating_average: rating,
        rating_count: count,
      });
    }
  }

  const items = [...byId.values()]
    .sort((a, b) => {
      const ra = a.rating_average ?? -1;
      const rb = b.rating_average ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.rating_count ?? 0) - (a.rating_count ?? 0);
    })
    .slice(0, limit);

  if (items.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">Known for</h2>
      <div className="mt-6 -mx-6 sm:-mx-8 px-6 sm:px-8 overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-min">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/podcasts/${p.slug}`}
              className="group w-[112px] sm:w-[132px] shrink-0"
            >
              {p.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_image_url}
                  alt={p.title}
                  className="aspect-[2/3] w-full rounded-[16px] object-cover bg-white/10 ring-1 ring-white/10 group-hover:ring-[#007AFF] transition"
                />
              ) : (
                <div className="aspect-[2/3] w-full rounded-[16px] bg-gradient-to-br from-[#1a3350] to-[#0B1C2C] ring-1 ring-white/10 flex items-end p-2.5">
                  <span className="text-[12px] font-semibold leading-snug line-clamp-4">
                    {p.title}
                  </span>
                </div>
              )}
              <p className="mt-2 text-[13px] font-semibold leading-snug line-clamp-2 group-hover:text-[#007AFF] transition-colors">
                {p.title}
              </p>
              <div className="mt-1">
                <StarRating average={p.rating_average} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
