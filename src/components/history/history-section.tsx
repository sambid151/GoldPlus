import { getDashboardData } from "@/lib/dashboard";
import { publicErrorMessage } from "@/lib/errors";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Section } from "@/components/ui/section";
import { HistoryChartLazy, HistoryFallbackBody } from "./history-chart-lazy";
import { HistoryTable } from "./history-table";
import { MonthlySummary } from "./monthly-summary";

const COPY = {
  id: "history",
  title: "Price history",
  tone: "soft",
  description: "Daily closing price per gram. It fills in as each new day is saved.",
} as const;

export function HistoryFallback() {
  return (
    <Section {...COPY}>
      <HistoryFallbackBody />
    </Section>
  );
}

export async function HistorySection() {
  let closes;
  try {
    closes = (await getDashboardData()).closes;
  } catch (e) {
    return (
      <Section {...COPY}>
        <ErrorState title="Couldn’t load price history">{publicErrorMessage(e)}</ErrorState>
      </Section>
    );
  }
  return (
    <Section {...COPY}>
      {closes.length === 0 ? (
        <EmptyState title="No history yet">Daily closes appear here after the first successful ingest.</EmptyState>
      ) : (
        <div className="space-y-6">
          <HistoryChartLazy closes={closes} />
          <HistoryTable closes={closes} />
          <MonthlySummary closes={closes} />
        </div>
      )}
    </Section>
  );
}
