import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui/Card";
import { AuthNotice } from "@/components/auth/AuthParts";
import { SignupForm } from "@/components/auth/SignupForm";
import { getEnabledOAuthProviders } from "@/lib/auth-providers";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, providers] = await Promise.all([
    searchParams,
    getEnabledOAuthProviders(),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white flex items-start justify-center px-6 pt-24 pb-32">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Join PodBee</h1>
          <p className="mt-2 text-[14px] text-white/55">
            Rate shows and episodes, write reviews, and build your Listen List.
          </p>

          <AuthNotice error={error} />

          <SignupForm googleEnabled={providers.google} />

          <p className="mt-6 text-[13px] text-white/55">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#007AFF] hover:opacity-80">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-[12px] text-white/40">
            See our{" "}
            <Link href="/privacy" className="underline hover:text-white/70">
              Privacy Policy
            </Link>{" "}
            for how we handle your data.
          </p>
        </Card>
      </main>
    </>
  );
}
