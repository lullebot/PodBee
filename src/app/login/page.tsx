import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui/Card";
import { signIn, signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton, SubmitButton } from "@/components/auth/AuthButtons";
import { AuthField, AuthNotice, OrDivider } from "@/components/auth/AuthParts";
import { getEnabledOAuthProviders } from "@/lib/auth-providers";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ error, message }, providers] = await Promise.all([
    searchParams,
    getEnabledOAuthProviders(),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white flex items-start justify-center px-6 pt-24 pb-32">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-[14px] text-white/55">
            Welcome back to PodBee.
          </p>

          <AuthNotice error={error} message={message} />

          {providers.google ? (
            <>
              <form action={signInWithGoogle} className="mt-6">
                <GoogleButton label="Continue with Google" />
              </form>
              <OrDivider />
            </>
          ) : null}

          <form
            action={signIn}
            className={`flex flex-col gap-4 ${providers.google ? "" : "mt-6"}`}
          >
            <AuthField label="Email" type="email" name="email" autoComplete="email" required />
            <AuthField
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
            <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
          </form>

          <p className="mt-6 text-[13px] text-white/55">
            New to PodBee?{" "}
            <Link href="/signup" className="font-medium text-[#007AFF] hover:opacity-80">
              Create an account
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
