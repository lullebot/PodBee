export function TitleSubnav({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="On this page"
      className="mt-10 -mx-6 sm:-mx-8 px-6 sm:px-8 sticky top-14 z-30 bg-[#0B1C2C]/95 backdrop-blur border-y border-white/10"
    >
      <ul className="flex gap-5 overflow-x-auto py-3 text-[14px] font-medium">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="whitespace-nowrap text-white/70 hover:text-[#007AFF] transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
