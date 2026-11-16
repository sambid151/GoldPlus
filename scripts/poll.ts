/**
 * Local poller: `npm run poll` (loop) or `npm run ingest` (single pass).
 * Interval defaults to 20 minutes (spec: 15-30). Backoff after failures is
 * enforced inside runIngest via ingest_state.next_retry_at.
 */
import { runIngest } from "@/lib/ingest/ingest";
import { getRateProvider } from "@/lib/providers";
import { getRepository } from "@/lib/repo";
import { formatIst } from "@/lib/time";

const once = process.argv.includes("--once");
const minutes = Math.min(30, Math.max(15, Number(process.env.POLL_MINUTES ?? 20)));

async function tick() {
  const outcome = await runIngest({ provider: getRateProvider(), repo: getRepository() });
  console.log(`[${formatIst(new Date())}]`, JSON.stringify(outcome));
  return outcome;
}

async function main() {
  const first = await tick();
  if (once) process.exit(first.status === "failed" ? 1 : 0);
  console.log(`polling every ${minutes} min (ctrl+c to stop)`);
  setInterval(() => void tick().catch((e) => console.error(e)), minutes * 60_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
