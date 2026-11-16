import { describe, expect, it } from "vitest";
import { buildCard, daysBetween, latestPerKarat } from "@/lib/dashboard";
import { buildHistoryRows, buildMonthlySummary } from "@/lib/history-table";
import type { DailyClose, Karat } from "@/lib/types";

const c = (karat: Karat, date: string, pricePerGram: number): DailyClose => ({ karat, date, pricePerGram, source: "manual" });
const data = [
  c("24K", "2026-10-30", 14000), c("24K", "2026-11-01", 14200), c("24K", "2026-11-15", 13762), c("24K", "2026-11-16", 13680),
  c("22K", "2026-11-15", 12615), c("22K", "2026-11-16", 12540),
  c("18K", "2026-11-16", 10260),
];

describe("buildHistoryRows", () => {
  const rows = buildHistoryRows(data);

  it("lists newest first, one row per date", () => {
    expect(rows.map((r) => r.date)).toEqual(["2026-11-16", "2026-11-15", "2026-11-01", "2026-10-30"]);
  });
  it("computes each karat's change versus its own previous stored day", () => {
    expect(rows[0].moves["24K"]).toMatchObject({ change: -82 });
    expect(rows[0].moves["24K"]!.pct).toBeCloseTo(-0.5958, 3);
    expect(rows[0].moves["22K"]).toMatchObject({ change: -75 });
    // 24K on 15 Nov is compared with 1 Nov, the previous stored 24K day
    expect(rows[1].moves["24K"]).toMatchObject({ change: 13762 - 14200 });
  });
  it("has no move for a karat's first day", () => {
    expect(rows[0].moves["18K"]).toBeUndefined();
    expect(rows[3].moves["24K"]).toBeUndefined();
    expect(rows[1].moves["22K"]).toBeUndefined();
  });
  it("handles an empty store", () => expect(buildHistoryRows([])).toEqual([]));
});

describe("buildMonthlySummary", () => {
  it("summarises first, last, high, low and % change per month, newest first", () => {
    const m = buildMonthlySummary(data, "24K");
    expect(m.map((x) => x.month)).toEqual(["2026-11", "2026-10"]);
    expect(m[0]).toMatchObject({ days: 3, first: 14200, last: 13680, high: 14200, low: 13680 });
    expect(m[0].changePct).toBeCloseTo(((13680 - 14200) / 14200) * 100, 6);
    expect(m[1]).toMatchObject({ days: 1, first: 14000, last: 14000, changePct: 0 });
  });
  it("only counts the requested karat", () => {
    expect(buildMonthlySummary(data, "22K")).toHaveLength(1);
    expect(buildMonthlySummary([], "24K")).toEqual([]);
  });
});

describe("dashboard helpers", () => {
  it("counts whole calendar days, including across months and years", () => {
    expect(daysBetween("2026-11-15", "2026-11-16")).toBe(1);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-11-16", "2026-11-16")).toBe(0);
    expect(daysBetween("2026-11-16", "2026-11-14")).toBe(-2);
  });
  it("picks the newest close per karat", () => {
    const l = latestPerKarat(data);
    expect(l["24K"]).toMatchObject({ date: "2026-11-16", pricePerGram: 13680 });
    expect(l["18K"]).toMatchObject({ pricePerGram: 10260 });
  });
  it("builds a card whose change follows a manual edit of the latest day", () => {
    const edited = [...data.filter((x) => !(x.karat === "24K" && x.date === "2026-11-16")), c("24K", "2026-11-16", 13700)];
    const card = buildCard("24K", latestPerKarat(edited)["24K"]!, edited);
    expect(card).toMatchObject({ pricePerGram: 13700, change: 13700 - 13762 });
  });
});
