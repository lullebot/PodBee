"use client";

import { useState } from "react";
import { signInWithGoogle, signUp } from "@/app/auth/actions";
import { GoogleButton, SubmitButton } from "@/components/auth/AuthButtons";
import { AuthField, OrDivider } from "@/components/auth/AuthParts";

/** The news opt-in applies to whichever way the user signs up, so both forms carry it. */
export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const optInValue = marketingOptIn ? "true" : "false";

  return (
    <div className="mt-6">
      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] leading-snug text-white/70">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#007AFF]"
        />
        <span>
          Email me PodBee news and updates. Optional — you can unsubscribe any time.
        </span>
      </label>

      {googleEnabled ? (
        <>
          <form action={signInWithGoogle} className="mt-5">
            <input type="hidden" name="marketing_opt_in" value={optInValue} />
            <GoogleButton label="Sign up with Google" />
          </form>
          <OrDivider />
        </>
      ) : null}

      <form action={signUp} className={`flex flex-col gap-4 ${googleEnabled ? "" : "mt-5"}`}>
        <input type="hidden" name="marketing_opt_in" value={optInValue} />
        <AuthField label="Name" name="name" autoComplete="name" required maxLength={80} />
        <AuthField label="Email" type="email" name="email" autoComplete="email" required />
        <AuthField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <SubmitButton pendingLabel="Creating account…">Create account with email</SubmitButton>
      </form>
    </div>
  );
}
