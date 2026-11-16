import { KARATS, type Karat, type Rate } from "@/lib/types";

/** Reject a new price that moves more than this fraction vs the last good one. */
export const MAX_JUMP_FRACTION = 0.15;
/** Expected purity ratio vs 24K, with tolerance, as a cross-check on parsed data. */
const PURITY: Record<Karat, number> = { "24K": 1, "22K": 22 / 24, "18K": 18 / 24 };
const PURITY_TOLERANCE = 0.05;

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validateRate(rate: Rate, lastGood?: number | null): ValidationResult {
  const reasons: string[] = [];
  const p = rate.pricePerGram;
  if (!Number.isFinite(p)) reasons.push(`${rate.karat}: price is not a number`);
  else if (p <= 0) reasons.push(`${rate.karat}: price is zero or negative`);
  else if (lastGood && lastGood > 0) {
    const jump = Math.abs(p - lastGood) / lastGood;
    if (jump > MAX_JUMP_FRACTION) {
      reasons.push(
        `${rate.karat}: ${(jump * 100).toFixed(1)}% jump vs last good value exceeds ${MAX_JUMP_FRACTION * 100}%`,
      );
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Validate a full set of today's rates. All-or-nothing: one bad karat rejects the
 * batch so we never mix a fresh value with a stale one on the same date.
 */
export function validateBatch(
  rates: Rate[],
  lastGood: Partial<Record<Karat, number>>,
): ValidationResult {
  if (rates.length === 0) return { ok: false, reasons: ["empty result"] };

  const reasons: string[] = [];
  for (const karat of KARATS) {
    const rate = rates.find((r) => r.karat === karat);
    if (!rate) {
      reasons.push(`${karat}: missing`);
      continue;
    }
    reasons.push(...validateRate(rate, lastGood[karat]).reasons);
  }

  reasons.push(...checkPurityRatios(Object.fromEntries(rates.map((r) => [r.karat, r.pricePerGram]))));
  return { ok: reasons.length === 0, reasons };
}

/** Each karat's price should sit near its purity share of the 24K price. Skips missing karats. */
export function checkPurityRatios(prices: Partial<Record<Karat, number>>): string[] {
  const base = prices["24K"];
  if (!base || !(base > 0)) return [];
  const reasons: string[] = [];
  for (const karat of KARATS) {
    const p = prices[karat];
    if (karat === "24K" || p === undefined || !(p > 0)) continue;
    const ratio = p / base;
    if (Math.abs(ratio - PURITY[karat]) > PURITY_TOLERANCE) {
      reasons.push(`${karat}: ratio to 24K (${ratio.toFixed(3)}) is implausible`);
    }
  }
  return reasons;
}
