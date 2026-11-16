/**
 * Synthetic rates page used by the parser and import tests.
 * It reproduces the table structure the parser reads (a per-gram table and a dated history table,
 * with change figures in brackets). It is generated here, not copied from any website.
 */
const HISTORY: [date: string, k24: number, d24: string, k22: number, d22: string][] = [
  ["Nov 16, 2026", 13680, "-82", 12540, "-75"],
  ["Nov 15, 2026", 13762, "0", 12615, "0"],
  ["Nov 14, 2026", 13762, "+27", 12615, "+25"],
  ["Nov 13, 2026", 13735, "-245", 12590, "-225"],
  ["Nov 12, 2026", 13980, "-218", 12815, "-200"],
  ["Nov 11, 2026", 14198, "-71", 13015, "-65"],
  ["Nov 10, 2026", 14269, "-191", 13080, "-175"],
  ["Nov 09, 2026", 14460, "+103", 13255, "+95"],
  ["Nov 08, 2026", 14357, "0", 13160, "0"],
  ["Nov 07, 2026", 14357, "+11", 13160, "+10"],
];

const PER_GRAM: [grams: number, k24: number, k22: number, k18: number][] = [
  [1, 13680, 12540, 10260],
  [8, 109440, 100320, 82080],
  [10, 136800, 125400, 102600],
  [100, 1368000, 1254000, 1026000],
];

// Indian digit grouping: 1,09,440 and 13,68,000.
const inr = (n: number) => `&#x20b9;${new Intl.NumberFormat("en-IN").format(n)}`;
const cell = (price: number, delta: string) => `<td> ${inr(price)} <span> (${delta}) </span></td>`;

export function samplePageHtml(): string {
  const perGram = PER_GRAM.map(
    ([g, a, b, c]) => `<tr><td>${g}</td><td> ${inr(a)} </td><td> ${inr(b)} </td><td> ${inr(c)} </td></tr>`,
  ).join("");
  const history = HISTORY.map(([d, a, da, b, db]) => `<tr><td>${d}</td>${cell(a, da)}${cell(b, db)}</tr>`).join("");
  return (
    "<!doctype html><html><body>" +
    `<table><thead><tr><th>Gram</th><th>24K</th><th>22K</th><th>18K</th></tr></thead><tbody>${perGram}</tbody></table>` +
    `<table><thead><tr><th>Date</th><th>24K</th><th>22K</th></tr></thead><tbody>${history}</tbody></table>` +
    "</body></html>"
  );
}
