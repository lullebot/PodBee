import Link from "next/link";
import type { PodcastDetail } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { LinkChip } from "@/components/ui/LinkChip";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { EpisodeCardRow } from "@/components/podcast/EpisodeCardRow";

export function PodcastProfile({ data }: { data: PodcastDetail }) {
  const {
    podcast,
    primary_company,
    credits,
    episode_cards,
    genres,
    chart_placements,
    similar,
  } = data;
  const cast = credits
    .slice()
    .sort((a, b) => a.billing_order - b.billing_order);

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
            src={podcast.cover_image_url}
            alt={podcast.title}
            size="xl"
          />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Podcast
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {podcast.title}
            </h1>
            {podcast.subtitle ? (
              <p className="mt-3 text-lg text-white/55 leading-snug">
                {podcast.subtitle}
              </p>
            ) : null}

            <div className="mt-6">
              <RatingBadge
                average={podcast.rating_average}
                count={podcast.rating_count}
              />
            </div>

            {genres.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] font-medium text-white/75"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            ) : null}

            {chart_placements.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
                {chart_placements.map((c) => (
                  <Link
                    key={c.chart_slug}
                    href={`/#${c.chart_slug}`}
                    className="text-[#007AFF] font-medium hover:opacity-80"
                  >
                    #{c.rank} {c.chart_title}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 items-center">
              {primary_company ? (
                <LinkChip href={`/companies/${primary_company.slug}`}>
                  {primary_company.name}
                </LinkChip>
              ) : null}
            </div>
          </div>
        </header>

        {podcast.description ? (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight">Storyline</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/75 whitespace-pre-line max-w-2xl">
              {podcast.description}
            </p>
          </section>
        ) : null}

        {cast.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">Top cast</h2>
            <Card className="mt-6 px-6 sm:px-8 py-2">
              <ul>
                {cast.map((c) => (
                  <li
                    key={`${c.person.id}-${c.role_id}`}
                    className="flex items-center justify-between gap-6 py-4 border-b border-white/10 last:border-0"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Cover
                        src={c.person.image_url}
                        alt={c.person.display_name}
                        size="sm"
                      />
                      <LinkChip href={`/people/${c.person.slug}`}>
                        {c.person.display_name}
                      </LinkChip>
                    </div>
                    <span className="text-[15px] text-white/55 shrink-0">
                      {c.role_label}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}


        {similar.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight">More like this</h2>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/podcasts/${s.slug}`}
                  className="group"
                >
                  <Cover src={s.cover_image_url} alt={s.title} size="fill" />
                  <p className="mt-3 text-[15px] font-semibold tracking-tight text-white group-hover:text-[#007AFF] transition-colors line-clamp-2">
                    {s.title}
                  </p>
                  {s.rating_average != null ? (
                    <p className="mt-1 text-[13px] text-white/55 tabular-nums">
                      {s.rating_average.toFixed(1)}/10
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Episodes</h2>
          <Card className="mt-6 px-6 sm:px-8">
            {episode_cards.length === 0 ? (
              <p className="py-10 text-[15px] text-white/45">
                No episodes in the catalog yet.
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
