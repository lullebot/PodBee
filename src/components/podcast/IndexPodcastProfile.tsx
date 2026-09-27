import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { Cover } from "@/components/ui/Cover";
import { StarRating } from "@/components/ui/StarRating";
import { EpisodeList } from "@/components/podcast/EpisodeList";
import { TitleSubnav } from "@/components/podcast/TitleSubnav";
import { RatingWidget } from "@/components/rating/RatingWidget";
import { ReviewsSection } from "@/components/rating/ReviewsSection";
import { ListenListButton } from "@/components/listen-list/ListenListButton";
import { rateLongTailPodcast, toggleLongTailListenListShow } from "@/app/actions/long-tail";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { isInListenListShow } from "@/lib/listen-list";
import { longTailRatingsEnabled, type LongTailPodcastDetail } from "@/lib/long-tail";
import { indexEpisodeCards } from "@/lib/podcast-index";
import { getMyPodcastRating, getPodcastReviews } from "@/lib/ratings";

/**
 * Long-tail show page — metadata and episodes live from the open Podcast
 * Index. Ratings, reviews, and Listen List work like on catalog shows: the
 * first one creates the show's Supabase row (see app/actions/long-tail.ts).
 */
export async function IndexPodcastProfile({ data }: { data: LongTailPodcastDetail }) {
  const { podcast, episodes, score, rated_episodes } = data;
  const cards = indexEpisodeCards(podcast, episodes, rated_episodes);
  const total = Math.max(podcast.episode_count ?? 0, cards.length);
  const latest = formatDate(podcast.latest_published_at);
  const ratingsOn = longTailRatingsEnabled();

  const [current, reviews] = await Promise.all([
    getCurrentUser(),
    score ? getPodcastReviews(score.id) : Promise.resolve([]),
  ]);
  const [myRating, inListenList] =
    current && score
      ? await Promise.all([
          getMyPodcastRating(current.id, score.id),
          isInListenListShow(current.id, score.id),
        ])
      : [null, false];

  const rateAction = rateLongTailPodcast.bind(null, podcast.feed_id);
  const listenListAction = toggleLongTailListenListShow.bind(null, podcast.feed_id);

  const meta = [
    podcast.author,
    total > 0 ? `${total.toLocaleString()} eps` : null,
    latest ? `Latest ${latest}` : null,
    podcast.explicit ? "Explicit" : null,
  ].filter(Boolean);

  const nav = [
    podcast.description ? { href: "#overview", label: "Overview" } : null,
    { href: "#episodes", label: "Episodes" },
    reviews.length > 0 ? { href: "#reviews", label: "Reviews" } : null,
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

            <div className="mt-5">
              <StarRating
                average={score?.display_score ?? null}
                count={score?.display_count ?? null}
                size="lg"
                empty="dash"
              />
            </div>

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
              Show details from the open{" "}
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

        <ReviewsSection id="reviews" reviews={reviews} />
      </div>
    </main>
  );
}
