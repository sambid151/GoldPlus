import { isSpotEstimate } from "@/lib/providers/name";

/** Deployment-level copy that depends on the configured data source. Server-side only. */
export function getSite() {
  const estimate = isSpotEstimate();
  const location = process.env.RATE_LOCATION?.trim() || (estimate ? "India" : "Bhubaneswar");
  const sourceName =
    process.env.RATE_SOURCE_NAME?.trim() || (estimate ? "xaus.com (international gold price × USD/INR)" : null);
  return {
    estimate,
    location,
    sourceName,
    ratesTitle: "Today’s rates",
  };
}
