import { formatRupees } from "@/lib/format";
import { formatTimeIst } from "@/lib/time";
import type { UpdateEntry } from "@/lib/update-time";

/** Every time the 24K price changed on the newest day, so a morning and an afternoon update are both visible. */
export function UpdateLog({ updates }: { updates: UpdateEntry[] }) {
  if (updates.length < 2) return null;
  return (
    <section aria-label="Updates on this day" className="mb-6 rounded-xl border border-line bg-surface p-4 text-sm">
      <h3 className="font-semibold">Updates on this day (24K per gram)</h3>
      <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        {updates.map((u) => (
          <li key={u.at} className="num">
            <time dateTime={u.at} className="text-muted">{formatTimeIst(u.at)}</time>{" "}
            <span className="font-medium">{formatRupees(u.price)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
