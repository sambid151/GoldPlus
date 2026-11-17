import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { HeroBars } from "@/components/brand/hero-bars";
import { FreshnessBadge } from "@/components/rates/freshness-badge";
import { DayStatus } from "./day-status";
import { isHosted } from "@/lib/runtime";
import { getDashboardData } from "@/lib/dashboard";
import { formatPct, formatRupees, formatSigned } from "@/lib/format";
import { getSite } from "@/lib/site";
import { formatShortDate } from "@/lib/time";
import type { RateCardData } from "@/lib/dashboard";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="band relative isolate overflow-hidden">
      <HeroBars />
      <div className="relative mx-auto min-h-[22rem] w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">{children}</div>
    </div>
  );
}

function headline(site: ReturnType<typeof getSite>): string {
  if (site.published) return `${site.location} Gold Rates`;
  return site.estimate ? `${site.location} gold price today (estimate)` : `Gold price today in ${site.location}`;
}

export function HeroFallback() {
  const site = getSite();
  return (
    <Shell>
      <h1 className="text-xl font-semibold text-on-band sm:text-2xl">{headline(site)}</h1>
      <div aria-busy="true" aria-label="Loading price…" className="mt-6 space-y-4">
        <div className="skeleton h-16 w-64 opacity-30" />
        <div className="skeleton h-6 w-48 opacity-30" />
      </div>
    </Shell>
  );
}

function Move({ card }: { card: RateCardData }) {
  if (card.change === null || card.changePct === null) {
    return <p className="text-on-band-muted">Yesterday’s price isn’t stored yet, so there is no change to show.</p>;
  }
  const dir = card.change > 0 ? "up" : card.change < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const word = dir === "up" ? "Up" : dir === "down" ? "Down" : "Unchanged";
  return (
    <p className="flex flex-wrap items-center gap-2 text-lg text-on-band">
      <Icon aria-hidden="true" className="size-6" />
      <span className="num font-semibold">
        <span className="sr-only">{word} </span>
        {formatSigned(card.change)} ({formatPct(card.changePct)})
      </span>
      <span className="text-on-band-muted">{card.prevDate ? `since ${formatShortDate(card.prevDate)}` : "since the previous day"}</span>
    </p>
  );
}

export async function Hero() {
  const site = getSite();
  const { estimate } = site;
  let data;
  try {
    data = await getDashboardData();
  } catch {
    data = null; // the Rates section shows the detailed error
  }
  const main = data?.cards.find((c) => c.karat === "24K") ?? data?.cards[0];
  const others = data?.cards.filter((c) => c !== main) ?? [];

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-on-band sm:text-2xl">{headline(site)}</h1>
      {main && data ? (
        <div className="mt-5 space-y-4">
          <p className="num text-6xl font-semibold tracking-tight text-on-band sm:text-7xl">
            {formatRupees(main.pricePerGram)}
            <span className="ml-2 whitespace-nowrap text-xl font-medium text-on-band-muted sm:text-2xl">per gram, {main.karat}</span>
          </p>
          <Move card={main} />
          {others.length > 0 ? (
            <p className="num text-on-band-muted">
              {others.map((c, i) => (
                <span key={c.karat}>
                  {i > 0 ? "   |   " : ""}
                  <span className="font-medium text-on-band">{c.karat}</span> {formatRupees(c.pricePerGram)}/g
                </span>
              ))}
            </p>
          ) : null}
          {estimate || !data.latestDate ? (
            <FreshnessBadge freshness={data.freshness} />
          ) : (
            <DayStatus
              latestDate={data.latestDate}
              daysBehind={data.daysBehind}
              lastUpdatedAt={data.lastUpdatedAt}
              nowIso={data.nowIso}
              nudgeAfternoon={data.nudgeAfternoon}
              canAdd={!isHosted()}
              publishedAt={data.publishedAt}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 max-w-md space-y-3 text-on-band-muted">
          <p>{data ? "No rates are saved yet." : "The latest price isn’t available right now."}</p>
          {data && !isHosted() ? (
            <a href="/data#add" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-green-800 hover:bg-green-50">
              Add your first rate
            </a>
          ) : null}
        </div>
      )}
    </Shell>
  );
}
