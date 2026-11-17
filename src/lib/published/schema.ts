import { z } from "zod";
import { seriesOf } from "@/lib/series";

const karat = z.enum(["24K", "22K", "18K"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "not a date");

/**
 * The published snapshot is a minimal, read-only copy of the rates for hosted viewing.
 * `.strict()` everywhere: any extra field (paths, ingest state, secrets) makes the file invalid.
 */
export const publishedSchema = z
  .object({
    schema: z.literal(1),
    location: z.string().min(1),
    generatedAt: iso,
    note: z.string(),
    dailyCloses: z.array(
      z.object({ karat, date, pricePerGram: z.number().positive(), source: z.string().min(1), updatedAt: iso.optional() }).strict(),
    ),
    snapshots: z.array(
      z.object({ karat, date, pricePerGram: z.number().positive(), fetchedAt: iso, source: z.string().min(1) }).strict(),
    ),
  })
  .strict();

export type PublishedSnapshot = z.infer<typeof publishedSchema>;

export interface BuildReport {
  closesIn: number;
  closesOut: number;
  snapshotsIn: number;
  snapshotsOut: number;
  dropped: string[];
}

const NOTE = "Rates saved by the site owner in GoldPulse and published as a read-only snapshot. Not live; not investment advice.";

/**
 * Pure: builds a snapshot from a GoldPulse data file's contents. Copies only whitelisted fields of
 * retail-series records, never derives or fills values, and ignores everything else (ingest state, paths).
 */
export function buildSnapshot(raw: unknown, now: Date, location = "Bhubaneswar"): { snapshot: PublishedSnapshot; report: BuildReport } {
  const o = (raw ?? {}) as { dailyCloses?: unknown; snapshots?: unknown };
  const closesRaw = Array.isArray(o.dailyCloses) ? o.dailyCloses : [];
  const snapsRaw = Array.isArray(o.snapshots) ? o.snapshots : [];
  const dropped: string[] = [];

  const closeItem = publishedSchema.shape.dailyCloses.element;
  const snapItem = publishedSchema.shape.snapshots.element;

  const dailyCloses = closesRaw.flatMap((c, i) => {
    const r = (c ?? {}) as Record<string, unknown>;
    if (typeof r.source === "string" && seriesOf(r.source) !== "retail-site") {
      dropped.push(`close ${i}: source "${r.source}" is not a retail rate`);
      return [];
    }
    const p = closeItem.safeParse({
      karat: r.karat,
      date: r.date,
      pricePerGram: r.pricePerGram,
      source: r.source,
      ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
    });
    if (!p.success) dropped.push(`close ${i}: invalid`);
    return p.success ? [p.data] : [];
  });
  const snapshots = snapsRaw.flatMap((s, i) => {
    const r = (s ?? {}) as Record<string, unknown>;
    if (typeof r.source === "string" && seriesOf(r.source) !== "retail-site") {
      dropped.push(`snapshot ${i}: source "${r.source}" is not a retail rate`);
      return [];
    }
    const p = snapItem.safeParse({ karat: r.karat, date: r.date, pricePerGram: r.pricePerGram, fetchedAt: r.fetchedAt, source: r.source });
    if (!p.success) dropped.push(`snapshot ${i}: invalid`);
    return p.success ? [p.data] : [];
  });
  if (dailyCloses.length === 0) throw new Error("No retail rates found to publish.");

  dailyCloses.sort((a, b) => a.date.localeCompare(b.date) || a.karat.localeCompare(b.karat));
  snapshots.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt) || a.karat.localeCompare(b.karat));

  const snapshot = publishedSchema.parse({ schema: 1, location, generatedAt: now.toISOString(), note: NOTE, dailyCloses, snapshots });
  return {
    snapshot,
    report: {
      closesIn: closesRaw.length,
      closesOut: dailyCloses.length,
      snapshotsIn: snapsRaw.length,
      snapshotsOut: snapshots.length,
      dropped,
    },
  };
}
