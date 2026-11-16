import { getDashboardData } from "@/lib/dashboard";
import { publicErrorMessage } from "@/lib/errors";
import type { Karat } from "@/lib/types";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Section } from "@/components/ui/section";
import { getSite } from "@/lib/site";
import { Calculator } from "./calculator";

const COPY = {
  id: "calculator",
  title: "Price calculator",
  tone: "green",
  description: "Work out a rough jewellery price: gold value, making charge and 3% GST.",
} as const;

export function CalculatorFallback() {
  return (
    <Section {...COPY}>
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading calculator…">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </Section>
  );
}

export async function CalculatorSection() {
  const estimate = getSite().estimate;
  let cards: Awaited<ReturnType<typeof getDashboardData>>["cards"] = [];
  let error: string | null = null;
  try {
    cards = (await getDashboardData()).cards;
  } catch (e) {
    error = publicErrorMessage(e);
  }
  const rates: Partial<Record<Karat, number>> = Object.fromEntries(cards.map((c) => [c.karat, c.pricePerGram]));

  return (
    <Section
      {...COPY}
      description={
        estimate
          ? "Uses the latest international spot estimate per gram. Shop prices run higher (import duty, GST, local premium), so treat the total as a floor, not a quote."
          : COPY.description
      }
    >
      {error ? (
        <ErrorState title="Couldn’t load rates for the calculator">{error}</ErrorState>
      ) : cards.length === 0 ? (
        <EmptyState title="Calculator needs a stored rate">It will be available after the first successful ingest.</EmptyState>
      ) : (
        <Calculator rates={rates} />
      )}
    </Section>
  );
}
