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

/** e.g. "3:42 pm" in IST. */
export function formatTimeIst(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** Hour of day (0-23) in IST. */
export function istHour(instant: Date | string): number {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: IST_TZ, hour: "2-digit", hour12: false }).format(d);
  return Number(h) % 24;
}

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function formatAgo(from: Date | string, now: Date | string = new Date()): string {
  const ms = new Date(now).getTime() - new Date(from).getTime();
  if (!(ms >= 0)) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
