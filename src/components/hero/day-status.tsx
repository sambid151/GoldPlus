import { CalendarCheck, CalendarClock, Clock } from "lucide-react";
import { formatAgo, formatShortDate, formatTimeIst } from "@/lib/time";

interface Props {
  latestDate: string;
  daysBehind: number;
  /** ISO time the rate was last saved, if known. */
  lastUpdatedAt: string | null;
  nowIso: string;
  /** Today's rate is from the morning and it is now afternoon. */
  nudgeAfternoon: boolean;
  /** Show the "add today's rate" link (local use only). */
  canAdd: boolean;
}

/** Says which day the shown rate belongs to, exactly when it was last updated, and nudges when it may be out of date. */
export function DayStatus({ latestDate, daysBehind, lastUpdatedAt, nowIso, nudgeAfternoon, canAdd }: Props) {
  const label = `${formatShortDate(latestDate)} ${latestDate.slice(0, 4)}`;
  const updated = lastUpdatedAt ? (
    <>
      Updated <time dateTime={lastUpdatedAt}>{formatTimeIst(lastUpdatedAt)} IST</time> ({formatAgo(lastUpdatedAt, nowIso)})
    </>
  ) : (
    "Update time not recorded"
  );

  if (daysBehind === 0) {
    return (
      <div className="space-y-2">
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-brand-soft px-3 py-1.5 text-sm text-brand-strong">
          <CalendarCheck aria-hidden="true" className="size-4" />
          <span>
            Rate for today, <time dateTime={latestDate}>{label}</time>
          </span>
          <span aria-hidden="true">·</span>
          <Clock aria-hidden="true" className="size-4" />
          <span>{updated}</span>
        </p>
        <p className="text-xs text-on-band-muted">The time is when this rate was saved in GoldPulse, not when the source published it.</p>
        {nudgeAfternoon ? (
          <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-on-band">
            <span>Rates are often revised in the afternoon. This one is from the morning.</span>
            {canAdd ? (
              <a href="/data#add" className="inline-flex min-h-9 items-center rounded-xl bg-white px-3 font-semibold text-green-800 hover:bg-green-50">
                Add an update
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-3">
      <p className="inline-flex items-center gap-2 rounded-xl border border-down/40 bg-warn-bg px-3 py-2 text-sm text-warn-ink">
        <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
        <span>
          Latest rate is from <time dateTime={latestDate}>{label}</time> ({daysBehind} day{daysBehind === 1 ? "" : "s"} ago). {updated}
        </span>
      </p>
      {canAdd ? (
        <a href="/data#add" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-green-800 shadow-sm hover:bg-green-50">
          Add today’s rate
        </a>
      ) : null}
    </div>
  );
}
