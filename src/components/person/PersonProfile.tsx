import Link from "next/link";
import type { CreditOnWork, PersonDetail } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { LinkChip } from "@/components/ui/LinkChip";
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

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-8 pt-24 pb-32">
        <header className="flex flex-col sm:flex-row gap-10 items-start">
          <Cover src={person.image_url} alt={person.display_name} size="xl" />
          <div className="min-w-0 pt-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
              Person
            </p>
            <h1 className="mt-3 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              {person.display_name}
            </h1>
            {person.website_url ? (
              <div className="mt-6">
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
          <p className="mt-16 text-[17px] leading-relaxed text-neutral-700 whitespace-pre-line max-w-2xl">
            {person.bio}
          </p>
        ) : null}

        <section className="mt-20">
          <h2 className="text-3xl font-semibold tracking-tight">Credits</h2>
          <Card className="mt-8 px-8">
            {sorted.length === 0 ? (
              <p className="py-10 text-[15px] text-neutral-400">
                No credits yet.
              </p>
            ) : (
              <ul>
                {sorted.map((c, i) => {
                  const published =
                    c.work.kind === "episode"
                      ? formatDate(c.work.episode.published_at)
                      : null;
                  return (
                    <li
                      key={`${c.role_id}-${workHref(c.work)}-${i}`}
                      className="flex gap-5 items-center py-5 border-b border-black/[0.06] last:border-0"
                    >
                      <Cover
                        src={workCover(c.work)}
                        alt={workTitle(c.work)}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={workHref(c.work)}
                          className="text-[17px] font-semibold tracking-tight text-black hover:text-[#007AFF] transition-colors"
                        >
                          {workTitle(c.work)}
                        </Link>
                        <p className="mt-1 text-[13px] text-neutral-500">
                          {c.role_label}
                          {c.work.kind === "episode"
                            ? ` · ${c.work.podcast.title}`
                            : ""}
                          {published ? ` · ${published}` : ""}
                          {c.character_name ? ` · as ${c.character_name}` : ""}
                        </p>
                      </div>
                      {c.work.kind === "podcast" ? (
                        <LinkChip href={`/podcasts/${c.work.podcast.slug}`}>
                          Show
                        </LinkChip>
                      ) : null}
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
