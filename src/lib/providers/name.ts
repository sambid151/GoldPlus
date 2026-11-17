import { isHosted } from "@/lib/runtime";

export type ProviderName = "published" | "spot-estimate" | "licensed" | "saved-html" | "goodreturns";

/**
 * Which provider is active. Hosted default is "published" (read-only snapshot, no live source);
 * local default is saved-html. The spot estimate only runs when RATE_PROVIDER=spot-estimate is set explicitly.
 */
export function resolveProviderName(env: NodeJS.ProcessEnv = process.env): string {
  return env.RATE_PROVIDER || (isHosted(env) ? "published" : "saved-html");
}

export const isSpotEstimate = (env: NodeJS.ProcessEnv = process.env) => resolveProviderName(env) === "spot-estimate";
