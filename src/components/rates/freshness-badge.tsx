import { Clock, TriangleAlert } from "lucide-react";
import type { FreshnessStatus } from "@/lib/ingest/status";
import { formatIst } from "@/lib/time";

export function FreshnessBadge({ freshness }: { freshness: FreshnessStatus }) {
  if (freshness.stale) {
    return (
      <div role="status" className="inline-flex max-w-full items-start gap-2 rounded-xl border border-down/40 bg-warn-bg px-3 py-2 text-sm text-warn-ink">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <strong className="font-semibold">Stale</strong>
          {freshness.staleSince ? ` since ${formatIst(freshness.staleSince)}` : " — no successful update yet"}
          <span className="block text-xs opacity-90">
            {freshness.staleSince ? "Showing the last good values. Retrying automatically." : "No rates have been fetched yet."}
          </span>
        </span>
      </div>
    );
  }
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm text-brand-strong">
      <Clock aria-hidden="true" className="size-4" />
      <span>
        Updated <time dateTime={freshness.lastSuccessAt ?? undefined}>{freshness.lastSuccessAt ? formatIst(freshness.lastSuccessAt) : "—"}</time>
      </span>
    </p>
  );
}
