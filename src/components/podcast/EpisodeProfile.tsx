import Link from "next/link";
import type { EpisodeDetail } from "@/lib/types";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";
import { TopCast } from "@/components/podcast/TopCast";
import { formatDate, formatDuration } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { getMyEpisodeRating, getEpisodeReviews } from "@/lib/ratings";
import { isInListenListEpisode } from "@/lib/listen-list";
import { upsertEpisodeRating } from "@/app/actions/ratings";
import { toggleListenListEpisode } from "@/app/actions/listen-list";
import { RatingWidget } from "@/components/rating/RatingWidget";
import { ReviewsSection } from "@/components/rating/ReviewsSection";
import { ListenListButton } from "@/components/listen-list/ListenListButton";

export async function EpisodeProfile({ data }: { data: EpisodeDetail }) {
  const { episode, podcast, season, credits } = data;
  const cover = episode.cover_image_url ?? podcast.cover_image_url;
  const meta = [
    season?.number != null ? `S${season.number}` : null,
    episode.episode_number != null ? `E${episode.episode_number}` : null,
    formatDuration(episode.duration_seconds),
    formatDate(episode.published_at),
  ].filter(Boolean);

  const [current, reviews] = await Promise.all([
    getCurrentUser(),
    getEpisodeReviews(episode.id),
  ]);
  const myRating = current ? await getMyEpisodeRating(current.id, episode.id) : null;
  const inListenList = current ? await isInListenListEpisode(current.id, episode.id) : false;

  const rateAction = upsertEpisodeRating.bind(null, episode.id, podcast.slug, episode.slug);
  const listenListAction = toggleListenListEpisode.bind(
    null,
    episode.id,
    podcast.slug,
    episode.slug
  );

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
        <Link
          href={`/podcasts/${podcast.slug}`}
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
              <Link
                href={`/podcasts/${podcast.slug}`}
                className="hover:text-[#007AFF] transition-colors"
              >
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
                average={episode.rating_count > 0 ? episode.avg_rating : null}
                count={episode.rating_count}
                size="lg"
                empty="dash"
              />
            </div>

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

        {credits.length > 0 ? (
          <TopCast members={credits} showEpisodeCount={false} />
        ) : null}

        <ReviewsSection id="reviews" reviews={reviews} />
      </div>
    </main>
  );
}
