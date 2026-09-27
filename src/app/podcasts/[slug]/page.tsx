import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { IndexPodcastProfile } from "@/components/podcast/IndexPodcastProfile";
import { PodcastProfile } from "@/components/podcast/PodcastProfile";
import {
  getLongTailPodcast,
  getLongTailPodcastTitle,
  longTailIndexable,
} from "@/lib/long-tail";
import { parseIndexPodcastSlug } from "@/lib/podcast-index";
import { getPodcastDetail } from "@/lib/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (parseIndexPodcastSlug(slug) == null) return {};
  const title = await getLongTailPodcastTitle(slug);
  if (!title) return {};
  return {
    title: `${title} — PodBee`,
    robots: longTailIndexable()
      ? undefined
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export default async function PodcastPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // pi-{feedId} slugs render live from the open index first; a Supabase row
  // for them (created by the first rating/Listen List add) only holds ratings.
  const longTail = await getLongTailPodcast(slug);
  if (longTail?.kind === "redirect") redirect(longTail.href);
  if (longTail?.kind === "page") {
    return (
      <>
        <SiteHeader />
        <IndexPodcastProfile data={longTail.data} />
      </>
    );
  }

  const data = await getPodcastDetail(slug);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main className="min-h-screen bg-[#0B1C2C] flex items-center justify-center px-8">
          <div className="text-center max-w-md">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Podcast
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{slug}</h1>
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
      <PodcastProfile data={data} />
    </>
  );
}
