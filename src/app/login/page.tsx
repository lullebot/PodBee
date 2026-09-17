import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui/Card";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white flex items-start justify-center px-6 pt-24 pb-32">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-[14px] text-white/55">
            Rate shows and episodes, and build your Listen List.
          </p>

          {message ? (
            <p className="mt-5 rounded-xl bg-[#007AFF]/10 px-4 py-3 text-[13px] text-[#007AFF]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}

          <form action={signIn} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-white/65">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#007AFF]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-white/65">
              Password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#007AFF]"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-full bg-[#007AFF] px-4 py-2.5 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-[13px] text-white/55">
            No account?{" "}
            <Link href="/signup" className="font-medium text-[#007AFF] hover:opacity-80">
              Create one
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
