import type { ReactNode } from "react";

/** Apple Design System card — 24px radius, navy elevated surface, white hairline. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] bg-[#12253A] border border-white/10 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
