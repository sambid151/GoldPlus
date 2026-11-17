import { GrowthMark } from "@/components/brand/growth-mark";
import { ThemeToggle } from "./theme-toggle";
import { isHosted } from "@/lib/runtime";

const NAV = [
  { href: "#rates", label: "Rates", short: "Rates" },
  { href: "#history", label: "History", short: "History" },
  { href: "#news", label: "News", short: "News", hideOnMobile: true },
  { href: "#calculator", label: "Calculator", short: "Calc" },
];

/** `base` is "/" on pages other than home, so section links point back to the dashboard. */
export function SiteHeader({ base = "" }: { base?: string }) {
  const showData = !isHosted();
  const onHome = base === "";
  const links = onHome ? NAV : NAV.map((n) => ({ ...n, href: `${base}${n.href}` }));
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href={onHome ? "#main" : "/"} className="flex items-center gap-2 font-semibold tracking-tight">
          <GrowthMark />
          <span translate="no" className="hidden sm:inline">GoldPulse</span>
          <span translate="no" className="sr-only sm:hidden">GoldPulse</span>
        </a>
        <nav aria-label="Sections" className="flex items-center text-sm font-medium sm:gap-1">
          {links.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={`${"hideOnMobile" in n && n.hideOnMobile ? "hidden sm:inline-flex" : ""} whitespace-nowrap rounded-lg px-2 py-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-strong sm:px-3`}
            >
              <span className="sm:hidden" aria-hidden="true">{n.short}</span>
              <span className="sr-only sm:not-sr-only">{n.label}</span>
            </a>
          ))}
          {showData ? (
            <a href="/data" className="whitespace-nowrap rounded-lg bg-brand-soft px-2.5 py-2 text-brand-strong transition-colors hover:bg-surface-2 sm:px-3">
              Add<span className="sr-only sm:not-sr-only"> rate</span>
            </a>
          ) : null}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
