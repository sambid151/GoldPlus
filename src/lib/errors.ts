import { isHosted } from "@/lib/runtime";

/** Text safe to show visitors: full detail locally, generic (and logged) when hosted. */
export function publicErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (!isHosted()) return message;
  // Not a failure: Next rejects connection() once a prerender finishes, so request-time sections skip it.
  if (!message.startsWith("During prerendering")) console.error("section failed:", message);
  return "Data is temporarily unavailable. Please try again shortly.";
}
