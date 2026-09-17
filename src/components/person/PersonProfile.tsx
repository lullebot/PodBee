import Link from "next/link";
import type { PersonDetail } from "@/lib/types";
import {
  countEpisodeCredits,
  professionFromRoles,
  uniqueShowCount,
} from "@/lib/person-credits";
import { Cover } from "@/components/ui/Cover";
import { CreditsTable } from "@/components/person/CreditsTable";
import { KnownFor } from "@/components/person/KnownFor";

export function PersonProfile({ data }: { data: PersonDetail }) {
  const { person, credits } = data;
  const profession = professionFromRoles(credits);
  const showCount = uniqueShowCount(credits);
  const episodeCreditCount = countEpisodeCredits(credits);
  const bio = person.bio?.trim() || null;
  const website = person.website_url?.trim() || null;

  const showLabel =
    showCount > 0
      ? `${showCount} show${showCount === 1 ? "" : "s"}`
      : null;
  const episodeLabel = `${episodeCreditCount} episode credit${
    episodeCreditCount === 1 ? "" : "s"
  }`;

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
        <Link
          href="/"
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-80"
        >
          ← Charts
        </Link>

        <header className="mt-8 flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <Cover
            src={person.image_url}
            alt={person.display_name}
            size="xl"
            rounded="full"
            monogram
          />
          <div className="min-w-0 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Person
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {person.display_name}
            </h1>
            {profession ? (
              <p className="mt-3 text-lg text-white/55 leading-snug">
                {profession}
              </p>
            ) : null}
            {credits.length > 0 ? (
              <p className="mt-4 text-[15px] text-white/55">
                {showLabel ? (
                  <>
                    <a href="#shows" className="text-[#007AFF] hover:opacity-80">
                      {showLabel}
                    </a>
                    {" · "}
                  </>
                ) : null}
                <a href="#episodes" className="text-[#007AFF] hover:opacity-80">
                  {episodeLabel}
                </a>
              </p>
            ) : null}
            {website ? (
              <div className="mt-4">
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007AFF] text-[15px] font-medium hover:opacity-80"
                >
                  Website
                </a>
              </div>
            ) : null}
            {bio ? (
              <p className="mt-4 text-[17px] leading-relaxed text-white/75 whitespace-pre-line line-clamp-4 max-w-2xl">
                {bio}
              </p>
            ) : null}
          </div>
        </header>

        {credits.length === 0 ? (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">Known for</h2>
            <div className="mt-6 rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] px-6 py-12 text-center">
              <p className="text-[15px] text-white/55">
                No credits in the catalog yet.
              </p>
              <p className="mt-2 text-[13px] text-white/35">
                Hosts and guests fill in as shows get richer credit data.
              </p>
              <Link
                href="/#top-overall"
                className="inline-block mt-5 text-[14px] font-medium text-[#007AFF]"
              >
                Browse charts →
              </Link>
            </div>
          </section>
        ) : (
          <>
            <KnownFor credits={credits} />
            <CreditsTable credits={credits} />
          </>
        )}
      </div>
    </main>
  );
}
