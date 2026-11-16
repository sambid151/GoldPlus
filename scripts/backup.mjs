// Copies the rate store to .data/backups/ with a timestamp and keeps the newest 30 copies.
// Never modifies the original file. Usage: npm run backup
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const KEEP = 30;
const src = path.resolve(process.env.GOLDPULSE_DATA_FILE || ".data/goldpulse.json");

if (!existsSync(src)) {
  console.error(`No data file at ${src}. Nothing to back up.`);
  process.exit(1);
}

const base = path.basename(src, ".json");
const dir = path.join(path.dirname(src), "backups");
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(dir, `${base}-${stamp}.json`);
copyFileSync(src, dest);

// Prune only old copies made by this script (same prefix, inside the backups folder).
const copies = readdirSync(dir).filter((f) => f.startsWith(`${base}-`) && f.endsWith(".json")).sort();
for (const old of copies.slice(0, -KEEP)) rmSync(path.join(dir, old));

console.log(`Backed up to ${dest} (${Math.min(copies.length, KEEP)} kept)`);
