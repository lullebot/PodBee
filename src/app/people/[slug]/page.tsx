import { SiteHeader } from "@/components/layout/SiteHeader";
import { PersonProfile } from "@/components/person/PersonProfile";
import { getPersonDetail } from "@/lib/queries";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPersonDetail(slug);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main className="min-h-screen bg-[#0B1C2C] flex items-center justify-center px-8">
          <div className="text-center max-w-md">
            <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              Person
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
      <PersonProfile data={data} />
    </>
  );
}
