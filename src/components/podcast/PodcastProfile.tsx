import { AdSlot } from "@/components/ads/AdSlot";
import Link from "next/link";
import type { PodcastDetail } from "@/lib/types";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";
import { EpisodeList } from "@/components/podcast/EpisodeList";
import { TitleSubnav } from "@/components/podcast/TitleSubnav";
import { TopCast } from "@/components/podcast/TopCast";
import { formatYearRange } from "@/lib/format";

export function PodcastProfile({ data }: { data: PodcastDetail }) {
  const {
    podcast,
    primary_company,
    credits,
    episode_cards,
    episode_total,
    genres,
    chart_placements,
    similar,
    seasons,
    first_published_at,
    latest_published_at,
  } = data;

  const years = formatYearRange(first_published_at, latest_published_at);
  const meta = [
    primary_company?.name ?? null,
    episode_total > 0
      ? `${episode_total.toLocaleString()} episode${episode_total === 1 ? "" : "s"}`
      : null,
    years,
  ].filter(Boolean);

  const nav = [
    podcast.description ? { href: "#overview", label: "Overview" } : null,
    credits.length > 0 ? { href: "#cast", label: "Cast" } : null,
    { href: "#episodes", label: "Episodes" },
    similar.length > 0 ? { href: "#more-like-this", label: "More like this" } : null,
  ].filter((x): x is { href: string; label: string } => x != null);

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
        <Link
          href="/"
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-80"
        >
          ← Charts
        </Link>

        <header className="mt-8 flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <Cover
            src={podcast.cover_image_url}
            alt={podcast.title}
            size="xl"
          />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Podcast
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {podcast.title}
            </h1>
            {podcast.subtitle ? (
              <p className="mt-3 text-lg text-white/55 leading-snug">
                {podcast.subtitle}
              </p>
            ) : null}

            <div className="mt-5">
              <StarRating
                average={podcast.rating_average}
                count={podcast.rating_count}
                size="lg"
                empty="dash"
              />
            </div>

            {genres.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] font-medium text-white/75"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            ) : null}

            {meta.length > 0 ? (
              <p className="mt-5 text-[15px] text-white/65 leading-snug">
                {meta.join(" · ")}
              </p>
            ) : null}

            {chart_placements.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
                {chart_placements.map((c) => (
                  <Link
                    key={c.chart_slug}
                    href={`/charts/${c.chart_slug}`}
                    className="text-[#007AFF] font-medium hover:opacity-80"
                  >
                    #{c.rank} {c.chart_title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <TitleSubnav items={nav} />

        <div className="mt-10">
          <AdSlot label="Title" size="banner" />
        </div>

        {podcast.description ? (
          <section id="overview" className="mt-14 scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight">Storyline</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/75 whitespace-pre-line max-w-2xl">
              {podcast.description}
            </p>
          </section>
        ) : null}

        {credits.length > 0 ? <TopCast credits={credits} /> : null}

        <EpisodeList
          cards={episode_cards}
          total={episode_total}
          seasons={seasons}
        />

        {similar.length > 0 ? (
          <section id="more-like-this" className="mt-16 scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight">
              More like this
            </h2>
            <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
              {similar.map((s) => (
                <Link key={s.id} href={`/podcasts/${s.slug}`} className="group min-w-0">
                  <Cover src={s.cover_image_url} alt={s.title} size="fill" />
                  <p className="mt-2 text-[13px] sm:text-[14px] font-semibold tracking-tight text-white group-hover:text-[#007AFF] transition-colors line-clamp-2">
                    {s.title}
                  </p>
                  <div className="mt-1">
                    <StarRating
                      average={s.rating_average}
                      count={s.rating_count}
                      size="sm"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
