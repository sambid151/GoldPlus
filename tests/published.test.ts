import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishedSnapshotRepository } from "@/lib/published/repository";
import { buildSnapshot, publishedSchema } from "@/lib/published/schema";
import { resolveProviderName } from "@/lib/providers/name";
import { isPublishedMode } from "@/lib/runtime";
import { seriesOf } from "@/lib/series";

const NOW = new Date("2026-11-17T04:00:00Z");

// A raw local data file, including things that must never be published.
const raw = {
  dailyCloses: [
    { karat: "24K", date: "2026-11-16", pricePerGram: 13680, source: "saved-html", fetchedAt: "2026-11-16T10:49:54.948Z", updatedAt: "2026-11-16T10:49:54.948Z" },
    { karat: "22K", date: "2026-11-16", pricePerGram: 12540, source: "manual", updatedAt: "2026-11-16T10:49:54.948Z" },
    { karat: "24K", date: "2026-11-15", pricePerGram: 13762, source: "import" },
    { karat: "24K", date: "2026-11-16", pricePerGram: 11768, source: "spot-estimate" }, // different series: must be dropped
    { karat: "24K", date: "2026-11-14", pricePerGram: -5, source: "manual" }, // invalid: must be dropped
  ],
  snapshots: [
    { karat: "24K", date: "2026-11-16", pricePerGram: 13700, fetchedAt: "2026-11-16T04:00:00.000Z", source: "manual", id: "x" },
    { karat: "24K", date: "2026-11-16", pricePerGram: 13680, fetchedAt: "2026-11-16T10:49:54.948Z", source: "saved-html" },
    { karat: "24K", date: "2026-11-16", pricePerGram: 11768, fetchedAt: "2026-11-16T11:00:00.000Z", source: "spot-estimate" },
  ],
  state: { lastError: "C:\\Users\\someone\\private\\path failed", nextRetryAt: null, lastSuccessAt: null, lastAttemptAt: null, consecutiveFailures: 3 },
  secretField: "sk-should-never-appear",
  path: "C:\\Users\\someone\\goldpulse\\.data\\goldpulse.json",
};

describe("buildSnapshot", () => {
  const { snapshot, report } = buildSnapshot(raw, NOW);

  it("keeps only retail-series, valid records and reports what it dropped", () => {
    expect(snapshot.dailyCloses).toHaveLength(3);
    expect(snapshot.snapshots).toHaveLength(2);
    expect(report).toMatchObject({ closesIn: 5, closesOut: 3, snapshotsIn: 3, snapshotsOut: 2 });
    expect(report.dropped.join(" ")).toMatch(/spot-estimate/);
    expect(report.dropped.join(" ")).toMatch(/invalid/);
    expect(snapshot.dailyCloses.every((c) => seriesOf(c.source) === "retail-site")).toBe(true);
  });

  it("copies only whitelisted fields: no ingest state, paths, secrets or extra keys", () => {
    const text = JSON.stringify(snapshot);
    expect(text).not.toMatch(/sk-should|someone|C:\\\\|lastError|consecutiveFailures|secretField|"id"|fetchedAt":"2026-11-16T10:49:54.948Z","updatedAt/);
    expect(Object.keys(snapshot).sort()).toEqual(["dailyCloses", "generatedAt", "location", "note", "schema", "snapshots"]);
    for (const c of snapshot.dailyCloses) expect(Object.keys(c).every((k) => ["karat", "date", "pricePerGram", "source", "updatedAt"].includes(k))).toBe(true);
    for (const s of snapshot.snapshots) expect(Object.keys(s).sort()).toEqual(["date", "fetchedAt", "karat", "pricePerGram", "source"]);
  });

  it("never derives or invents values: every output price exists in the input", () => {
    for (const c of snapshot.dailyCloses) {
      expect(raw.dailyCloses.some((r) => r.karat === c.karat && r.date === c.date && r.pricePerGram === c.pricePerGram && r.source === c.source)).toBe(true);
    }
    for (const s of snapshot.snapshots) {
      expect(raw.snapshots.some((r) => r.karat === s.karat && r.date === s.date && r.pricePerGram === s.pricePerGram && r.fetchedAt === s.fetchedAt)).toBe(true);
    }
    // 18K is absent in the input and stays absent (not derived from 24K).
    expect(snapshot.dailyCloses.some((c) => c.karat === "18K")).toBe(false);
  });

  it("sorts by date and keeps the generation time", () => {
    expect(snapshot.dailyCloses.map((c) => c.date)).toEqual(["2026-11-15", "2026-11-16", "2026-11-16"]);
    expect(snapshot.snapshots.map((s) => s.fetchedAt)).toEqual(["2026-11-16T04:00:00.000Z", "2026-11-16T10:49:54.948Z"]);
    expect(snapshot.generatedAt).toBe(NOW.toISOString());
    expect(snapshot.location).toBe("Bhubaneswar");
  });

  it("refuses to publish when there is nothing valid", () => {
    expect(() => buildSnapshot({ dailyCloses: [], snapshots: [] }, NOW)).toThrow(/No retail rates/);
    expect(() => buildSnapshot({ dailyCloses: [{ karat: "24K", date: "2026-11-16", pricePerGram: 1, source: "spot-estimate" }] }, NOW)).toThrow();
    expect(() => buildSnapshot(null, NOW)).toThrow();
  });

  it("is not affected by the input being mutated afterwards", () => {
    const copy = JSON.parse(JSON.stringify(raw));
    const built = buildSnapshot(copy, NOW).snapshot;
    copy.dailyCloses[0].pricePerGram = 1;
    expect(built.dailyCloses.find((c) => c.date === "2026-11-16" && c.karat === "24K" && c.source === "saved-html")?.pricePerGram).toBe(13680);
  });
});

describe("publishedSchema is strict", () => {
  const ok = buildSnapshot(raw, NOW).snapshot;
  it("accepts a built snapshot", () => expect(publishedSchema.safeParse(ok).success).toBe(true));
  it("rejects extra top-level, per-record or malformed fields", () => {
    expect(publishedSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(publishedSchema.safeParse({ ...ok, dailyCloses: [{ ...ok.dailyCloses[0], path: "C:/x" }] }).success).toBe(false);
    expect(publishedSchema.safeParse({ ...ok, dailyCloses: [{ ...ok.dailyCloses[0], pricePerGram: 0 }] }).success).toBe(false);
    expect(publishedSchema.safeParse({ ...ok, schema: 2 }).success).toBe(false);
  });
});

describe("the bundled published/snapshot.json", () => {
  const file = JSON.parse(readFileSync(path.join(__dirname, "../published/snapshot.json"), "utf8"));
  it("is valid, retail-only and contains Bhubaneswar rates", () => {
    const s = publishedSchema.parse(file);
    expect(s.location).toBe("Bhubaneswar");
    expect(s.dailyCloses.length).toBeGreaterThan(0);
    expect(s.dailyCloses.every((c) => seriesOf(c.source) === "retail-site")).toBe(true);
    expect(JSON.stringify(file)).not.toMatch(/C:\\\\|\.data|spot-estimate|secret|token|password/i);
  });
});

describe("PublishedSnapshotRepository", () => {
  const repo = new PublishedSnapshotRepository(buildSnapshot(raw, NOW).snapshot);

  it("reads closes, snapshots and the generation time", async () => {
    expect(await repo.getDailyCloses()).toHaveLength(3);
    expect((await repo.getSnapshots()).map((s) => s.pricePerGram)).toEqual([13700, 13680]);
    expect((await repo.getLatestSnapshots())["24K"]?.pricePerGram).toBe(13680);
    expect((await repo.getLatestSnapshots())["18K"]).toBeNull();
    expect(repo.generatedAt).toBe(NOW.toISOString());
    expect((await repo.getIngestState()).consecutiveFailures).toBe(0);
  });
  it("is strictly read-only", async () => {
    await expect(repo.upsertDailyCloses([])).rejects.toThrow(/read-only/);
    await expect(repo.deleteDay("2026-11-16")).rejects.toThrow(/read-only/);
    await expect(repo.insertSnapshot({ karat: "24K", pricePerGram: 1, date: "2026-11-16", fetchedAt: NOW.toISOString(), source: "x" })).rejects.toThrow(/read-only/);
    await expect(repo.saveIngestState({ lastSuccessAt: null, lastAttemptAt: null, consecutiveFailures: 0, lastError: null, nextRetryAt: null })).rejects.toThrow(/read-only/);
  });
});

describe("hosted wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("published mode is hosted without both Supabase variables", () => {
    const base = { VERCEL: "1" } as unknown as NodeJS.ProcessEnv;
    expect(isPublishedMode(base)).toBe(true);
    expect(isPublishedMode({ ...base, SUPABASE_URL: "https://x.supabase.co" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isPublishedMode({ ...base, SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "k" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isPublishedMode({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("the hosted default provider is 'published', never the spot estimate", () => {
    expect(resolveProviderName({ VERCEL: "1" } as unknown as NodeJS.ProcessEnv)).toBe("published");
    expect(resolveProviderName({} as NodeJS.ProcessEnv)).toBe("saved-html");
  });

  it("hosted without Supabase loads the bundled snapshot instead of failing", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getRepository } = await import("@/lib/repo");
    const closes = await getRepository().getDailyCloses();
    expect(closes.length).toBeGreaterThan(0);
    expect(closes.every((c) => seriesOf(c.source) === "retail-site")).toBe(true);
    await expect(getRepository().upsertDailyCloses([])).rejects.toThrow(/read-only/);
  });

  it("hosted copy says Bhubaneswar, never India or estimate, and never claims 'today'", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getSite } = await import("@/lib/site");
    expect(getSite()).toMatchObject({ location: "Bhubaneswar", estimate: false, published: true, ratesTitle: "Latest rates" });
  });
});
