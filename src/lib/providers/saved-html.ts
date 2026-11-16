import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProviderResult, RateProvider } from "@/lib/types";
import { istDate } from "@/lib/time";
import { parseGoodreturns } from "./goodreturns-parser";

export const DEFAULT_SAVED_HTML_PATH = path.join(process.cwd(), ".data", "goodreturns-bhubaneswar.html");

/**
 * Reads a rates page you saved yourself from your browser (Ctrl+S, "Webpage, HTML only").
 * No network access. Freshness follows the file's modified time, so an old save
 * is reported as stale rather than passed off as current.
 */
export class SavedHtmlProvider implements RateProvider {
  readonly id = "saved-html";

  constructor(private readonly file = process.env.SAVED_HTML_PATH ?? DEFAULT_SAVED_HTML_PATH) {}

  async fetchRates(): Promise<ProviderResult> {
    let stat, html: string;
    try {
      [stat, html] = await Promise.all([fs.stat(this.file), fs.readFile(this.file, "utf8")]);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`No saved page at ${this.file}. Save the Bhubaneswar rates page there from your browser.`);
      }
      throw e;
    }
    return parseGoodreturns(html, {
      fetchedAt: stat.mtime.toISOString(),
      todayIst: istDate(stat.mtime),
      source: this.id,
    });
  }
}
