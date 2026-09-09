export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChartSection } from "@/components/charts/ChartSection";
import { StarRating } from "@/components/ui/StarRating";
import { getChartBoards } from "@/lib/charts";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AdSlot } from "@/components/ads/AdSlot";

const GENRE_CHIPS = [
  { label: "Top", href: "#top-overall" },
  { label: "Comedy", href: "#top-comedy" },
  { label: "True Crime", href: "#top-true-crime" },
  { label: "News", href: "#top-news" },
];

export default async function HomePage() {
  const { boards } = await getChartBoards();
  const overall = boards.find((b) => b.chart.slug === "top-overall");
  const featured = overall?.entries[0];

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 sm:px-8 pt-10 sm:pt-14 pb-28">
        <header className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              PodBee Charts
            </p>
            <h1 className="mt-2 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.02]">
              What to listen next
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/55 leading-snug">
              Ranked podcasts by category — like IMDb for audio. Tap any poster.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {GENRE_CHIPS.map((chip) => (
              <a
                key={chip.href}
                href={chip.href}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[14px] font-medium text-white hover:bg-[#007AFF] hover:border-[#007AFF] transition-colors"
              >
                {chip.label}
              </a>
            ))}
          </nav>
        </header>

        {featured ? (
          <Link
            href={`/podcasts/${featured.podcast.slug}`}
            className="mt-12 flex flex-col sm:flex-row gap-6 sm:gap-10 rounded-[24px] bg-[#12253A] border border-white/10 p-5 sm:p-8 group"
          >
            {featured.podcast.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featured.podcast.cover_image_url}
                alt={featured.podcast.title}
                className="h-48 w-48 sm:h-56 sm:w-56 rounded-[20px] object-cover bg-white/10 shrink-0"
              />
            ) : (
              <div className="h-48 w-48 sm:h-56 sm:w-56 rounded-[20px] bg-white/10 shrink-0" />
            )}
            <div className="min-w-0 flex flex-col justify-center">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-[#F5C518]">
                #1 · Top Overall
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight group-hover:text-[#007AFF] transition-colors">
                {featured.podcast.title}
              </h2>
              <div className="mt-4">
                <StarRating
                  average={featured.podcast.rating_average ?? null}
                  count={featured.podcast.rating_count ?? null}
                  size="lg"
                />
              </div>
              <p className="mt-5 text-[15px] text-[#007AFF] font-medium">
                Open title page →
              </p>
            </div>
          </Link>
        ) : null}

        <div className="mt-10">
          <AdSlot label="Home" size="banner" />
        </div>

        {boards.map((board) => (
          <div key={board.chart.slug} id={board.chart.slug}>
            <ChartSection board={board} />
          </div>
        ))}

        <p className="mt-16 text-[13px] text-white/35">
          Tip: open a poster for ratings, genres, cast, and More like this.
        </p>
      </div>
    </main>
  );
}
