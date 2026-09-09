import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PodBee",
  description: "The IMDb for podcasts — a structured audio database.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B1C2C] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
