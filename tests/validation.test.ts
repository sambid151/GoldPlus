import { describe, expect, it } from "vitest";
import { validateBatch, validateRate } from "@/lib/validation";
import type { Karat, Rate } from "@/lib/types";

const mk = (karat: Karat, pricePerGram: number): Rate => ({
  karat, pricePerGram, date: "2026-11-16",
  fetchedAt: "2026-11-16T10:00:00.000Z", source: "test",
});
const good = [mk("24K", 13680), mk("22K", 12540), mk("18K", 10260)];
const last = { "24K": 13762, "22K": 12615, "18K": 10320 };

describe("validateRate", () => {
  it("accepts a normal day-over-day move", () => {
    expect(validateRate(mk("24K", 13680), 13762).ok).toBe(true);
  });
  it("rejects zero", () => expect(validateRate(mk("24K", 0), 13762).ok).toBe(false));
  it("rejects negative", () => expect(validateRate(mk("24K", -5), 13762).ok).toBe(false));
  it("rejects NaN", () => expect(validateRate(mk("24K", NaN), 13762).ok).toBe(false));
  it("rejects a >15% jump", () => {
    const r = validateRate(mk("24K", 13762 * 1.16), 13762);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/jump/);
  });
  it("accepts exactly-15% boundary and below", () => {
    expect(validateRate(mk("24K", 13762 * 1.14), 13762).ok).toBe(true);
  });
  it("accepts any positive price when there is no previous value", () => {
    expect(validateRate(mk("24K", 13680), null).ok).toBe(true);
  });
});

describe("validateBatch", () => {
  it("accepts a consistent batch", () => expect(validateBatch(good, last).ok).toBe(true));
  it("rejects an empty batch", () => {
    const r = validateBatch([], last);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("empty result");
  });
  it("rejects when a karat is missing", () => {
    const r = validateBatch(good.slice(0, 2), last);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/18K: missing/);
  });
  it("rejects when any karat is zero", () => {
    expect(validateBatch([good[0], mk("22K", 0), good[2]], last).ok).toBe(false);
  });
  it("rejects an implausible 22K/24K ratio", () => {
    const r = validateBatch([mk("24K", 13680), mk("22K", 6000), good[2]], {});
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/ratio/);
  });
  it("rejects the whole batch on a >15% jump in one karat", () => {
    const r = validateBatch([mk("24K", 20000), mk("22K", 18333), mk("18K", 15000)], last);
    expect(r.ok).toBe(false);
  });
});
