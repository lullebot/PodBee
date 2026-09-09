import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-8 pt-32 pb-32">
        <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
          Catalog
        </p>
        <h1 className="mt-4 text-6xl sm:text-7xl font-semibold tracking-tight leading-[1.02]">
          PodBee
        </h1>
        <p className="mt-6 max-w-xl text-xl text-neutral-500 leading-snug">
          The IMDb for podcasts. Structured data — shows, people, credits.
          Not a player.
        </p>
        <div className="mt-12 flex flex-wrap gap-6">
          <Link
            href="/podcasts/example"
            className="text-[#007AFF] text-[17px] font-medium hover:opacity-80"
          >
            Browse a podcast
          </Link>
          <Link
            href="/people/example"
            className="text-[#007AFF] text-[17px] font-medium hover:opacity-80"
          >
            Browse a person
          </Link>
        </div>
        <p className="mt-24 text-[15px] text-neutral-400 max-w-md leading-relaxed">
          Catalog fills as the pipeline loads shows. Until then, profile
          pages show a clean empty state.
        </p>
      </div>
    </main>
  );
}
