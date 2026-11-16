import { Suspense } from "react";
import { Hero, HeroFallback } from "@/components/hero/hero";
import { HashScroller } from "@/components/layout/hash-scroller";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CalculatorFallback, CalculatorSection } from "@/components/calculator/calculator-section";
import { HistoryFallback, HistorySection } from "@/components/history/history-section";
import { NewsFallback, NewsSection } from "@/components/news/news-section";
import { RatesFallback, RatesSection } from "@/components/rates/rates-section";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <HashScroller />
      <main id="main">
        <Suspense fallback={<HeroFallback />}>
          <Hero />
        </Suspense>

        <Suspense fallback={<RatesFallback />}>
          <RatesSection />
        </Suspense>

        <Suspense fallback={<HistoryFallback />}>
          <HistorySection />
        </Suspense>

        <Suspense fallback={<NewsFallback />}>
          <NewsSection />
        </Suspense>

        <Suspense fallback={<CalculatorFallback />}>
          <CalculatorSection />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
