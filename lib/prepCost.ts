/**
 * A house prep still being written costs itself from its parts (m08,
 * make-create-desktop step 6): each part's pack price for what the batch
 * uses, over what the batch makes, for the pour in the drink. Pure; kept
 * out of lib/costing.ts so pricing screens don't load the prep templates.
 * ponytail: drink_cost (SQL) works a saved prep out on its own; the two
 * agree for bought parts, and this one counts tap water as free.
 */
import { lineCostMinor, type PackPrice } from './costing';
import { density } from './drinkMath';
import { prepAmounts, prepYield, type PrepDraft } from './prepKinds';

/** Free in a batch: tap water costs nothing, so it never holds a prep's cost back. */
const FREE = /^(tap )?water$/i;

/** Null while a part has no amount or no price, or nothing says how much the batch makes. `packOf` finds a part's pack by its id or name. */
export function prepCostMinor(prep: PrepDraft, pour: { amount: number | null; unit: string }, packOf: (part: { id: string | null; name: string }) => PackPrice | null): { batchMinor: number; pourMinor: number | null } | null {
  const made = prepYield(prep);
  if (!made) return null;
  let batchMinor = 0;
  for (const { line, amount } of prepAmounts(prep)) {
    if (line.removed || FREE.test(line.name.trim())) continue;
    const pack = amount === null ? null : packOf(line);
    const minor = pack ? lineCostMinor(amount, line.unit, pack, density(line.name, null)) : null;
    if (minor === null) return null;
    batchMinor += minor;
  }
  return { batchMinor, pourMinor: lineCostMinor(pour.amount, pour.unit, { amount: made, unit: 'ml', costMinor: batchMinor }, 1) };
}
