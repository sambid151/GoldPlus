import { isHosted } from "@/lib/runtime";

/** Text safe to show visitors: full detail locally, generic (and logged) when hosted. */
export function publicErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (!isHosted()) return message;
  console.error("section failed:", message);
  return "Data is temporarily unavailable. Please try again shortly.";
}
