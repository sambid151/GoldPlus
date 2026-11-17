import type { RateRepository } from "@/lib/repo/types";
import { seriesOf } from "@/lib/series";
import { istDate } from "@/lib/time";
import { KARATS, type DailyClose, type Karat } from "@/lib/types";
import { checkPurityRatios, MAX_JUMP_FRACTION } from "@/lib/validation";
import { parseDateFlexible, type ParsedRow } from "./parse";

export type ManualSource = "manual" | "import";

export interface RowCheck {
  row: ParsedRow;
  /** Blocking problems. */
  errors: string[];
  /** Needs an explicit "save anyway". */
  confirm: string[];
  /** Existing stored prices this row would replace. */
  replaces: Partial<Record<Karat, number>>;
  /** Every price given already matches what is stored for that day. */
  identical: boolean;
}

export interface CheckResult {
  rows: RowCheck[];
  /** Store-level blocking problem (e.g. it holds a different data series). */
  storeError: string | null;
}

const MIN_DATE = "2000-01-01";
const PLAUSIBLE_MIN = 500;
const PLAUSIBLE_MAX = 500_000;

const byDate = (a: DailyClose, b: DailyClose) => a.date.localeCompare(b.date);

/** Neighbouring stored close for a karat: nearest earlier day, else nearest later day. */
function neighbour(closes: DailyClose[], karat: Karat, date: string): DailyClose | undefined {
  const same = closes.filter((c) => c.karat === karat && c.date !== date).sort(byDate);
  return [...same].reverse().find((c) => c.date < date) ?? same.find((c) => c.date > date);
}

export function storeSeriesProblem(closes: DailyClose[]): string | null {
  const latest = [...closes].sort(byDate).at(-1);
  if (!latest || seriesOf(latest.source) === "retail-site") return null;
  return `This data file holds "${latest.source}" prices, a different series from Bhubaneswar retail rates. Use a separate data file (GOLDPULSE_DATA_FILE) or clear it first.`;
}

/** Pure validation of rows against what is already stored. Nothing is written. */
export function checkRows(rows: ParsedRow[], closes: DailyClose[], today: string): CheckResult {
  const checks = rows.map<RowCheck>((row) => {
    const errors: string[] = [];
    const confirm: string[] = [];
    const replaces: Partial<Record<Karat, number>> = {};

    if (parseDateFlexible(row.date) !== row.date || row.date < MIN_DATE) errors.push("The date is not valid.");
    else if (row.date > today) errors.push("The date is in the future.");

    const given = KARATS.filter((k) => row.prices[k] !== undefined);
    if (given.length === 0) errors.push("Enter at least one price.");
    for (const k of given) {
      const p = row.prices[k]!;
      if (!Number.isFinite(p) || p <= 0) errors.push(`${k} must be a number above 0.`);
      else if (p < PLAUSIBLE_MIN || p > PLAUSIBLE_MAX) errors.push(`${k} ₹${p} per gram is outside the plausible range.`);
    }
    if (errors.length === 0) {
      errors.push(...checkPurityRatios(row.prices).map((r) => r.replace("ratio to 24K", "price compared with 24K")));
      for (const k of given) {
        const p = row.prices[k]!;
        const prev = neighbour(closes, k, row.date);
        if (prev && Math.abs(p - prev.pricePerGram) / prev.pricePerGram > MAX_JUMP_FRACTION) {
          confirm.push(`${k} differs by more than ${MAX_JUMP_FRACTION * 100}% from ${prev.date} (₹${prev.pricePerGram}). Check it is per gram, not per 10 g.`);
        }
        const existing = closes.find((c) => c.karat === k && c.date === row.date);
        if (existing && existing.pricePerGram !== p) replaces[k] = existing.pricePerGram;
      }
    }
    const identical =
      errors.length === 0 &&
      given.length > 0 &&
      given.every((k) => closes.find((c) => c.karat === k && c.date === row.date)?.pricePerGram === row.prices[k]);
    return { row, errors, confirm, replaces, identical };
  });
  return { rows: checks, storeError: storeSeriesProblem(closes) };
}

export type SaveOutcome =
  | { ok: true; saved: number }
  | { ok: false; reason: "invalid" | "needs-confirm" | "store"; message: string; check: CheckResult };

/** All-or-nothing save of rows as daily closes (and snapshots when a row is the newest day). */
export async function saveRows(
  repo: RateRepository,
  rows: ParsedRow[],
  opts: { source: ManualSource; confirmed: boolean; now?: Date },
): Promise<SaveOutcome> {
  const now = opts.now ?? new Date();
  const closes = await repo.getDailyCloses();
  const check = checkRows(rows, closes, istDate(now));

  if (check.storeError) return { ok: false, reason: "store", message: check.storeError, check };
  if (check.rows.length === 0) return { ok: false, reason: "invalid", message: "There is nothing to save.", check };
  if (check.rows.some((r) => r.errors.length > 0)) {
    return { ok: false, reason: "invalid", message: "Fix the highlighted problems and try again.", check };
  }
  if (!opts.confirmed && check.rows.some((r) => r.confirm.length > 0)) {
    return { ok: false, reason: "needs-confirm", message: "Some values look unusual. Review them, then save anyway.", check };
  }

  const out: DailyClose[] = rows.flatMap((row) =>
    KARATS.flatMap((k) => (row.prices[k] !== undefined ? [{ karat: k, date: row.date, pricePerGram: row.prices[k]!, source: opts.source, updatedAt: now.toISOString() }] : [])),
  );
  await repo.upsertDailyCloses(out);

  // Keep the change-detection snapshots in step when the newest day was touched.
  const newest = [...closes.map((c) => c.date), ...rows.map((r) => r.date)].sort().at(-1);
  const latest = await repo.getLatestSnapshots();
  for (const row of rows.filter((r) => r.date === newest)) {
    for (const k of KARATS) {
      const p = row.prices[k];
      if (p !== undefined && latest[k]?.pricePerGram !== p) {
        await repo.insertSnapshot({ karat: k, pricePerGram: p, date: row.date, fetchedAt: now.toISOString(), source: opts.source });
      }
    }
  }
  return { ok: true, saved: rows.length };
}

export async function deleteDay(repo: RateRepository, date: string): Promise<void> {
  await repo.deleteDay(date);
}

/** CSV with header `date,24K,22K,18K`, oldest first; blank cells for missing karats. */
export function toCsv(closes: DailyClose[]): string {
  const days = new Map<string, Partial<Record<Karat, number>>>();
  for (const c of closes) days.set(c.date, { ...days.get(c.date), [c.karat]: c.pricePerGram });
  const lines = ["date,24K,22K,18K"];
  for (const date of [...days.keys()].sort()) {
    const d = days.get(date)!;
    lines.push([date, ...KARATS.map((k) => d[k] ?? "")].join(","));
  }
  return lines.join("\n") + "\n";
}
