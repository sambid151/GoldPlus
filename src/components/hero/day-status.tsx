import { CalendarCheck, CalendarClock } from "lucide-react";
import { formatShortDate } from "@/lib/time";

interface Props {
  latestDate: string;
  daysBehind: number;
  /** Show the "add today's rate" link (local use only). */
  canAdd: boolean;
}

/** Says which day the shown rate belongs to, and nudges when today's rate is missing. */
export function DayStatus({ latestDate, daysBehind, canAdd }: Props) {
  const label = `${formatShortDate(latestDate)} ${latestDate.slice(0, 4)}`;
  if (daysBehind === 0) {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm text-brand-strong">
        <CalendarCheck aria-hidden="true" className="size-4" />
        Today’s rate, <time dateTime={latestDate}>{label}</time>
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-3">
      <p className="inline-flex items-center gap-2 rounded-xl border border-down/40 bg-warn-bg px-3 py-2 text-sm text-warn-ink">
        <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
        <span>
          Latest rate is from <time dateTime={latestDate}>{label}</time> ({daysBehind} day{daysBehind === 1 ? "" : "s"} ago)
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
