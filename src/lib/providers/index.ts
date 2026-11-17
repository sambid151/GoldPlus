import type { RateProvider } from "@/lib/types";
import { isHosted } from "@/lib/runtime";
import { GoodreturnsProvider } from "./goodreturns";
import { LicensedApiProvider } from "./licensed";
import { resolveProviderName } from "./name";
import { SavedHtmlProvider } from "./saved-html";
import { SpotEstimateProvider } from "./spot-estimate";

/** Sources whose terms or storage model rule out a public/hosted deployment. */
const LOCAL_ONLY = new Set(["saved-html", "goodreturns"]);

export function getRateProvider(): RateProvider {
  const name = resolveProviderName();
  if (isHosted() && LOCAL_ONLY.has(name)) {
    throw new Error(`RATE_PROVIDER="${name}" is for personal local use only and is blocked on hosted deployments. Use "spot-estimate" or "licensed".`);
  }
  switch (name) {
    case "published":
      throw new Error("Published mode is read-only: there is no live rate source to ingest from.");
    case "spot-estimate":
      return new SpotEstimateProvider();
    case "licensed":
      return new LicensedApiProvider();
    case "saved-html":
      return new SavedHtmlProvider();
    case "goodreturns":
      return new GoodreturnsProvider();
    default:
      throw new Error(`Unknown RATE_PROVIDER "${name}"`);
  }
}
