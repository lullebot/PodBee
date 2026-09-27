import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy Policy — PodBee",
  description: "What PodBee collects, why, who processes it, and your rights.",
};

// A dedicated PodBee address, not anyone's personal email.
const CONTACT_EMAIL = "podbee@gmail.com";
const LAST_UPDATED = "September 27, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-white/75">{children}</div>
    </section>
  );
}

function Mail() {
  if (!CONTACT_EMAIL) return <>our privacy contact address (published here shortly)</>;
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#007AFF] hover:opacity-80">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#0B1C2C] text-white">
        <article className="mx-auto max-w-2xl px-6 sm:px-8 pt-16 sm:pt-24 pb-32">
          <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
            Last updated {LAST_UPDATED}
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Privacy Policy
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-white/75">
            PodBee is a database for discovering podcasts. This page explains what we collect
            when you use it, why, and what you can do about it. For
            anything privacy-related, email <Mail />.
          </p>

          <Section title="What we collect">
            <p>
              <strong className="text-white">If you just browse</strong>, we don&apos;t ask for
              anything and don&apos;t run analytics. Our hosting provider keeps standard server
              logs (such as IP address and pages requested) for security and reliability.
            </p>
            <p>
              <strong className="text-white">If you create an account</strong>, we store your
              email address, the name you give us (or your name and profile photo from Google if
              you sign in with Google), an automatically created username, and when and how you
              signed up. Passwords are stored only in hashed form by our authentication provider —
              we never see them.
            </p>
            <p>
              <strong className="text-white">What you do on PodBee</strong>: your ratings,
              reviews, and Listen List.
            </p>
            <p>
              <strong className="text-white">Your email preference</strong>: whether you&apos;ve
              agreed to receive PodBee news, and when you last changed that choice.
            </p>
          </Section>

          <Section title="What others can see">
            <p>
              A rating on its own is private — it counts toward a title&apos;s public average,
              but nobody can see that you gave it. If you add a written review, the review, your
              rating, and your display name become public. Your Listen List and your email
              address are always private.
            </p>
          </Section>

          <Section title="Why we use it">
            <ul className="list-disc space-y-2 pl-5">
              <li>To run your account and the features you use (ratings, reviews, Listen List).</li>
              <li>
                To send account emails you need, such as confirming your email address.
              </li>
              <li>
                To send PodBee news and updates — <em>only</em> if you tick the box at sign-up or
                subscribe on your profile. You can unsubscribe at any time from your profile or
                the link in any such email.
              </li>
              <li>To keep the service secure and working.</li>
            </ul>
            <p>We don&apos;t sell your personal data.</p>
          </Section>

          <Section title="Who helps us run PodBee">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Supabase</strong> — database and sign-in. Your
                account data is stored in its EU (Frankfurt) region.
              </li>
              <li>
                <strong className="text-white">Vercel</strong> — hosts the website.
              </li>
              <li>
                <strong className="text-white">Google</strong> — only if you choose &ldquo;Continue
                with Google&rdquo;, Google confirms who you are and shares your name, email, and
                profile photo with us.
              </li>
              <li>
                <strong className="text-white">Google AdSense</strong> — the site loads
                Google&apos;s advertising script, which may use cookies or similar technology. See{" "}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  className="text-[#007AFF] hover:opacity-80"
                >
                  how Google uses information from sites that use its services
                </a>
                .
              </li>
              <li>
                <strong className="text-white">Podcast hosts</strong> — cover art is loaded
                directly from each podcast&apos;s own servers, so those servers see your IP
                address when your browser fetches an image.
              </li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>
              When you&apos;re signed in, we set cookies that keep you signed in. They&apos;re
              necessary for accounts to work. Google AdSense may set its own cookies as described
              above.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your account data until you delete your account. If you unsubscribe from
              PodBee news, we stop sending it right away and keep only the record of your choice.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can ask for a copy of your data, ask us to correct or delete it, object to how
              we use it, or withdraw consent for news emails at any time. To delete your account
              or make any other request, email <Mail /> from the address on your account and
              we&apos;ll handle it within 30 days.
            </p>
            <p>
              If you&apos;re in the EU or EEA, you can also complain to your local data
              protection authority.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If we change this policy, we&apos;ll update the date at the top. For significant
              changes we&apos;ll let account holders know by email.
            </p>
          </Section>

          <p className="mt-16 text-[14px] text-white/45">
            <Link href="/" className="text-[#007AFF] hover:opacity-80">
              ← Back to PodBee
            </Link>
          </p>
        </article>
      </main>
    </>
  );
}
