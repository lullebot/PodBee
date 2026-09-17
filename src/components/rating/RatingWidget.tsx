"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/** 1-10 tap widget. Tapping a number submits instantly; the review is optional and separate. */
export function RatingWidget({
  action,
  initialRating,
  initialReview,
  signedIn,
}: {
  action: (rating: number, reviewText: string | null) => Promise<void>;
  initialRating: number | null;
  initialReview: string | null;
  signedIn: boolean;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [review, setReview] = useState(initialReview ?? "");
  const [showReview, setShowReview] = useState(Boolean(initialReview));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(nextRating: number, reviewText: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action(nextRating, reviewText);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your rating.");
      }
    });
  }

  function handleTap(n: number) {
    setRating(n);
    save(n, review);
  }

  function handleSaveReview() {
    if (rating == null) {
      setError("Pick a rating from 1 to 10 first.");
      return;
    }
    save(rating, review);
  }

  if (!signedIn) {
    return (
      <p className="text-[13px] text-white/45">
        <Link href="/login" className="font-medium text-[#007AFF] hover:opacity-80">
          Sign in
        </Link>{" "}
        to rate this.
      </p>
    );
  }

  return (
    <div>
      {rating != null ? (
        <p className="mb-2 text-[13px] text-white/55">
          Your rating: <span className="font-semibold text-white">{rating}</span>
        </p>
      ) : (
        <p className="mb-2 text-[13px] text-white/45">Rate this</p>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rating, 1 to 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onClick={() => handleTap(n)}
            aria-pressed={rating === n}
            className={`h-9 w-9 rounded-full text-[13px] font-semibold border transition-colors disabled:opacity-50 ${
              rating === n
                ? "border-[#007AFF] bg-[#007AFF] text-white"
                : "border-white/15 text-white/70 hover:border-[#007AFF] hover:text-white"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowReview((s) => !s)}
        className="mt-3 text-[13px] font-medium text-[#007AFF] hover:opacity-80"
      >
        {showReview ? "Hide review" : "Write a review"}
      </button>

      {showReview ? (
        <div className="mt-2">
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            placeholder="Optional — leave blank to keep your rating anonymous"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-[#007AFF]"
          />
          <button
            type="button"
            disabled={pending || rating == null}
            onClick={handleSaveReview}
            className="mt-2 rounded-full bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save review
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[12px] text-red-400">{error}</p> : null}
    </div>
  );
}
