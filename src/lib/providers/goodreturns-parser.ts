import * as cheerio from "cheerio";
import { KARATS, type Karat, type ProviderResult, type Rate } from "@/lib/types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "₹1,09,440 (-656)" -> 109440. Returns NaN when no price is present. */
export function parseRupees(text: string): number {
  const match = text.replace(/₹/g, "").match(/\d[\d,]*(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) : NaN;
}

/** "Nov 16, 2026" -> "2026-11-16". Returns null when unparseable. */
export function parseSourceDate(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const mm = String(month).padStart(2, "0");
  return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
}

function karatOf(header: string): Karat | null {
  const k = header.trim().toUpperCase();
  return (KARATS as readonly string[]).includes(k) ? (k as Karat) : null;
}

interface Table {
  headers: string[];
  rows: string[][];
}

function readTables($: cheerio.CheerioAPI): Table[] {
  return $("table")
    .toArray()
    .map((el) => {
      const headers = $(el)
        .find("thead th")
        .toArray()
        .map((th) => $(th).text().trim());
      const rows = $(el)
        .find("tbody tr")
        .toArray()
        .map((tr) =>
          $(tr)
            .find("td")
            .toArray()
            // Read only the leading text node so the "(+27)" delta span is ignored.
            .map((td) => $(td).clone().children().remove().end().text().trim()),
        );
      return { headers, rows };
    });
}

/**
 * Parse the public Bhubaneswar rates page.
 * Throws when neither expected table is found so the caller treats it as a failure.
 */
export function parseGoodreturns(
  html: string,
  opts: { fetchedAt: string; todayIst: string; source: string },
): ProviderResult {
  const $ = cheerio.load(html);
  const tables = readTables($);

  const perGram = tables.find((t) => t.headers[0]?.toLowerCase() === "gram");
  const history = tables.find((t) => t.headers[0]?.toLowerCase() === "date");
  if (!perGram) throw new Error("Per-gram table not found (page layout changed?)");

  const oneGram = perGram.rows.find((r) => r[0] === "1");
  if (!oneGram) throw new Error("1-gram row not found in per-gram table");

  const historyRates: Rate[] = [];
  if (history) {
    for (const row of history.rows) {
      const date = parseSourceDate(row[0] ?? "");
      if (!date) continue;
      history.headers.forEach((h, i) => {
        const karat = karatOf(h);
        if (!karat) return;
        historyRates.push({
          karat, pricePerGram: parseRupees(row[i] ?? ""), date,
          fetchedAt: opts.fetchedAt, source: opts.source,
        });
      });
    }
  }

  // The per-gram table carries no date; use the newest history date when its
  // 24K price agrees with today's, otherwise fall back to today's IST date.
  const current: Rate[] = [];
  const price24 = parseRupees(oneGram[perGram.headers.indexOf("24K")] ?? "");
  const newest = historyRates.find((r) => r.karat === "24K");
  const date = newest && newest.pricePerGram === price24 ? newest.date : opts.todayIst;

  perGram.headers.forEach((h, i) => {
    const karat = karatOf(h);
    if (!karat) return;
    current.push({
      karat, pricePerGram: parseRupees(oneGram[i] ?? ""), date,
      fetchedAt: opts.fetchedAt, source: opts.source,
    });
  });

  return { current, history: historyRates };
}
