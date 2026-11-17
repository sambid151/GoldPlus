/**
 * Builds published/snapshot.json from your local rate store, for read-only hosting.
 *   npm run publish:snapshot            reads .data/goldpulse.json (or GOLDPULSE_DATA_FILE)
 *   npm run publish:snapshot -- <file>  reads another file
 * Read-only on the source. Only whitelisted retail-rate fields are copied; nothing is derived or invented.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSnapshot } from "@/lib/published/schema";

const src = path.resolve(process.argv[2] ?? process.env.GOLDPULSE_DATA_FILE ?? ".data/goldpulse.json");
const out = path.resolve("published/snapshot.json");

if (!existsSync(src)) {
  console.error(`No data file at ${src}`);
  process.exit(1);
}

const { snapshot, report } = buildSnapshot(JSON.parse(readFileSync(src, "utf8")), new Date());
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");

const days = [...new Set(snapshot.dailyCloses.map((c) => c.date))];
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
console.log(`  daily prices: ${report.closesOut}/${report.closesIn}, snapshots: ${report.snapshotsOut}/${report.snapshotsIn}`);
console.log(`  days: ${days.length} (${days[0]} to ${days.at(-1)}), generatedAt ${snapshot.generatedAt}`);
if (report.dropped.length > 0) console.log(`  dropped: ${report.dropped.join("; ")}`);
console.log("Review the file, then commit it to publish.");
