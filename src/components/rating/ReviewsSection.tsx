import { formatDate } from "@/lib/format";
import type { EpisodeReview, PodcastReview } from "@/lib/types";

export function ReviewsSection({
  id,
  reviews,
}: {
  id: string;
  reviews: (PodcastReview | EpisodeReview)[];
}) {
  if (reviews.length === 0) return null;

  return (
    <section id={id} className="mt-16 scroll-mt-28">
      <h2 className="text-2xl font-semibold tracking-tight">Reviews</h2>
      <div className="mt-6 flex flex-col gap-6 max-w-2xl">
        {reviews.map((review) => (
          <article
            key={review.user_id}
            className="border-b border-white/10 pb-6 last:border-0 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[14px] font-semibold text-white">
                {review.profile?.display_name?.trim() ||
                  review.profile?.username ||
                  "PodBee user"}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] font-semibold tabular-nums text-white">
                  {review.rating}/10
                </span>
                <span className="text-[12px] text-white/40">
                  {formatDate(review.updated_at)}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75 whitespace-pre-line">
              {review.review_text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
