import Link from "next/link";

/** Apple Blue #007AFF text action — never a player control. */
export function LinkChip({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[#007AFF] text-[15px] font-medium hover:opacity-80 transition-opacity"
    >
      {children}
    </Link>
  );
}
