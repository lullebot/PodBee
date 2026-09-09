import { SiteHeader } from "@/components/layout/SiteHeader";
import { PodcastProfile } from "@/components/podcast/PodcastProfile";
import { getPodcastDetail } from "@/lib/queries";

export default async function PodcastPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
