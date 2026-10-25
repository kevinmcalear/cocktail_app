/**
 * Cost, GP and selling price, the way Ethyl works them out and a UK bar
 * reads them: GP is taken on the price without tax, so a bar whose menu
 * prices include VAT strips it first, and a US bar that adds tax at the till
 * uses the menu price as it is. Pure; money stays in minor units.
 */
import { density, toMl } from './drinkMath';
import { prepAmounts, prepYield, type PrepDraft } from './prepKinds';

export interface Margin {
  /** The menu price without tax, in minor units. */
  exTaxMinor: number;
  /** Gross profit as a percent of the ex-tax price. */
  gp: number;
  /** Cost as a percent of the ex-tax price. */
  pourCost: number;
  /** What the drink makes after tax and ingredients, in minor units. */
  profitMinor: number;
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
  return { exTaxMinor: ex, gp: ((ex - costMinor) / ex) * 100, pourCost: (costMinor / ex) * 100, profitMinor: ex - costMinor };
}

/** Put the tax back on where the menu carries it, then round up to the nearest 10 minor units. */
function menuPrice(exTaxMinor: number, tax: TaxRule): number {
  const menu = tax.pricesIncludeTax ? exTaxMinor * (1 + tax.taxRate / 100) : exTaxMinor;
  // Float noise (2900.0000000004) would otherwise round a clean price up a step.
  return Math.ceil(Math.round(menu * 1e6) / 1e7) * 10;
}

/**
 * The menu price that hits a target GP: the ex-tax price is cost over
 * (1 - GP), then the tax goes back on where the menu carries it. Rounded up
 * to the nearest 10 minor units, since nobody prints £12.67.
 */
export function priceForTarget(costMinor: number, targetGp: number, tax: TaxRule): number | null {
  if (!(targetGp >= 0 && targetGp < 100) || costMinor < 0) return null;
  return menuPrice(costMinor / (1 - targetGp / 100), tax);
}

/** The menu price that makes at least `minProfitMinor` after tax and ingredients, rounded up like priceForTarget. */
export function priceForProfit(costMinor: number, minProfitMinor: number, tax: TaxRule): number | null {
  if (!(minProfitMinor >= 0) || costMinor < 0) return null;
  return menuPrice(costMinor + minProfitMinor, tax);
}

/**
 * What a venue wants every drink to make (Pricing): a GP in percent, and the
 * least it should make in money (bars.min_profit_minor). Either can be unset.
 */
export interface Targets {
  gp: number | null | undefined;
  minProfitMinor: number | null | undefined;
}

/** Which target a drink misses. */
export type Under = 'gp' | 'profit' | 'both';

/** "on target", or the target it misses and the menu price that clears every target set; null with none set. */
export type TargetStatus = { onTarget: true } | { onTarget: false; priceMinor: number; under: Under } | null;

export function targetStatus(costMinor: number, priceMinor: number | null | undefined, targets: Targets, tax: TaxRule): TargetStatus {
  const gp = targets.gp ?? null;
  const floor = targets.minProfitMinor ?? null;
  if (gp == null && floor == null) return null;
  const m = margin(costMinor, priceMinor, tax);
  // No price yet: every target set is missed, and the price says what it would take.
  const missGp = gp != null && (!m || m.gp < gp);
  const missProfit = floor != null && (!m || m.profitMinor < floor);
  if (!missGp && !missProfit) return { onTarget: true };
  const needed = [gp != null ? priceForTarget(costMinor, gp, tax) : null, floor != null ? priceForProfit(costMinor, floor, tax) : null].filter((p): p is number => p != null);
  if (!needed.length) return null;
  return { onTarget: false, priceMinor: Math.max(...needed), under: missGp && missProfit ? 'both' : missGp ? 'gp' : 'profit' };
}

/** A bar's pack of an ingredient: its size and price (item_purchasing, item_costs). */
export interface PackPrice {
  amount: number;
  unit: string;
  costMinor: number;
}

/**
 * What one spec line costs from its pack price, in minor units, as
 * drink_cost reads a bought bottle: volumes and weights meet through the
 * density, and any count (a wedge, a peel) is one of a pack counted in
 * each. Null when it can't be said: no amount, a top, a count against a
 * bottle. ponytail: a house prep's cost from its own recipe and yield is
 * left to drink_cost once the drink is saved.
 */
export function lineCostMinor(amount: number | null, unit: string, pack: PackPrice, gPerMl: number): number | null {
  if (amount == null || !(pack.amount > 0)) return null;
  const used = toMl(amount, unit, gPerMl);
  const bought = toMl(pack.amount, pack.unit, gPerMl);
  if (used != null && bought != null) return Math.round((pack.costMinor * used) / bought);
  // Two counts: a wedge of a box of 12 limes is one of 12, as drink_cost counts them.
  if (used == null && bought == null) return Math.round((pack.costMinor * amount) / pack.amount);
  return null;
}

/** Free in a batch: tap water costs nothing, so it never holds a prep's cost back. */
const FREE = /^(tap )?water$/i;

/**
 * A house prep still being written costs itself from its parts (m08): each
 * part's pack price for what the batch uses, over what the batch makes, for
 * the pour in the drink. `packOf` is a part's pack (by its catalog id, or its name). Null
 * while a part has no price or nothing says how much it makes.
 */
export function prepCostMinor(prep: PrepDraft, pour: { amount: number | null; unit: string }, packOf: (part: { id: string | null; name: string }) => PackPrice | null): { batchMinor: number; pourMinor: number | null } | null {
  const made = prepYield(prep);
  if (!made) return null;
  let batchMinor = 0;
  for (const { line, amount } of prepAmounts(prep)) {
    if (amount === null || FREE.test(line.name.trim())) continue;
    const pack = packOf(line);
    const minor = pack ? lineCostMinor(amount, line.unit, pack, density(line.name, null)) : null;
    if (minor === null) return null;
    batchMinor += minor;
  }
  return { batchMinor, pourMinor: lineCostMinor(pour.amount, pour.unit, { amount: made, unit: 'ml', costMinor: batchMinor }, 1) };
}

/** "81.0%". */
export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export interface MenuCostLine {
  costMinor: number | null;
  priceMinor: number | null;
  /** Lines on the drink still without a price. */
  missing: number;
}

export interface MenuCostSummary {
  /** Mean GP over the drinks that have a cost and a price. */
  averageGp: number | null;
  /** Mean profit per drink over the same drinks, in minor units. */
  averageProfitMinor: number | null;
  underTarget: number;
  /** Drinks whose cost is still incomplete. */
  incomplete: number;
  priced: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The footer of a menu costing: average GP and profit, how many priced drinks miss a target, how many are incomplete. */
export function menuSummary(rows: MenuCostLine[], targets: Targets, tax: TaxRule): MenuCostSummary {
  const margins = rows.map((r) => (r.costMinor == null ? null : margin(r.costMinor, r.priceMinor, tax)));
  const priced = margins.filter((m): m is Margin => !!m);
  const under = (m: Margin) => (targets.gp != null && m.gp < targets.gp) || (targets.minProfitMinor != null && m.profitMinor < targets.minProfitMinor);
  return {
    averageGp: mean(priced.map((m) => m.gp)),
    averageProfitMinor: mean(priced.map((m) => m.profitMinor)),
    underTarget: priced.filter(under).length,
    incomplete: rows.filter((r) => r.costMinor == null || r.missing > 0).length,
    priced: priced.length,
  };
}

/** "78% GP and at least $11.00 a drink": what a venue's targets ask for; null with none set. */
export function targetsLine(targets: Targets, money: (minor: number) => string): string | null {
  const parts = [targets.gp != null ? `${targets.gp}% GP` : null, targets.minProfitMinor != null ? `at least ${money(targets.minProfitMinor)} a drink` : null].filter(Boolean);
  return parts.length ? parts.join(' and ') : null;
}

/** The tag on a drink under target: "Under 78% GP", "Makes under $11.00", "Under both targets". */
export function underLabel(under: Under, targets: Targets, money: (minor: number) => string): string {
  if (under === 'both') return 'Under both targets';
  if (under === 'gp') return `Under ${targets.gp}% GP`;
  return `Makes under ${money(targets.minProfitMinor ?? 0)}`;
}
