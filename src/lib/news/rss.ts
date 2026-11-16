import { XMLParser } from "fast-xml-parser";
import { tagHeadline, type FactorKey } from "./factors";

/** Title, source, date and link only. Article text is never fetched or stored. */
export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  factors: FactorKey[];
}

const WINDOW_MS = 7 * 24 * 60 * 60_000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (typeof v === "string" ? v : ((v as { "#text"?: string })?.["#text"] ?? "")).trim();

export function parseNewsRss(xml: string, now: Date = new Date(), limit = 20): NewsItem[] {
  const doc = parser.parse(xml);
  const raw = asArray(doc?.rss?.channel?.item as unknown[] | undefined);
  const seen = new Set<string>();
  const items: NewsItem[] = [];

  for (const r of raw as Record<string, unknown>[]) {
    const source = text(r.source) || "Unknown source";
    let title = text(r.title);
    const link = text(r.link);
    const when = new Date(text(r.pubDate));
    if (!title || !link || Number.isNaN(when.getTime())) continue;
    if (now.getTime() - when.getTime() > WINDOW_MS || when.getTime() > now.getTime() + 60 * 60_000) continue;
    // Google News appends " - Source" to titles.
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, source, publishedAt: when.toISOString(), link, factors: tagHeadline(title) });
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
}
