import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-[#0B1C2C]/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-5xl px-6 sm:px-8 h-14 flex items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="text-[17px] font-semibold tracking-tight shrink-0 hover:text-[#007AFF] transition-colors"
        >
          PodBee
        </Link>
        <form action="/search" method="get" className="flex-1 max-w-md">
          <input
            type="search"
            name="q"
            placeholder="Search podcasts & people"
            className="w-full rounded-full bg-white/5 border border-white/15 px-4 py-2 text-[14px] text-white placeholder:text-white/35 outline-none focus:border-[#007AFF]"
          />
        </form>
        <nav className="hidden sm:flex items-center gap-4 text-[13px] text-white/55">
          <Link href="/#top-overall" className="hover:text-white">
            Charts
          </Link>
          <Link href="/search" className="hover:text-white">
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
