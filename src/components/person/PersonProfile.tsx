import Link from "next/link";
import type { CreditOnWork, PersonDetail } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { formatDate } from "@/lib/format";

function workHref(work: CreditOnWork["work"]): string {
  if (work.kind === "podcast") return `/podcasts/${work.podcast.slug}`;
  return `/podcasts/${work.podcast.slug}/${work.episode.slug}`;
}

function workTitle(work: CreditOnWork["work"]): string {
  if (work.kind === "podcast") return work.podcast.title;
  return work.episode.title;
}

function workCover(work: CreditOnWork["work"]): string | null {
  if (work.kind === "podcast") return work.podcast.cover_image_url;
  return work.episode.cover_image_url ?? work.podcast.cover_image_url;
}

export function PersonProfile({ data }: { data: PersonDetail }) {
  const { person, credits } = data;
  const sorted = credits
    .slice()
    .sort((a, b) => a.billing_order - b.billing_order);

  const podcastCredits = sorted.filter((c) => c.work.kind === "podcast");
  const episodeCredits = sorted.filter((c) => c.work.kind === "episode");

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
          <Cover src={person.image_url} alt={person.display_name} size="xl" />
          <div className="min-w-0 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Person
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {person.display_name}
            </h1>
            {person.website_url ? (
              <div className="mt-5">
                <a
                  href={person.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#007AFF] text-[15px] font-medium hover:opacity-80"
                >
                  Website
                </a>
              </div>
            ) : null}
          </div>
        </header>

        {person.bio ? (
          <p className="mt-12 text-[17px] leading-relaxed text-white/75 whitespace-pre-line max-w-2xl">
            {person.bio}
          </p>
        ) : null}

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Known for
          </h2>
          <p className="mt-2 text-[15px] text-white/55">
            Credits across the PodBee catalog
          </p>
          <Card className="mt-6 px-6 sm:px-8">
            {sorted.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-[15px] text-white/55">
                  No credits in the catalog yet.
                </p>
                <p className="mt-2 text-[13px] text-white/35">
                  Hosts and guests fill in as shows get richer credit data.
                </p>
                <a
                  href="/#top-overall"
                  className="inline-block mt-5 text-[14px] font-medium text-[#007AFF]"
                >
                  Browse charts →
                </a>
              </div>
            ) : (
              <ul>
                {[...podcastCredits, ...episodeCredits].map((c, i) => {
                  const published =
                    c.work.kind === "episode"
                      ? formatDate(c.work.episode.published_at)
                      : null;
                  const rating =
                    c.work.kind === "podcast"
                      ? (c.work.podcast as { rating_average?: number | null })
                          .rating_average
                      : null;
                  return (
                    <li
                      key={`${c.role_id}-${workHref(c.work)}-${i}`}
                      className="flex gap-5 items-center py-5 border-b border-white/10 last:border-0"
                    >
                      <Cover
                        src={workCover(c.work)}
                        alt={workTitle(c.work)}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={workHref(c.work)}
                          className="text-[17px] font-semibold tracking-tight text-white hover:text-[#007AFF] transition-colors"
                        >
                          {workTitle(c.work)}
                        </Link>
                        <p className="mt-1 text-[13px] text-white/55">
                          {c.role_label}
                          {c.work.kind === "episode"
                            ? ` · ${c.work.podcast.title}`
                            : ""}
                          {rating != null ? ` · ${rating.toFixed(1)}/10` : ""}
                          {published ? ` · ${published}` : ""}
                          {c.character_name ? ` · as ${c.character_name}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
