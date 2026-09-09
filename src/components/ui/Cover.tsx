/** Square cover with soft 24px radius; falls back to monochrome placeholder. */
export function Cover({
  src,
  alt,
  size = "lg",
}: {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl" | "fill";
}) {
  const dim =
    size === "sm"
      ? "h-16 w-16"
      : size === "md"
        ? "h-24 w-24"
        : size === "xl"
          ? "h-56 w-56"
          : size === "fill"
            ? "aspect-square w-full"
            : "h-40 w-40";

  if (!src) {
    return (
      <div
        className={`${dim} shrink-0 rounded-[24px] bg-neutral-100`}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${dim} shrink-0 rounded-[24px] object-cover bg-neutral-100`}
    />
  );
}
