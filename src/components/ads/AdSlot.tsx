/** Reserved ad placement — not wired to a network until free-tier OK. */
export function AdSlot({
  label = "Ad",
  size = "banner",
}: {
  label?: string;
  size?: "banner" | "inline";
}) {
  const box =
    size === "banner"
      ? "min-h-[90px] sm:min-h-[100px]"
      : "min-h-[72px]";
  return (
    <aside
      aria-label={`${label} placement (reserved)`}
      className={`${box} w-full rounded-[16px] border border-dashed border-white/20 bg-white/[0.03] flex flex-col items-center justify-center gap-1 px-4`}
    >
      <span className="text-[11px] uppercase tracking-wider text-white/35">
        {label} · reserved
      </span>
      <span className="text-[12px] text-white/25">
        Free network TBD · not live
      </span>
    </aside>
  );
}
