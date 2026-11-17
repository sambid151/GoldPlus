import { isSpotEstimate } from "@/lib/providers/name";
import { isPublishedMode } from "@/lib/runtime";

/** Deployment-level copy that depends on the configured data source. Server-side only. */
export function getSite() {
  const estimate = isSpotEstimate();
  const published = isPublishedMode();
  const location = process.env.RATE_LOCATION?.trim() || (estimate ? "India" : "Bhubaneswar");
  const sourceName =
    process.env.RATE_SOURCE_NAME?.trim() ||
    (published ? "published snapshot of rates saved by the site owner" : estimate ? "xaus.com (international gold price × USD/INR)" : null);
  return {
    estimate,
    published,
    location,
    sourceName,
    // A published snapshot may be days old, so it never claims to be "today".
    ratesTitle: published ? "Latest rates" : "Today’s rates",
  };
}
