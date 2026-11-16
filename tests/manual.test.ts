import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCsv, parseDateFlexible, parseImport, parsePastedText, parseSavedHtml } from "@/lib/manual/parse";
import { checkRows, deleteDay, saveRows, toCsv } from "@/lib/manual/rates";
import { FileRateRepository } from "@/lib/repo/file-repository";
import { seriesOf } from "@/lib/series";
import type { DailyClose, Karat } from "@/lib/types";
import { samplePageHtml } from "./helpers/sample-page";

const TODAY = "2026-11-16";
const NOW = new Date("2026-11-16T10:00:00Z");
const close = (karat: Karat, date: string, pricePerGram: number, source = "saved-html"): DailyClose => ({ karat, date, pricePerGram, source });

describe("parseDateFlexible", () => {
  it.each([
    ["2026-11-16", "2026-11-16"],
    ["16/11/2026", "2026-11-16"],
    ["16-11-2026", "2026-11-16"],
    ["Nov 16, 2026", "2026-11-16"],
    ["16 Nov 2026", "2026-11-16"],
    ["1/2/2026", "2026-02-01"], // day first
  ])("%s -> %s", (input, out) => expect(parseDateFlexible(input)).toBe(out));
  it("rejects impossible and unreadable dates", () => {
    expect(parseDateFlexible("31/02/2026")).toBeNull();
    expect(parseDateFlexible("2026-13-01")).toBeNull();
    expect(parseDateFlexible("yesterday")).toBeNull();
  });
});

describe("parsePastedText", () => {
  const tab = [
    "Date\t24K\t22K",
    "Nov 16, 2026\t₹13,680 (-82)\t₹12,540 (-75)",
    "Nov 15, 2026\t₹13,762 (0)\t₹12,615 (0)",
    "Nov 14, 2026\t₹13,762 (+27)\t₹12,615 (+25)",
  ].join("\n");

  it("reads a copied history table, ignoring the change in brackets", () => {
    const r = parsePastedText(tab, TODAY);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { date: "2026-11-14", prices: { "24K": 13762, "22K": 12615 }, dateAssumed: undefined },
      { date: "2026-11-15", prices: { "24K": 13762, "22K": 12615 }, dateAssumed: undefined },
      { date: "2026-11-16", prices: { "24K": 13680, "22K": 12540 }, dateAssumed: undefined },
    ]);
  });
  it("takes the 1 gram row of a per-gram table as today's rate and flags the assumed date", () => {
    const perGram = "Gram\t24K\t22K\t18K\n1\t₹13,680 (-82)\t₹12,540 (-75)\t₹10,260 (-62)\n8\t₹1,09,440\t₹1,00,320\t₹82,080\n10\t₹1,36,800\t₹1,25,400\t₹1,02,600";
    const r = parsePastedText(perGram, TODAY);
    expect(r.rows).toEqual([{ date: TODAY, prices: { "24K": 13680, "22K": 12540, "18K": 10260 }, dateAssumed: true }]);
  });
  it("follows the header's column order", () => {
    const r = parsePastedText("Date 22K 24K\n16/11/2026 12540 13680", TODAY);
    expect(r.rows[0].prices).toEqual({ "22K": 12540, "24K": 13680 });
  });
  it("reports when nothing usable is pasted", () => {
    expect(parsePastedText("hello world", TODAY).problems[0]).toMatch(/No dated price rows/);
    expect(parsePastedText("", TODAY).rows).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("reads quoted Indian-format numbers and mixed date styles", () => {
    const r = parseCsv('date,24K,22K,18K\n2026-11-16,"13,680","12,540","10,260"\n15/11/2026,13762,12615,');
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { date: "2026-11-15", prices: { "24K": 13762, "22K": 12615 } },
      { date: "2026-11-16", prices: { "24K": 13680, "22K": 12540, "18K": 10260 } },
    ]);
  });
  it("handles header order, BOM, semicolons and no header", () => {
    expect(parseCsv("﻿Date;22K;24K\n2026-11-16;12540;13680").rows[0].prices).toEqual({ "22K": 12540, "24K": 13680 });
    expect(parseCsv("2026-11-16,13680,12540,10260").rows[0].prices).toEqual({ "24K": 13680, "22K": 12540, "18K": 10260 });
  });
  it("collects line problems without losing good rows", () => {
    const r = parseCsv("date,24K\nnope,13680\n2026-11-16,abc\n2026-11-15,13762");
    expect(r.rows).toHaveLength(1);
    expect(r.problems.join(" ")).toMatch(/Line 2.*date/);
    expect(r.problems.join(" ")).toMatch(/Line 3.*not a number/);
  });
  it("explains an unusable file", () => {
    expect(parseCsv("").problems[0]).toMatch(/empty/);
    expect(parseCsv("date,price\n2026-11-16,1").problems[0]).toMatch(/No 24K/);
  });
});

describe("parseSavedHtml / parseImport", () => {
  const html = samplePageHtml();

  it("turns the saved page into 10 days, with today's 18K merged in", () => {
    const r = parseSavedHtml(html, TODAY);
    expect(r.rows).toHaveLength(10);
    expect(r.rows.at(-1)).toMatchObject({ date: "2026-11-16", prices: { "24K": 13680, "22K": 12540, "18K": 10260 } });
    expect(r.rows[0]).toMatchObject({ date: "2026-11-07", prices: { "24K": 14357, "22K": 13160 } });
  });
  it("routes by content", () => {
    expect(parseImport(html, TODAY).rows).toHaveLength(10);
    expect(parseImport("date,24K\n2026-11-16,13680", TODAY).rows).toHaveLength(1);
    expect(parseImport("Nov 16, 2026 13680 12540", TODAY).rows).toHaveLength(1);
  });
  it("reports a saved page that is not the rates page", () => {
    expect(parseSavedHtml("<table><tr><td>x</td></tr></table>", TODAY).problems[0]).toMatch(/not found/);
  });
});

describe("checkRows", () => {
  const stored = [close("24K", "2026-11-15", 13762), close("22K", "2026-11-15", 12615), close("24K", "2026-11-16", 13680)];
  const row = (date: string, prices: Partial<Record<Karat, number>>) => ({ date, prices });

  it("accepts a normal day and reports what it would replace", () => {
    const [c] = checkRows([row("2026-11-16", { "24K": 13700, "22K": 12558 })], stored, TODAY).rows;
    expect(c.errors).toEqual([]);
    expect(c.confirm).toEqual([]);
    expect(c.replaces).toEqual({ "24K": 13680 });
  });
  it("marks rows that match what is already stored", () => {
    const same = checkRows([row("2026-11-16", { "24K": 13680 })], stored, TODAY).rows[0];
    expect(same.identical).toBe(true);
    expect(same.replaces).toEqual({});
    expect(checkRows([row("2026-11-16", { "24K": 13700 })], stored, TODAY).rows[0].identical).toBe(false);
    expect(checkRows([row("2026-11-12", { "24K": 13700 })], stored, TODAY).rows[0].identical).toBe(false);
  });
  it("blocks future dates, bad dates, zero, negative and implausible prices", () => {
    expect(checkRows([row("2026-11-17", { "24K": 13680 })], [], TODAY).rows[0].errors[0]).toMatch(/future/);
    expect(checkRows([row("2026-02-30", { "24K": 13680 })], [], TODAY).rows[0].errors[0]).toMatch(/not valid/);
    expect(checkRows([row(TODAY, { "24K": 0 })], [], TODAY).rows[0].errors[0]).toMatch(/above 0/);
    expect(checkRows([row(TODAY, { "24K": -5 })], [], TODAY).rows[0].errors[0]).toMatch(/above 0/);
    expect(checkRows([row(TODAY, { "24K": 12 })], [], TODAY).rows[0].errors[0]).toMatch(/plausible/);
    expect(checkRows([row(TODAY, {})], [], TODAY).rows[0].errors[0]).toMatch(/at least one/);
  });
  it("blocks karat prices that disagree with each other", () => {
    expect(checkRows([row(TODAY, { "24K": 13680, "22K": 6000 })], [], TODAY).rows[0].errors[0]).toMatch(/22K/);
  });
  it("asks for confirmation on a >15% jump (e.g. a per-10 g price typed by mistake)", () => {
    const [c] = checkRows([row(TODAY, { "24K": 136800 })], stored, TODAY).rows;
    expect(c.errors).toEqual([]);
    expect(c.confirm[0]).toMatch(/per gram, not per 10/);
  });
  it("refuses a store that holds another data series", () => {
    const spot = [close("24K", "2026-11-16", 11768, "spot-estimate")];
    expect(checkRows([row(TODAY, { "24K": 13680 })], spot, TODAY).storeError).toMatch(/different series/);
    expect(checkRows([row(TODAY, { "24K": 13680 })], stored, TODAY).storeError).toBeNull();
  });
  it("treats manual and imported rates as the retail series", () => {
    expect(seriesOf("manual")).toBe(seriesOf("saved-html"));
    expect(seriesOf("import")).toBe(seriesOf("goodreturns"));
  });
});

describe("saveRows / deleteDay / toCsv", () => {
  let dir: string;
  let repo: FileRateRepository;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "goldpulse-manual-"));
    repo = new FileRateRepository(path.join(dir, "db.json"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const r1 = { date: "2026-11-15", prices: { "24K": 13762, "22K": 12615, "18K": 10320 } as Partial<Record<Karat, number>> };
  const r2 = { date: "2026-11-16", prices: { "24K": 13680, "22K": 12540, "18K": 10260 } as Partial<Record<Karat, number>> };

  it("saves rows as daily closes with the given source, plus snapshots for the newest day", async () => {
    expect(await saveRows(repo, [r1, r2], { source: "manual", confirmed: false, now: NOW })).toEqual({ ok: true, saved: 2 });
    const closes = await repo.getDailyCloses();
    expect(closes).toHaveLength(6);
    expect(closes.every((c) => c.source === "manual")).toBe(true);
    const latest = await repo.getLatestSnapshots();
    expect(latest["24K"]?.pricePerGram).toBe(13680);
    expect(latest["24K"]?.date).toBe("2026-11-16");
  });
  it("overwrites a day instead of duplicating it (edit)", async () => {
    await saveRows(repo, [r2], { source: "manual", confirmed: false, now: NOW });
    await saveRows(repo, [{ date: r2.date, prices: { "24K": 13700, "22K": 12558, "18K": 10275 } }], { source: "manual", confirmed: false, now: NOW });
    const day = (await repo.getDailyCloses()).filter((c) => c.date === r2.date);
    expect(day).toHaveLength(3);
    expect(day.find((c) => c.karat === "24K")?.pricePerGram).toBe(13700);
  });
  it("is all-or-nothing: one bad row saves nothing", async () => {
    const out = await saveRows(repo, [r1, { date: "2027-01-01", prices: { "24K": 13000 } }], { source: "import", confirmed: false, now: NOW });
    expect(out).toMatchObject({ ok: false, reason: "invalid" });
    expect(await repo.getDailyCloses()).toEqual([]);
  });
  it("needs confirmation for unusual jumps and saves once confirmed", async () => {
    await saveRows(repo, [r1], { source: "manual", confirmed: false, now: NOW });
    const odd = { date: "2026-11-16", prices: { "24K": 136800, "22K": 125400, "18K": 102600 } as Partial<Record<Karat, number>> };
    expect(await saveRows(repo, [odd], { source: "manual", confirmed: false, now: NOW })).toMatchObject({ ok: false, reason: "needs-confirm" });
    expect((await repo.getDailyCloses()).some((c) => c.date === "2026-11-16")).toBe(false);
    expect(await saveRows(repo, [odd], { source: "manual", confirmed: true, now: NOW })).toMatchObject({ ok: true });
  });
  it("refuses to write into a store of another series", async () => {
    await repo.upsertDailyCloses([close("24K", "2026-11-14", 11700, "spot-estimate")]);
    expect(await saveRows(repo, [r2], { source: "manual", confirmed: false, now: NOW })).toMatchObject({ ok: false, reason: "store" });
  });
  it("deletes one day and leaves others", async () => {
    await saveRows(repo, [r1, r2], { source: "manual", confirmed: false, now: NOW });
    await deleteDay(repo, "2026-11-16");
    expect([...new Set((await repo.getDailyCloses()).map((c) => c.date))]).toEqual(["2026-11-15"]);
  });
  it("exports CSV that imports back unchanged (round trip)", async () => {
    await saveRows(repo, [r1, { date: "2026-11-16", prices: { "24K": 13680, "22K": 12540 } }], { source: "manual", confirmed: false, now: NOW });
    const csv = toCsv(await repo.getDailyCloses());
    expect(csv.split("\n")[0]).toBe("date,24K,22K,18K");
    expect(csv).toContain("2026-11-16,13680,12540,\n");
    expect(parseCsv(csv).rows).toEqual([
      { date: "2026-11-15", prices: r1.prices },
      { date: "2026-11-16", prices: { "24K": 13680, "22K": 12540 } },
    ]);
  });
});

describe("duplicates inside one import", () => {
  it("warns when a date appears twice in a CSV and uses the last row", () => {
    const r = parseCsv("date,24K\n2026-11-16,13680\n2026-11-16,13700");
    expect(r.rows).toEqual([{ date: "2026-11-16", prices: { "24K": 13700 } }]);
    expect(r.problems.join(" ")).toMatch(/2026-11-16 appears more than once/);
  });
  it("warns the same for pasted text", () => {
    const r = parsePastedText("Nov 16, 2026 13680 12540\nNov 16, 2026 13700 12558", TODAY);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].prices["24K"]).toBe(13700);
    expect(r.problems.join(" ")).toMatch(/appears more than once/);
  });
});

describe("JSON backup import", () => {
  const json = JSON.stringify([
    { karat: "24K", date: "2026-11-15", pricePerGram: 13762, source: "manual" },
    { karat: "22K", date: "2026-11-15", pricePerGram: 12615, source: "manual" },
    { karat: "24K", date: "2026-11-16", pricePerGram: 13680, source: "saved-html" },
  ]);
  it("restores an export, merging karats by date", () => {
    expect(parseImport(json, TODAY).rows).toEqual([
      { date: "2026-11-15", prices: { "24K": 13762, "22K": 12615 } },
      { date: "2026-11-16", prices: { "24K": 13680 } },
    ]);
  });
  it("reports bad items and non-lists without throwing", () => {
    const r = parseImport(JSON.stringify([{ karat: "20K", date: "2026-11-16", pricePerGram: 1 }, { karat: "24K", date: "nope", pricePerGram: 13680 }]), TODAY);
    expect(r.rows).toEqual([]);
    expect(r.problems).toHaveLength(2);
    expect(parseImport('{"a":1}', TODAY).problems[0]).toMatch(/list of daily rates/);
    expect(parseImport("[not json", TODAY).problems[0]).toMatch(/not valid JSON/);
  });
});

describe("file store safety", () => {
  it("leaves no temp files behind and writes valid JSON", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = mkdtempSync(path.join(tmpdir(), "goldpulse-atomic-"));
    try {
      const repo = new FileRateRepository(path.join(dir, "db.json"));
      await repo.upsertDailyCloses([close("24K", "2026-11-16", 13680)]);
      await repo.upsertDailyCloses([close("24K", "2026-11-15", 13762)]);
      expect(readdirSync(dir)).toEqual(["db.json"]);
      expect(JSON.parse(readFileSync(path.join(dir, "db.json"), "utf8")).dailyCloses).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("refuses to overwrite a corrupt store", async () => {
    const { writeFileSync, readFileSync } = await import("node:fs");
    const dir = mkdtempSync(path.join(tmpdir(), "goldpulse-corrupt-"));
    try {
      const file = path.join(dir, "db.json");
      writeFileSync(file, "{ not json");
      const repo = new FileRateRepository(file);
      await expect(repo.upsertDailyCloses([close("24K", "2026-11-16", 13680)])).rejects.toThrow();
      expect(readFileSync(file, "utf8")).toBe("{ not json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
