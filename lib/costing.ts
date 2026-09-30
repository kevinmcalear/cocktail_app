/**
 * Cost, GP and selling price, the way Ethyl works them out and a UK bar
 * reads them: GP is taken on the price without tax, so a bar whose menu
 * prices include VAT strips it first, and a US bar that adds tax at the till
 * uses the menu price as it is. Pure; money stays in minor units.
 */

export interface Margin {
  /** The menu price without tax, in minor units. */
  exTaxMinor: number;
  /** Gross profit as a percent of the ex-tax price. */
  gp: number;
  /** Cost as a percent of the ex-tax price. */
  pourCost: number;
}

export interface TaxRule {
  taxRate: number;
  pricesIncludeTax: boolean;
}

/** The price without tax: strip it when the menu price carries it. */
export function exTax(priceMinor: number, tax: TaxRule): number {
  return tax.pricesIncludeTax ? priceMinor / (1 + tax.taxRate / 100) : priceMinor;
}

/** GP and pour cost for a serve that costs `costMinor` and sells at `priceMinor`; null without a price. */
export function margin(costMinor: number, priceMinor: number | null | undefined, tax: TaxRule): Margin | null {
  if (priceMinor == null || priceMinor <= 0) return null;
  const ex = exTax(priceMinor, tax);
  return { exTaxMinor: ex, gp: ((ex - costMinor) / ex) * 100, pourCost: (costMinor / ex) * 100 };
}

/**
 * The menu price that hits a target GP: the ex-tax price is cost over
 * (1 - GP), then the tax goes back on where the menu carries it. Rounded up
 * to the nearest 10 minor units, since nobody prints £12.67.
 */
export function priceForTarget(costMinor: number, targetGp: number, tax: TaxRule): number | null {
  if (!(targetGp >= 0 && targetGp < 100) || costMinor < 0) return null;
  const ex = costMinor / (1 - targetGp / 100);
  const menu = tax.pricesIncludeTax ? ex * (1 + tax.taxRate / 100) : ex;
  return Math.ceil(menu / 10) * 10;
}

/** "on target", "£12.70 gets there", or null with no target. */
export type TargetStatus = { onTarget: true } | { onTarget: false; priceMinor: number } | null;

export function targetStatus(costMinor: number, priceMinor: number | null | undefined, targetGp: number | null | undefined, tax: TaxRule): TargetStatus {
  if (targetGp == null) return null;
  const m = margin(costMinor, priceMinor, tax);
  if (m && m.gp >= targetGp) return { onTarget: true };
  const needed = priceForTarget(costMinor, targetGp, tax);
  return needed == null ? null : { onTarget: false, priceMinor: needed };
}

/** "81.0%". */
export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
