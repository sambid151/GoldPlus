export const FACTORS = [
  { key: "usdinr", label: "USD/INR", hint: "Rupee vs dollar. A weaker rupee tends to lift rupee gold prices." },
  { key: "xau", label: "Global gold (XAU/USD)", hint: "International gold price in dollars, the base for Indian rates." },
  { key: "rates", label: "Interest rates", hint: "Higher yields can weigh on gold, which pays no interest." },
  { key: "geo", label: "Geopolitics", hint: "Conflict and tariffs often coincide with safe-haven buying." },
  { key: "cb", label: "Central banks", hint: "Reserve buying and policy decisions from RBI, Fed and others." },
  { key: "infl", label: "Inflation / crude", hint: "Inflation and oil prices are watched as gold-demand signals." },
  { key: "festive", label: "Festive demand", hint: "Weddings and festivals lift physical demand in India." },
] as const;

export type FactorKey = (typeof FACTORS)[number]["key"];

const PATTERNS: Record<FactorKey, RegExp> = {
  usdinr: /\brupee\b|usd\/inr|\binr\b|dollar index|\bdollar\b/i,
  xau: /spot gold|global gold|international (gold|price)|comex|\bounce\b|xau|gold futures|bullion/i,
  rates: /interest rate|rate cut|rate hike|rate-cut|rate-hike|treasury yield|bond yield|\byields?\b|fomc/i,
  geo: /\bwar\b|tension|conflict|ceasefire|sanction|geopolit|\biran\b|israel|ukraine|russia|tariff|trade war|middle east/i,
  cb: /central bank|\brbi\b|federal reserve|\bthe fed\b|\bfed\b|\becb\b|pboc|gold reserves?|reserve bank/i,
  infl: /inflation|\bcpi\b|crude|oil price|brent|\bwpi\b/i,
  festive: /diwali|dhanteras|akshaya|akshay|wedding|festive|festival|navratri|durga puja|onam|pongal|karwa chauth/i,
};

/** Keyword tagging: marks topics a headline mentions. Not a causal claim. */
export function tagHeadline(title: string): FactorKey[] {
  return (Object.keys(PATTERNS) as FactorKey[]).filter((k) => PATTERNS[k].test(title));
}
