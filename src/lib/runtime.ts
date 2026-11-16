/** True on Vercel (or when forced), where the filesystem is ephemeral and the app is public. */
export function isHosted(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL) || env.GOLDPULSE_HOSTED === "true";
}

/**
 * True when a Host header names this machine (localhost, 127.0.0.1 or ::1, any port).
 * Defence in depth on top of binding to 127.0.0.1: it also stops DNS-rebinding pages
 * from reaching the data screens under another hostname.
 */
export function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}
