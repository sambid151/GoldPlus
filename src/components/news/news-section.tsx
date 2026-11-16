import { getNews } from "@/lib/news/get-news";
import type { NewsItem } from "@/lib/news/rss";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Section } from "@/components/ui/section";
import { MarketPanel } from "./market-panel";
import { NewsList } from "./news-list";

const COPY = {
  id: "news",
  title: "News and market",
  description:
    "Gold headlines from the past 7 days. Tags show what each story mentions, not what moved the price.",
} as const;

export function NewsFallback() {
  return (
    <Section {...COPY}>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Loading news…">
        <div className="space-y-3">
          <Skeleton className="h-9 w-3/4" />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </Section>
  );
}

export async function NewsSection() {
  let items: NewsItem[] | null = null;
  let error: string | null = null;
  try {
    items = await getNews();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <Section {...COPY}>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          {error ? (
            <ErrorState title="Couldn’t load headlines">{error}. Reload to try again.</ErrorState>
          ) : items && items.length === 0 ? (
            <EmptyState title="No headlines found for the past 7 days" />
          ) : (
            <NewsList items={items!} />
          )}
        </div>
        <MarketPanel />
      </div>
    </Section>
  );
}
