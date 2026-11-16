import { Info } from "lucide-react";

/** Shown whenever the data is an international-spot estimate rather than a retail rate. */
export function EstimateNotice() {
  return (
    <aside className="mb-6 flex gap-3 rounded-2xl border border-line bg-brand-wash p-4 text-sm sm:p-5" aria-label="About this estimate">
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-strong" />
      <div className="min-w-0 text-pretty">
        <p className="font-semibold">This is an estimate, not a shop rate</p>
        <p className="mt-1 text-muted">
          Worked out from the world gold price and USD/INR. It leaves out import duty, GST and the local premium, so a jeweller will charge more. On 16&nbsp;Nov&nbsp;2026 the Bhubaneswar 24K shop rate was about 16% higher.
        </p>
      </div>
    </aside>
  );
}
