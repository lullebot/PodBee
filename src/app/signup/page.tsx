import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui/Card";
import { signUp } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white flex items-start justify-center px-6 pt-24 pb-32">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-2 text-[14px] text-white/55">
            Rate shows and episodes, and build your Listen List.
          </p>

          {error ? (
            <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}

          <form action={signUp} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-white/65">
              Username
              <input
                type="text"
                name="username"
                autoComplete="username"
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20 letters, numbers, or underscores"
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#007AFF]"
              />
            </label>
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
                minLength={6}
                autoComplete="new-password"
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#007AFF]"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-full bg-[#007AFF] px-4 py-2.5 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Create account
            </button>
          </form>

          <p className="mt-6 text-[13px] text-white/55">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#007AFF] hover:opacity-80">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
