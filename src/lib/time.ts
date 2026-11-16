const IST_TZ = "Asia/Kolkata";

/** IST calendar date (YYYY-MM-DD) for an instant. */
export function istDate(instant: Date | string = new Date()): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** e.g. "16 Nov 2026, 3:42 pm IST" */
export function formatIst(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const text = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${text} IST`;
}

/** e.g. "16 Nov" from a YYYY-MM-DD string (no timezone shift). */
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
