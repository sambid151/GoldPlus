import { Download } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DayList, type DayRow } from "@/components/data/day-list";
import { ImportPanel } from "@/components/data/import-panel";
import { RateForm } from "@/components/data/rate-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/states";
import { parseDateFlexible } from "@/lib/manual/parse";
import { getRepository } from "@/lib/repo";
import { isHosted, isLocalHost } from "@/lib/runtime";
import { istDate } from "@/lib/time";
import type { DailyClose, Karat } from "@/lib/types";

export const metadata: Metadata = { title: "Add rates — GoldPulse" };

function groupDays(closes: DailyClose[]): DayRow[] {
  const days = new Map<string, DayRow>();
  for (const c of closes) {
    const d = days.get(c.date) ?? { date: c.date, prices: {} as Partial<Record<Karat, number>>, source: c.source };
    d.prices[c.karat] = c.pricePerGram;
    days.set(c.date, d);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

async function DataContent({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  await connection();
  // No sign-in here, so this screen exists only for requests to this machine.
  if (isHosted() || !isLocalHost((await headers()).get("host"))) notFound();

  const { date } = await searchParams;
  const wanted = parseDateFlexible(typeof date === "string" ? date : "");
  const days = groupDays(await getRepository().getDailyCloses());
  const editing = wanted ? days.find((d) => d.date === wanted) : undefined;
  const today = istDate();

  return (
    <>
      <Section
        id="add"
        title={editing ? `Edit ${editing.date}` : "Add a day"}
        description="Type the per-gram prices from your rates source. Use the same source every day so the history stays consistent."
      >
        <RateForm key={editing?.date ?? "new"} today={today} initial={editing ? { date: editing.date, ...editing.prices } : undefined} />
        <p className="mt-4 text-sm text-muted">
          Need today’s numbers?{" "}
          <a className="font-medium text-brand-strong underline underline-offset-2" href="https://www.goodreturns.in/gold-rates/bhubaneswar.html" target="_blank" rel="noopener noreferrer">
            Open the Goodreturns Bhubaneswar page<span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          in your browser and copy them across.
        </p>
      </Section>

      <Section id="import" tone="soft" title="Paste or upload several days" description="Bring in a copied table, a saved page or a CSV. You see a preview before anything is saved.">
        <ImportPanel />
      </Section>

      <Section
        id="stored"
        title="Stored days"
        description={`${days.length} day${days.length === 1 ? "" : "s"} saved on this computer.`}
        aside={
          <div className="flex gap-2">
            <a href="/data/export?format=csv" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-brand-soft">
              <Download aria-hidden="true" className="size-4" /> Export CSV
            </a>
            <a href="/data/export?format=json" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-brand-soft">
              <Download aria-hidden="true" className="size-4" /> Export JSON
            </a>
          </div>
        }
      >
        <DayList days={days} />
      </Section>
    </>
  );
}

export default function DataPage(props: { searchParams: Promise<{ date?: string | string[] }> }) {
  return (
    <>
      <SiteHeader base="/" />
      <main id="main">
        <h1 className="sr-only">Add and import Bhubaneswar gold rates</h1>
        <Suspense
          fallback={
            <Section id="add" title="Add a day">
              <Skeleton className="h-48 w-full" />
            </Section>
          }
        >
          <DataContent searchParams={props.searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
