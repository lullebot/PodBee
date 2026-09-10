/** IMDb-style rating chip — gold star + score. Never omit ★ when a score exists. */
export function StarRating({
  average,
  count,
  size = "md",
  empty = "hidden",
}: {
  average: number | null | undefined;
  count?: number | null;
  size?: "sm" | "md" | "lg";
  empty?: "hidden" | "dash";
}) {
  if (average == null) {
    if (empty === "dash") {
      return (
        <span className="text-white/35 tabular-nums" aria-label="No rating">
          —
        </span>
      );
    }
    return null;
  }
  const star = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const score =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-[15px]" : "text-xl";
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`${star} text-[#F5C518] leading-none`} aria-hidden>
        ★
      </span>
      <span className={`${score} font-semibold tabular-nums tracking-tight`}>
        {average.toFixed(1)}
      </span>
      {count != null ? (
        <span className="text-[12px] text-white/45 tabular-nums">
          ({count.toLocaleString()})
        </span>
      ) : null}
    </div>
  );
}
