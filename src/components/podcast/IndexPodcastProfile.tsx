import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { Cover } from "@/components/ui/Cover";
import { EpisodeList } from "@/components/podcast/EpisodeList";
import { TitleSubnav } from "@/components/podcast/TitleSubnav";
import { formatDate } from "@/lib/format";
import { indexEpisodeCards } from "@/lib/podcast-index";
import type { LongTailPodcastDetail } from "@/lib/long-tail";

/**
 * Long-tail show page — rendered live from the open Podcast Index, no
 * Supabase row. Ratings, cast, and Listen List need a catalog row, so they
 * appear once the show is promoted (the URL then redirects to the catalog page).
 */
export function IndexPodcastProfile({ data }: { data: LongTailPodcastDetail }) {
  const { podcast, episodes } = data;
  const cards = indexEpisodeCards(podcast, episodes);
  const total = Math.max(podcast.episode_count ?? 0, cards.length);
  const latest = formatDate(podcast.latest_published_at);

  const meta = [
    podcast.author,
    total > 0 ? `${total.toLocaleString()} eps` : null,
    latest ? `Latest ${latest}` : null,
    podcast.explicit ? "Explicit" : null,
  ].filter(Boolean);

  const nav = [
    podcast.description ? { href: "#overview", label: "Overview" } : null,
    { href: "#episodes", label: "Episodes" },
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
          <Cover src={podcast.cover_image_url} alt={podcast.title} size="xl" />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Podcast
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {podcast.title}
            </h1>

            {meta.length > 0 ? (
              <p className="mt-5 text-[15px] text-white/65 leading-snug">
                {meta.join(" · ")}
              </p>
            ) : null}

            {podcast.genres.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {podcast.genres.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] font-medium text-white/75"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : null}

            {podcast.website_url ? (
              <a
                href={podcast.website_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-5 inline-block text-[15px] font-medium text-[#007AFF] hover:opacity-80"
              >
                Website ↗
              </a>
            ) : null}

            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/45">
              From the open{" "}
              <a
                href="https://podcastindex.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/25 underline-offset-2 hover:text-[#007AFF]"
              >
                Podcast Index
              </a>
              . Ratings, cast, and Listen List open when
              this show joins the PodBee catalog.
            </p>
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

        <EpisodeList cards={cards} total={total} seasons={[]} />
      </div>
    </main>
  );
}
