import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "PodBee",
  description: "The IMDb for podcasts — a structured audio database.",
  // Explicit: production must be indexable for AdSense site verification
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-8390998253822075";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B1C2C] text-white antialiased">
        {/* beforeInteractive → real <script> in initial HTML head; banners still parked */}
        <Script
          id="adsense-client"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        {children}
        <footer className="border-t border-white/10">
          <div className="mx-auto max-w-5xl px-6 sm:px-8 py-8 flex items-center justify-between gap-4 text-[13px] text-white/45">
            <span>© PodBee</span>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
