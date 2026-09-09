import type { PodcastDetail } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { LinkChip } from "@/components/ui/LinkChip";
import { EpisodeCardRow } from "@/components/podcast/EpisodeCardRow";

export function PodcastProfile({ data }: { data: PodcastDetail }) {
  const { podcast, primary_company, credits, episode_cards } = data;
  const hosts = credits
    .filter((c) => c.role_id === "host" || c.role_id === "co_host")
    .sort((a, b) => a.billing_order - b.billing_order);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-8 pt-24 pb-32">
        <header className="flex flex-col sm:flex-row gap-10 items-start">
          <Cover
            src={podcast.cover_image_url}
            alt={podcast.title}
            size="xl"
          />
          <div className="min-w-0 pt-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
              Podcast
            </p>
            <h1 className="mt-3 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              {podcast.title}
            </h1>
            {podcast.subtitle ? (
              <p className="mt-4 text-xl text-neutral-500 leading-snug">
                {podcast.subtitle}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 items-center">
              {primary_company ? (
                <LinkChip href={`/companies/${primary_company.slug}`}>
                  {primary_company.name}
                </LinkChip>
              ) : null}
              {hosts.map((h) => (
                <LinkChip
                  key={`${h.person.id}-${h.role_id}`}
                  href={`/people/${h.person.slug}`}
                >
                  {h.person.display_name}
                </LinkChip>
              ))}
            </div>
          </div>
        </header>

        {podcast.description ? (
          <p className="mt-16 text-[17px] leading-relaxed text-neutral-700 whitespace-pre-line max-w-2xl">
            {podcast.description}
          </p>
        ) : null}

        {credits.length > 0 ? (
          <section className="mt-20">
            <h2 className="text-3xl font-semibold tracking-tight">Credits</h2>
            <Card className="mt-8 px-8 py-2">
              <ul>
                {credits
                  .slice()
                  .sort((a, b) => a.billing_order - b.billing_order)
                  .map((c) => (
                    <li
                      key={`${c.person.id}-${c.role_id}`}
                      className="flex justify-between gap-6 py-4 border-b border-black/[0.06] last:border-0"
                    >
                      <LinkChip href={`/people/${c.person.slug}`}>
                        {c.person.display_name}
                      </LinkChip>
                      <span className="text-[15px] text-neutral-500 shrink-0">
                        {c.role_label}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <section className="mt-20">
          <h2 className="text-3xl font-semibold tracking-tight">Episodes</h2>
          <Card className="mt-8 px-8">
            {episode_cards.length === 0 ? (
              <p className="py-10 text-[15px] text-neutral-400">
                No episodes yet.
              </p>
            ) : (
              episode_cards.map((card) => (
                <EpisodeCardRow key={card.id} card={card} />
              ))
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
