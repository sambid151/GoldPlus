import { cacheLife } from "next/cache";
import { parseNewsRss, type NewsItem } from "./rss";

const FEED = "https://news.google.com/rss/search?q=gold+price+India+when:7d&hl=en-IN&gl=IN&ceid=IN:en";

/** Headlines from the last 7 days via public RSS, cached for 15 minutes. */
export async function getNews(): Promise<NewsItem[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  const res = await fetch(FEED, {
    headers: { "User-Agent": "GoldPulse/0.1 (personal rate tracker)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`News feed responded ${res.status}`);
  return parseNewsRss(await res.text());
}
