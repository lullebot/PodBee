import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { EpisodeProfile } from "@/components/podcast/EpisodeProfile";
import { FeedEpisodeProfile } from "@/components/podcast/FeedEpisodeProfile";
import { parseFeedEpisodeSlug } from "@/lib/feed-episodes";
import { getFeedEpisodePage, getFeedEpisodeTitle, longTailIndexable } from "@/lib/long-tail";
import { getEpisodeDetail } from "@/lib/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episodeSlug: string }>;
}): Promise<Metadata> {
  const { slug, episodeSlug } = await params;
  if (parseFeedEpisodeSlug(episodeSlug) == null) return {};
  const title = await getFeedEpisodeTitle(slug, episodeSlug);
  if (!title) return {};
  return {
    title: `${title} — PodBee`,
    // Feed episodes span millions of shows × thousands of episodes — keep
    // crawlers off them by default (same switch as long-tail show pages).
    robots: longTailIndexable()
      ? undefined
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string; episodeSlug: string }>;
}) {
  const { slug, episodeSlug } = await params;
  // e-{key} episodes come from the show's RSS feed (any show); the rest are
  // full catalog rows.
  const feedEpisode = await getFeedEpisodePage(slug, episodeSlug);
  if (feedEpisode?.kind === "redirect") redirect(feedEpisode.href);
  if (feedEpisode?.kind === "page") {
    return (
      <>
        <SiteHeader />
        <FeedEpisodeProfile data={feedEpisode.data} />
      </>
    );
  }

  const data = await getEpisodeDetail(slug, episodeSlug);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main className="min-h-screen bg-[#0B1C2C] flex items-center justify-center px-8">
          <div className="text-center max-w-md">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Episode
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              {episodeSlug}
            </h1>
            <p className="mt-4 text-[17px] text-white/55">
              Not in the catalog yet — pages are wired; waiting on data.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <EpisodeProfile data={data} />
    </>
  );
}
