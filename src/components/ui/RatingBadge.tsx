export function RatingBadge({
  average,
  count,
}: {
  average: number | null | undefined;
  count?: number | null;
}) {
  if (average == null) return null;
  return (
    <div className="inline-flex items-baseline gap-2">
      <span className="text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums text-white">
        {average.toFixed(1)}
      </span>
      <span className="text-[13px] text-white/45">
        /10
        {count != null ? (
          <>
            <br />
            <span className="text-white/45">
              {count.toLocaleString()} ratings
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}
