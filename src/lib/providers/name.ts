import { isHosted } from "@/lib/runtime";

export type ProviderName = "spot-estimate" | "licensed" | "saved-html" | "goodreturns";

/** Which provider is active. Hosted default is the keyless spot estimate; local default is saved-html. */
export function resolveProviderName(env: NodeJS.ProcessEnv = process.env): string {
  return env.RATE_PROVIDER || (isHosted(env) ? "spot-estimate" : "saved-html");
}

export const isSpotEstimate = (env: NodeJS.ProcessEnv = process.env) => resolveProviderName(env) === "spot-estimate";
