import type { ReactNode } from "react";

/** Apple Design System card — 24px radius, monochrome, extreme whitespace. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] bg-white border border-black/[0.06] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
