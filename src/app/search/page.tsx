import { PersonSearchRow } from "@/components/search/PersonSearchRow";
import { PodcastSearchRow } from "@/components/search/PodcastSearchRow";
import { EpisodeResults } from "@/components/search/EpisodeResults";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SearchField } from "@/components/layout/SearchField";
import { AdSlot } from "@/components/ads/AdSlot";
import { isGuestIntent } from "@/lib/search-hits";
import { getPopularMix, searchCatalog } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const hits = q ? await searchCatalog(q) : [];
  const podcasts = hits.filter((h) => h.kind === "podcast");
  const people = hits.filter((h) => h.kind === "person");
  const episodes = hits.filter((h) => h.kind === "episode");
  const popular = !q ? await getPopularMix() : { podcasts: [], people: [] };
  const guestIntent = isGuestIntent(people, q, podcasts);

  const podcastsSection =
    podcasts.length > 0 ? (
      <section key="podcasts">
        <h2 className="text-xl font-semibold tracking-tight">Podcasts</h2>
        <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
          {podcasts.map((p) =>
            p.kind === "podcast" ? (
              <li key={p.id}>
                <PodcastSearchRow hit={p} />
              </li>
            ) : null
          )}
        </ul>
      </section>
    ) : null;

  const peopleSection =
    people.length > 0 ? (
      <section key="people">
        <h2 className="text-xl font-semibold tracking-tight">People</h2>
        <ul className="mt-4 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
          {people.map((p) =>
            p.kind === "person" ? (
              <li key={p.id}>
                <PersonSearchRow hit={p} />
              </li>
            ) : null
          )}
        </ul>
      </section>
    ) : podcasts.length > 0 ? (
      <p key="no-people" className="text-[13px] text-white/45">
        No people matched — try a fuller name
      </p>
    ) : null;

  const episodesSection =
    episodes.length > 0 ? (
      <EpisodeResults key="episodes" hits={episodes} />
    ) : null;

  const orderedSections = guestIntent
    ? [peopleSection, episodesSection, podcastsSection]
    : [podcastsSection, peopleSection, episodesSection];

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-10 pb-28">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Search
        </h1>
        <p className="mt-2 text-[15px] text-white/50">
          Find podcasts, people, and episode appearances
        </p>

        <form action="/search" method="get" className="mt-8">
          <SearchField
            defaultValue={q}
            autoFocus
            placeholder="e.g. Oprah, Serial, Ira Glass"
            variant="page"
          />
        </form>

        <div className="mt-8">
          <AdSlot label="Search" size="inline" />
        </div>

        {!q ? (
          <section className="mt-12 space-y-12">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Popular right now
              </h2>
              <p className="mt-1 text-[13px] text-white/40">
                Start typing to search the full catalog
              </p>
            </div>
            {popular.podcasts.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wide text-white/45">
                  Podcasts
                </h3>
                <ul className="mt-3 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
                  {popular.podcasts.map((p) => (
                    <li key={p.id}>
                      <PodcastSearchRow hit={p} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {popular.people.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wide text-white/45">
                  People
                </h3>
                <ul className="mt-3 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#12253A] px-5 sm:px-6">
                  {popular.people.map((p) => (
                    <li key={p.id}>
                      <PersonSearchRow hit={p} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
              href="/charts/top-overall"
              className="inline-block mt-6 text-[15px] font-medium text-[#007AFF] hover:opacity-80"
            >
              Browse Top Overall →
            </a>
          </div>
        ) : (
          <div className="mt-12 space-y-12">{orderedSections}</div>
        )}
      </div>
    </main>
  );
}
