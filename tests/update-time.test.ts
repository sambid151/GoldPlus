import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveRows } from "@/lib/manual/rates";
import { FileRateRepository } from "@/lib/repo/file-repository";
import { formatAgo, formatTimeIst, istHour } from "@/lib/time";
import type { DailyClose, Karat, Snapshot } from "@/lib/types";
import { lastUpdateFor, shouldNudgeAfternoon, updatesOn } from "@/lib/update-time";

const snap = (karat: Karat, price: number, fetchedAt: string, date = "2026-11-16"): Snapshot => ({ karat, pricePerGram: price, date, fetchedAt, source: "manual" });
const close = (date: string, updatedAt?: string): DailyClose => ({ karat: "24K", date, pricePerGram: 13680, source: "manual", updatedAt });

describe("time helpers (IST)", () => {
  it("formats time and hour in India time", () => {
    expect(formatTimeIst("2026-11-16T10:12:00Z")).toBe("3:42 pm"); // 15:42 IST
    expect(istHour("2026-11-16T03:40:00Z")).toBe(9);
    expect(istHour("2026-11-16T18:35:00Z")).toBe(0); // 00:05 next day IST
  });
  it("describes elapsed time", () => {
    const now = "2026-11-16T12:00:00Z";
    expect(formatAgo("2026-11-16T11:59:40Z", now)).toBe("just now");
    expect(formatAgo("2026-11-16T11:59:00Z", now)).toBe("1 minute ago");
    expect(formatAgo("2026-11-16T11:18:00Z", now)).toBe("42 minutes ago");
    expect(formatAgo("2026-11-16T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatAgo("2026-11-14T12:00:00Z", now)).toBe("2 days ago");
    expect(formatAgo("2026-11-17T12:00:00Z", now)).toBe("just now"); // future clock skew
  });
});

describe("lastUpdateFor", () => {
  it("uses the time stored with the day, newest if several", () => {
    expect(lastUpdateFor("2026-11-16", [close("2026-11-16", "2026-11-16T04:00:00Z"), close("2026-11-16", "2026-11-16T10:00:00Z")], [])).toBe("2026-11-16T10:00:00Z");
  });
  it("falls back to the newest snapshot of that date for older entries", () => {
    const snaps = [snap("24K", 13700, "2026-11-16T04:00:00Z"), snap("22K", 12558, "2026-11-16T09:00:00Z"), snap("24K", 1, "2026-11-15T09:00:00Z", "2026-11-15")];
    expect(lastUpdateFor("2026-11-16", [close("2026-11-16")], snaps)).toBe("2026-11-16T09:00:00Z");
  });
  it("is null when nothing records a time", () => {
    expect(lastUpdateFor("2026-11-16", [close("2026-11-16")], [])).toBeNull();
  });
});

describe("updatesOn", () => {
  it("lists 24K price changes on the date, oldest first, skipping repeats", () => {
    const snaps = [
      snap("24K", 13680, "2026-11-16T09:00:00Z"),
      snap("24K", 13700, "2026-11-16T04:00:00Z"),
      snap("24K", 13700, "2026-11-16T05:00:00Z"),
      snap("22K", 1, "2026-11-16T06:00:00Z"),
      snap("24K", 9, "2026-11-15T06:00:00Z", "2026-11-15"),
    ];
    expect(updatesOn("2026-11-16", snaps)).toEqual([
      { at: "2026-11-16T04:00:00Z", price: 13700 },
      { at: "2026-11-16T09:00:00Z", price: 13680 },
    ]);
  });
});

describe("shouldNudgeAfternoon", () => {
  const morning = "2026-11-16T04:00:00Z"; // 09:30 IST
  it("nudges when today's rate is from the morning and it is now 2 pm or later", () => {
    expect(shouldNudgeAfternoon(morning, new Date("2026-11-16T09:00:00Z"))).toBe(true); // 14:30 IST
  });
  it("does not nudge before 2 pm, after an afternoon update, on another day, or with no time", () => {
    expect(shouldNudgeAfternoon(morning, new Date("2026-11-16T06:00:00Z"))).toBe(false); // 11:30 IST
    expect(shouldNudgeAfternoon("2026-11-16T08:30:00Z", new Date("2026-11-16T10:00:00Z"))).toBe(false); // updated 14:00 IST
    expect(shouldNudgeAfternoon("2026-11-15T04:00:00Z", new Date("2026-11-16T09:00:00Z"))).toBe(false);
    expect(shouldNudgeAfternoon(null, new Date("2026-11-16T09:00:00Z"))).toBe(false);
  });
});

describe("saving morning and afternoon updates", () => {
  let dir: string;
  let repo: FileRateRepository;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "goldpulse-updates-"));
    repo = new FileRateRepository(path.join(dir, "db.json"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const prices = (k24: number) => ({ "24K": k24, "22K": Math.round((k24 * 22) / 24), "18K": Math.round((k24 * 18) / 24) });

  it("records when each save happened and keeps both updates visible", async () => {
    const morning = new Date("2026-11-16T04:00:00Z");
    const afternoon = new Date("2026-11-16T09:30:00Z");
    await saveRows(repo, [{ date: "2026-11-16", prices: prices(13700) }], { source: "manual", confirmed: false, now: morning });
    await saveRows(repo, [{ date: "2026-11-16", prices: prices(13650) }], { source: "manual", confirmed: false, now: afternoon });

    const closes = await repo.getDailyCloses();
    expect(closes.filter((c) => c.date === "2026-11-16")).toHaveLength(3); // replaced, not duplicated
    expect(lastUpdateFor("2026-11-16", closes, await repo.getSnapshots())).toBe(afternoon.toISOString());
    expect(updatesOn("2026-11-16", await repo.getSnapshots())).toEqual([
      { at: morning.toISOString(), price: 13700 },
      { at: afternoon.toISOString(), price: 13650 },
    ]);
  });
});
