/**
 * A "series" is a set of prices that are comparable with each other. Retail rates, vendor rates and
 * an international-spot estimate differ by ~15%, so mixing them would fake jumps and corrupt history.
 */
export function seriesOf(source: string): string {
  // Hand-entered and imported rates are the same retail series the saved page provides.
  if (source === "saved-html" || source === "goodreturns" || source === "manual" || source === "import") return "retail-site";
  if (source === "licensed" || source === "licensed-derived") return "licensed";
  return source; // e.g. "spot-estimate"
}
