import { getSite } from "@/lib/site";

export function SiteFooter() {
  const { location, sourceName, estimate } = getSite();
  return (
    <footer className="band border-t border-white/15">
      <div className="mx-auto w-full max-w-6xl space-y-2 px-4 py-10 text-sm text-on-band-muted sm:px-6">
        <p className="font-semibold text-on-band">Disclaimer</p>
        <p className="max-w-3xl text-pretty">
          Rates shown are indicative per-gram {estimate ? "estimates" : "rates"} for {location} and may differ from what a jeweller
          charges. They exclude import duty, GST, TCS and other levies. GoldPulse is not investment advice and does not
          recommend buying or selling gold. Market factors are shown as correlates, not proven causes.
        </p>
        <p>
          All times are in Indian Standard Time (IST).
          {sourceName ? ` Rate data: ${sourceName}.` : " Personal, non-commercial project."}
        </p>
      </div>
    </footer>
  );
}
