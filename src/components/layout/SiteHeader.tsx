import Link from "next/link";
import { SearchField } from "@/components/layout/SearchField";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export async function SiteHeader() {
  const current = await getCurrentUser();

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
          <SearchField />
        </form>
        <nav className="hidden sm:flex items-center gap-4 text-[13px] text-white/55">
          <Link href="/#top-overall" className="hover:text-white">
            Charts
          </Link>
          <Link href="/search" className="hover:text-white">
            Search
          </Link>
        </nav>
        {current ? (
          <div className="flex items-center gap-3 shrink-0 text-[13px]">
            <Link
              href="/profile"
              className="font-medium text-white/75 hover:text-white"
            >
              {current.profile?.username ?? "Profile"}
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-white/45 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 text-[13px] font-medium text-[#007AFF] hover:opacity-80"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
