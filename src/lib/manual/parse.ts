import { parseGoodreturns, parseRupees, parseSourceDate } from "@/lib/providers/goodreturns-parser";
import { KARATS, type Karat } from "@/lib/types";

/** One day's per-gram prices as typed, pasted or imported. Karats may be missing. */
export interface ParsedRow {
  date: string;
  prices: Partial<Record<Karat, number>>;
  /** Set when the row carried no date and today's date was assumed. */
  dateAssumed?: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Problems with individual lines; the rest of the input is still usable. */
  problems: string[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function validIso(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Accepts 2026-11-16, 16/11/2026, 16-11-2026, "Nov 16, 2026" and "16 Nov 2026". */
export function parseDateFlexible(text: string): string | null {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validIso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // day first (India)
  if (m) return validIso(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    return mi >= 0 ? validIso(+m[3], mi + 1, +m[1]) : null;
  }
  return parseSourceDate(t);
}

/** Find a date anywhere inside a line; returns the ISO date and the line with it removed. */
function extractDate(line: string): { date: string; rest: string } | null {
  const patterns = [
    /\b\d{4}-\d{1,2}-\d{1,2}\b/,
    /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b/,
    /\b\d{1,2}\s+[A-Za-z]{3}[a-z]*,?\s+\d{4}\b/,
    /\b[A-Za-z]{3}[a-z]*\s+\d{1,2},?\s+\d{4}\b/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (!m) continue;
    const date = parseDateFlexible(m[0]);
    if (date) return { date, rest: line.replace(m[0], " ") };
  }
  return null;
}

/** "₹13,680 (-82)" style cells -> price numbers only (deltas in brackets are dropped). */
function priceNumbers(text: string): number[] {
  const cleaned = text.replace(/\([^)]*\)/g, " ").replace(/₹|Rs\.?|INR/gi, " ");
  return (cleaned.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, ""))).filter((n) => n >= 100);
}

function karatOrder(header: string): Karat[] {
  const found = [...header.matchAll(/\b(24|22|18)\s*k(?:t|arat)?\b/gi)].map((m) => `${m[1]}K` as Karat);
  return found.length > 0 ? found : [...KARATS];
}

function toRow(date: string, nums: number[], order: Karat[], dateAssumed?: boolean): ParsedRow | null {
  const prices: Partial<Record<Karat, number>> = {};
  order.forEach((k, i) => {
    if (nums[i] !== undefined) prices[k] = nums[i];
  });
  return Object.keys(prices).length > 0 ? { date, prices, dateAssumed } : null;
}

/** Plain text pasted from a rates table (tab, comma or space separated). */
export function parsePastedText(text: string, todayIst: string): ParseResult {
  const rows = new Map<string, ParsedRow>();
  const problems: string[] = [];
  let order: Karat[] = [...KARATS];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/\b(24|22|18)\s*k/i.test(line) && !/\d{3,}/.test(line.replace(/\b(24|22|18)\s*k\w*/gi, ""))) {
      order = karatOrder(line); // header line such as "Date  24K  22K  18K"
      continue;
    }
    const withDate = extractDate(line);
    if (withDate) {
      const row = toRow(withDate.date, priceNumbers(withDate.rest), order);
      if (row) {
        if (rows.has(row.date)) problems.push(`${row.date} appears more than once; the last row is used.`);
        rows.set(row.date, row);
      }
      else problems.push(`No prices found on: "${line.slice(0, 60)}"`);
      continue;
    }
    // Goodreturns "per gram" table: first cell is the weight, "1" is today's per-gram row.
    const gram = line.match(/^1(?:\s*g(?:ram)?s?)?(?=[\s,;\t|])(.*)$/i);
    if (gram) {
      const row = toRow(todayIst, priceNumbers(gram[1]), order, true);
      if (row && !rows.has(row.date)) rows.set(row.date, row);
    }
  }
  if (rows.size === 0) problems.push("No dated price rows were found in the pasted text.");
  return { rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), problems };
}

function splitCsvLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/** CSV with a header such as `date,24K,22K,18K` (any order; quotes and Indian digit grouping OK). */
export function parseCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const problems: string[] = [];
  if (lines.length === 0) return { rows: [], problems: ["The file is empty."] };

  const delim = [",", "\t", ";"].map((d) => [d, lines[0].split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const head = splitCsvLine(lines[0], delim);
  const hasHeader = head.some((h) => /date/i.test(h) || /\b(24|22|18)\s*k/i.test(h));
  const cols: { date: number; karats: Partial<Record<Karat, number>> } = { date: 0, karats: {} };

  if (hasHeader) {
    head.forEach((h, i) => {
      if (/date/i.test(h)) cols.date = i;
      const m = h.match(/\b(24|22|18)\s*k/i);
      if (m) cols.karats[`${m[1]}K` as Karat] = i;
    });
  } else {
    KARATS.forEach((k, i) => (cols.karats[k] = i + 1));
  }
  if (Object.keys(cols.karats).length === 0) return { rows: [], problems: ["No 24K, 22K or 18K columns found in the header."] };

  const rows = new Map<string, ParsedRow>();
  lines.slice(hasHeader ? 1 : 0).forEach((line, idx) => {
    const cells = splitCsvLine(line, delim);
    const lineNo = idx + (hasHeader ? 2 : 1);
    const date = parseDateFlexible(cells[cols.date] ?? "");
    if (!date) return void problems.push(`Line ${lineNo}: unreadable date "${(cells[cols.date] ?? "").slice(0, 20)}"`);
    const prices: Partial<Record<Karat, number>> = {};
    for (const [k, col] of Object.entries(cols.karats) as [Karat, number][]) {
      const raw = (cells[col] ?? "").trim();
      if (raw === "") continue;
      const n = parseRupees(raw);
      if (Number.isFinite(n)) prices[k] = n;
      else problems.push(`Line ${lineNo}: ${k} "${raw.slice(0, 20)}" is not a number`);
    }
    if (Object.keys(prices).length > 0) {
      if (rows.has(date)) problems.push(`Line ${lineNo}: ${date} appears more than once; the last row is used.`);
      rows.set(date, { date, prices });
    }
  });
  return { rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), problems };
}

/** The JSON backup written by /data/export: [{ karat, date, pricePerGram, source }]. */
export function parseJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { rows: [], problems: ["The file is not valid JSON."] };
  }
  if (!Array.isArray(data)) return { rows: [], problems: ["Expected a JSON list of daily rates (a GoldPulse export)."] };
  const rows = new Map<string, ParsedRow>();
  const problems: string[] = [];
  data.forEach((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const date = typeof o.date === "string" ? parseDateFlexible(o.date) : null;
    const karat = KARATS.find((k) => k === o.karat);
    const price = typeof o.pricePerGram === "number" ? o.pricePerGram : NaN;
    if (!date || !karat || !(price > 0)) return void problems.push(`Item ${i + 1}: needs a valid date, karat (24K, 22K or 18K) and pricePerGram.`);
    const row = rows.get(date) ?? { date, prices: {} };
    if (row.prices[karat] !== undefined) problems.push(`Item ${i + 1}: ${karat} on ${date} appears more than once; the last value is used.`);
    row.prices[karat] = price;
    rows.set(date, row);
  });
  return { rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), problems };
}

/** Saved Goodreturns-style HTML page (per-gram and 10-day tables). */
export function parseSavedHtml(html: string, todayIst: string): ParseResult {
  try {
    const { current, history } = parseGoodreturns(html, { fetchedAt: new Date().toISOString(), todayIst, source: "import" });
    const rows = new Map<string, ParsedRow>();
    for (const r of [...history, ...current]) {
      if (!(r.pricePerGram > 0)) continue;
      const row = rows.get(r.date) ?? { date: r.date, prices: {} };
      row.prices[r.karat] = r.pricePerGram;
      rows.set(r.date, row);
    }
    return { rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), problems: [] };
  } catch (e) {
    return { rows: [], problems: [e instanceof Error ? e.message : "Could not read the saved page."] };
  }
}

/** Detects HTML, CSV or pasted text and parses accordingly. */
export function parseImport(text: string, todayIst: string): ParseResult {
  const t = text.trim();
  if (/<table[\s>]/i.test(t)) return parseSavedHtml(t, todayIst);
  if (t.startsWith("[") || t.startsWith("{")) return parseJson(t);
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  const looksCsv = /,|;/.test(firstLine) && /date/i.test(firstLine);
  return looksCsv ? parseCsv(t) : parsePastedText(t, todayIst);
}
