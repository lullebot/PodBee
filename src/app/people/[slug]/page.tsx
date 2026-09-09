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
      <main className="min-h-screen bg-white flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-400">
            Person
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{slug}</h1>
          <p className="mt-4 text-[17px] text-neutral-500">
            Not in the catalog yet — pages are wired; waiting on data.
          </p>
        </div>
      </main>
    );
  }

  return <PersonProfile data={data} />;
}
