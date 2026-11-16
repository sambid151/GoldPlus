import { getDashboardData } from "@/lib/dashboard";
import { publicErrorMessage } from "@/lib/errors";
import { getSite } from "@/lib/site";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Section } from "@/components/ui/section";
import { EstimateNotice } from "./estimate-notice";
import { RateCards } from "./rate-cards";
import { RateTable } from "./rate-table";

export function RatesFallback() {
  return (
    <Section id="rates" title={getSite().ratesTitle}>
      <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading rates…">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line p-5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="mt-5 h-10 w-40" />
            <Skeleton className="mt-4 h-6 w-48" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-56 w-full" />
    </Section>
  );
}

export async function RatesSection() {
  let data;
  try {
    data = await getDashboardData();
  } catch (e) {
    return (
      <Section id="rates" title={getSite().ratesTitle}>
        <ErrorState title="Couldn’t load stored rates">
          {publicErrorMessage(e)} Reload to try again.
        </ErrorState>
      </Section>
    );
  }

  const { cards, closes } = data;
  return (
    <Section
      id="rates"
      title={getSite().ratesTitle}
      description={
        getSite().estimate
          ? "Price per gram, updated about every 15 minutes while the page is in use."
          : "Price per gram. The source publishes once a day."
      }
    >
      {cards.length === 0 ? (
        <EmptyState title="No rates stored yet">
          Rates appear after the first successful ingest. GoldPulse never shows a placeholder price.
        </EmptyState>
      ) : (
        <>
          {getSite().estimate ? <EstimateNotice /> : null}
          <RateCards cards={cards} closes={closes} />
          <RateTable cards={cards} />
        </>
      )}
    </Section>
  );
}
