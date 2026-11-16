import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPct, formatSigned } from "@/lib/format";

interface DeltaProps {
  change: number | null;
  pct: number | null;
}

/** Day-over-day change. Direction is shown by icon and sign, not colour alone. */
export function Delta({ change, pct }: DeltaProps) {
  if (change === null || pct === null) {
    return <span className="text-sm text-muted">No previous day stored yet</span>;
  }
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone = dir === "up" ? "bg-brand-soft text-up" : dir === "down" ? "bg-down-soft text-down" : "bg-surface-2 text-muted";
  const word = dir === "up" ? "up" : dir === "down" ? "down" : "unchanged";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold num ${tone}`}>
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">{word}</span>
        {formatSigned(change)}
      </span>
      <span className="text-sm text-muted num">{formatPct(pct)} vs prev. day</span>
    </span>
  );
}
