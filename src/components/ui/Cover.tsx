import { initials } from "@/lib/format";

/** Square cover with soft 24px radius; avatar variant uses a circle + monogram. */
export function Cover({
  src,
  alt,
  size = "lg",
  rounded = "card",
  monogram = false,
}: {
  src: string | null | undefined;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "fill";
  rounded?: "card" | "full";
  monogram?: boolean;
}) {
  const dim =
    size === "xs"
      ? "h-8 w-8"
      : size === "sm"
        ? "h-16 w-16"
        : size === "md"
          ? "h-24 w-24"
          : size === "xl"
            ? "h-56 w-56"
            : size === "fill"
              ? "aspect-square w-full"
              : "h-40 w-40";
  const radius = rounded === "full" ? "rounded-full" : "rounded-[24px]";
  const letter =
    size === "xl"
      ? "text-4xl"
      : size === "sm"
        ? "text-[13px]"
        : size === "xs"
          ? "text-[10px]"
          : "text-xl";

  if (!src) {
    return (
      <div
        className={`${dim} ${radius} shrink-0 bg-white/10 flex items-center justify-center`}
        aria-label={alt}
      >
        {monogram ? (
          <span className={`${letter} font-semibold text-white/55 tracking-tight`}>
            {initials(alt)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${dim} ${radius} shrink-0 object-cover bg-white/10`}
    />
  );
}
