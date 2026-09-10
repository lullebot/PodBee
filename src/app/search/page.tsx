export const dynamic = "force-dynamic";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AdSlot } from "@/components/ads/AdSlot";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";
import { getPopularPodcasts, searchCatalog } from "@/lib/search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const hits = q ? await searchCatalog(q) : [];
  const podcasts = hits.filter((h) => h.kind === "podcast");
  const people = hits.filter((h) => h.kind === "person");
  const popular = !q ? await getPopularPodcasts(8) : [];

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-10 pb-28">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Search
        </h1>
        <p className="mt-2 text-[15px] text-white/50">
          Find podcasts and people in the catalog
        </p>

        <form action="/search" method="get" className="mt-8">
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="e.g. Serial, Ira Glass, Radiolab"
            className="w-full rounded-[16px] bg-white/5 border border-white/15 px-5 py-3.5 text-[16px] text-white placeholder:text-white/35 outline-none focus:border-[#007AFF]"
          />
        </form>

        <div className="mt-8">
          <AdSlot label="Search" size="inline" />
        </div>

        {!q ? (
          <section className="mt-12">
            <h2 className="text-xl font-semibold tracking-tight">
              Popular right now
            </h2>
            <p className="mt-1 text-[13px] text-white/40">
              Start typing to search the full catalog
            </p>
            <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
              {popular.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/podcasts/${p.slug}`}
                    className="flex items-center gap-4 py-4 group"
                  >
                    <Cover src={p.cover_image_url} alt={p.title} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold group-hover:text-[#007AFF] transition-colors truncate">
                        {p.title}
                      </p>
                      <div className="mt-1">
                        <StarRating average={p.rating_average} size="sm" />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : hits.length === 0 ? (
          <div className="mt-12 rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] px-6 py-12 text-center">
            <p className="text-[17px] font-semibold tracking-tight">
              No matches for “{q}”
            </p>
            <p className="mt-3 text-[15px] text-white/50 max-w-md mx-auto">
              Try a shorter name, or browse the charts while the catalog grows.
            </p>
            <a
              href="/#top-overall"
              className="inline-block mt-6 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
            >
              Browse Top Overall →
            </a>
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {podcasts.length > 0 ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight">
                  Podcasts
                </h2>
                <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
                  {podcasts.map((p) =>
                    p.kind === "podcast" ? (
                      <li key={p.id}>
                        <Link
                          href={`/podcasts/${p.slug}`}
                          className="flex items-center gap-4 py-4 group"
                        >
                          <Cover
                            src={p.cover_image_url}
                            alt={p.title}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold group-hover:text-[#007AFF] transition-colors truncate">
                              {p.title}
                            </p>
                            <div className="mt-1">
                              <StarRating
                                average={p.rating_average}
                                size="sm"
                              />
                            </div>
                          </div>
                        </Link>
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            ) : null}

            {people.length > 0 ? (
              <section>
                <h2 className="text-xl font-semibold tracking-tight">
                  People
                </h2>
                <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
                  {people.map((p) =>
                    p.kind === "person" ? (
                      <li key={p.id}>
                        <Link
                          href={`/people/${p.slug}`}
                          className="flex items-center gap-4 py-4 group"
                        >
                          <Cover
                            src={p.image_url}
                            alt={p.display_name}
                            size="sm"
                          />
                          <p className="font-semibold group-hover:text-[#007AFF] transition-colors">
                            {p.display_name}
                          </p>
                        </Link>
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
