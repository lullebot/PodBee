export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartList } from "@/components/charts/ChartList";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  CHART_SLUGS,
  chartMethodBlurb,
  getChartBoardBySlug,
} from "@/lib/charts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return CHART_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getChartBoardBySlug(slug);
  if (!result) return { title: "Chart · PodBee" };
  return {
    title: `${result.board.chart.title} · PodBee`,
    description: chartMethodBlurb(slug, result.board.chart.kind),
  };
}

export default async function ChartPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getChartBoardBySlug(slug);
  if (!result) notFound();

  const { board } = result;
  const n = board.entries.length;
  const blurb = chartMethodBlurb(board.chart.slug, board.chart.kind);

  return (
    <main className="min-h-screen bg-[#0B1C2C] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-10 sm:pt-14 pb-28">
        <Link
          href="/"
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-80"
        >
          ← Charts
        </Link>

        <header className="mt-8">
          <p className="text-[13px] font-medium uppercase tracking-wide text-white/45">
            Chart
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            {board.chart.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] sm:text-[17px] text-white/55 leading-snug">
            {blurb}
          </p>
          <p className="mt-3 text-[13px] text-white/40">
            {n} title{n === 1 ? "" : "s"}
          </p>
        </header>

        <ChartList board={board} />
      </div>
    </main>
  );
}
