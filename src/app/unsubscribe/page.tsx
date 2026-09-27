import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui/Card";
import { unsubscribe } from "@/app/actions/community";

/**
 * Target of the unsubscribe link in every PodBee news email:
 * /unsubscribe?token=<community_members.unsubscribe_token>. Asks for a click
 * rather than unsubscribing on page load, so mail scanners that prefetch
 * links can't unsubscribe people by accident.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  let body;
  if (status === "done") {
    body = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re unsubscribed</h1>
        <p className="mt-3 text-[14px] text-white/55">
          You won&apos;t get PodBee news emails anymore. Changed your mind? Turn them back on
          from your{" "}
          <Link href="/profile" className="font-medium text-[#007AFF] hover:opacity-80">
            profile
          </Link>
          .
        </p>
      </>
    );
  } else if (status === "invalid" || !token) {
    body = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Link not valid</h1>
        <p className="mt-3 text-[14px] text-white/55">
          This unsubscribe link didn&apos;t work. You can manage PodBee emails from your{" "}
          <Link href="/profile" className="font-medium text-[#007AFF] hover:opacity-80">
            profile
          </Link>
          .
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Unsubscribe from PodBee news?</h1>
        <p className="mt-3 text-[14px] text-white/55">
          You&apos;ll stop getting news and update emails. Your account stays as it is.
        </p>
        <form action={unsubscribe} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-full bg-[#007AFF] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Unsubscribe
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white flex items-start justify-center px-6 pt-24 pb-32">
        <Card className="w-full max-w-sm p-8">{body}</Card>
      </main>
    </>
  );
}
