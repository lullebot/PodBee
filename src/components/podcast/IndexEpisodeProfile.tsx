import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";
import { RatingWidget } from "@/components/rating/RatingWidget";
import { ReviewsSection } from "@/components/rating/ReviewsSection";
import { ListenListButton } from "@/components/listen-list/ListenListButton";
import { rateLongTailEpisode, toggleLongTailListenListEpisode } from "@/app/actions/long-tail";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDuration } from "@/lib/format";
import { isInListenListEpisode } from "@/lib/listen-list";
import { longTailRatingsEnabled, type LongTailEpisodeDetail } from "@/lib/long-tail";
import { getEpisodeReviews, getMyEpisodeRating } from "@/lib/ratings";

/** Long-tail episode page — metadata from the open Podcast Index, crowd ratings from Supabase. Not a player. */
export async function IndexEpisodeProfile({ data }: { data: LongTailEpisodeDetail }) {
  const { podcast, episode, score } = data;
  const cover = episode.cover_image_url ?? podcast.cover_image_url;
  const showHref = `/podcasts/${podcast.slug}`;
  const ratingsOn = longTailRatingsEnabled();
  const meta = [
    episode.season_number != null ? `S${episode.season_number}` : null,
    episode.episode_number != null ? `E${episode.episode_number}` : null,
    formatDuration(episode.duration_seconds),
    formatDate(episode.published_at),
    episode.explicit ? "Explicit" : null,
  ].filter(Boolean);

  const [current, reviews] = await Promise.all([
    getCurrentUser(),
    score ? getEpisodeReviews(score.id) : Promise.resolve([]),
  ]);
  const [myRating, inListenList] =
    current && score
      ? await Promise.all([
          getMyEpisodeRating(current.id, score.id),
          isInListenListEpisode(current.id, score.id),
        ])
      : [null, false];

  const rateAction = rateLongTailEpisode.bind(null, podcast.feed_id, episode.id);
  const listenListAction = toggleLongTailListenListEpisode.bind(
    null,
    podcast.feed_id,
    episode.id
  );

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

            <div className="mt-5">
              <StarRating
                average={score && score.rating_count > 0 ? score.avg_rating : null}
                count={score?.rating_count ?? 0}
                size="lg"
                empty="dash"
              />
            </div>

            {ratingsOn ? (
              <>
                <div className="mt-6">
                  <ListenListButton
                    action={listenListAction}
                    initialInList={inListenList}
                    signedIn={current != null}
                    label="Listen List"
                  />
                </div>
                <div className="mt-6 max-w-xs">
                  <RatingWidget
                    action={rateAction}
                    initialRating={myRating?.rating ?? null}
                    initialReview={myRating?.review_text ?? null}
                    signedIn={current != null}
                  />
                </div>
              </>
            ) : null}

            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/45">
              Episode details from the open{" "}
              <a
                href="https://podcastindex.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/25 underline-offset-2 hover:text-[#007AFF]"
              >
                Podcast Index
              </a>
              .
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

        <ReviewsSection id="reviews" reviews={reviews} />
      </div>
    </main>
  );
}
