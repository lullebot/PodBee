import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { EpisodeProfile } from "@/components/podcast/EpisodeProfile";
import { IndexEpisodeProfile } from "@/components/podcast/IndexEpisodeProfile";
import {
  getLongTailEpisode,
  getLongTailEpisodeTitle,
  longTailIndexable,
} from "@/lib/long-tail";
import { parseIndexPodcastSlug } from "@/lib/podcast-index";
import { getEpisodeDetail } from "@/lib/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episodeSlug: string }>;
}): Promise<Metadata> {
  const { slug, episodeSlug } = await params;
  if (parseIndexPodcastSlug(slug) == null) return {};
  const title = await getLongTailEpisodeTitle(slug, episodeSlug);
  if (!title) return {};
  return {
    title: `${title} — PodBee`,
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
  // pi-{feedId} slugs render live from the open index first; a Supabase row
  // for them (created by the first rating/Listen List add) only holds ratings.
  const longTail = await getLongTailEpisode(slug, episodeSlug);
  if (longTail?.kind === "redirect") redirect(longTail.href);
  if (longTail?.kind === "page") {
    return (
      <>
        <SiteHeader />
        <IndexEpisodeProfile data={longTail.data} />
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
