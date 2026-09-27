import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import { formatDate, formatDuration } from "@/lib/format";
import type { LongTailEpisodeDetail } from "@/lib/long-tail";

/** Long-tail episode page — metadata only from the open Podcast Index. Not a player. */
export function IndexEpisodeProfile({ data }: { data: LongTailEpisodeDetail }) {
  const { podcast, episode } = data;
  const cover = episode.cover_image_url ?? podcast.cover_image_url;
  const showHref = `/podcasts/${podcast.slug}`;
  const meta = [
    episode.season_number != null ? `S${episode.season_number}` : null,
    episode.episode_number != null ? `E${episode.episode_number}` : null,
    formatDuration(episode.duration_seconds),
    formatDate(episode.published_at),
    episode.explicit ? "Explicit" : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
        <Link
          href={showHref}
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-80"
        >
          ← {podcast.title}
        </Link>

        <header className="mt-8 flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <Cover src={cover} alt={episode.title} size="xl" />
          <div className="min-w-0 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Episode
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {episode.title}
            </h1>
            <p className="mt-3 text-lg text-white/55 leading-snug">
              <Link href={showHref} className="hover:text-[#007AFF] transition-colors">
                {podcast.title}
              </Link>
            </p>
            {meta.length > 0 ? (
              <p className="mt-5 text-[15px] text-white/65 leading-snug">
                {meta.join(" · ")}
              </p>
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
              . Ratings and reviews open when
              this show joins the PodBee catalog.
            </p>
          </div>
        </header>

        {episode.description ? (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/75 whitespace-pre-line max-w-2xl line-clamp-8">
              {episode.description}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
