export const GST_RATE = 0.03;

export interface CalcInput {
  weightGrams: number;
  ratePerGram: number;
  makingChargePct: number;
}

export interface CalcResult {
  goldValue: number;
  makingCharge: number;
  gst: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Jewellery estimate: gold value + making %, then GST 3% on the sum. Excludes TCS/levies. */
export function calculate({ weightGrams, ratePerGram, makingChargePct }: CalcInput): CalcResult {
  const w = Math.max(0, weightGrams || 0);
  const pct = Math.max(0, makingChargePct || 0);
  const goldValue = w * ratePerGram;
  const makingCharge = goldValue * (pct / 100);
  const gst = (goldValue + makingCharge) * GST_RATE;
  return {
    goldValue: round2(goldValue),
    makingCharge: round2(makingCharge),
    gst: round2(gst),
    total: round2(goldValue + makingCharge + gst),
  };
}
