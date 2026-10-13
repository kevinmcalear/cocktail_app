import type { SpecLineInput } from '@/hooks/useVersions';

export type SwapMode = 'kind' | 'bottle';

export interface SwapLine {
  id: string;
  ingredientId: string | null;
  /** The line's parent, or the bottle's generic. What "anything that's gin" matches. */
  genericId: string | null;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  optional: boolean;
}

export interface SwapDrink {
  id: string;
  name: string;
  itemType: 'cocktail' | 'ingredient';
  methodIds: string[];
  lines: SwapLine[];
}

export function lineHits(line: SwapLine, findId: string, replaceId: string, mode: SwapMode): boolean {
  if (!line.ingredientId || line.ingredientId === replaceId) return false;
  if (mode === 'bottle') return line.ingredientId === findId;
  return line.ingredientId === findId || line.genericId === findId;
}

export interface SwapChange {
  amount: string;
  from: string;
  to: string;
}

export interface SwapHit {
  drink: SwapDrink;
  changes: SwapChange[];
}

function amountOf(line: SwapLine): string {
  return [line.amount ?? '', line.unit ?? ''].filter((part) => part !== '').join(' ');
}

/**
 * Cocktails whose spec pours the bottle (or anything of that kind). House
 * recipes are listed beside the swap, not included: changing a syrup changes
 * every drink that pours it. Drinks with a hidden line are left out, because
 * saving would rewrite that line blind.
 */
export function planSwap(
  drinks: SwapDrink[],
  findId: string,
  replaceId: string,
  mode: SwapMode,
  onMenuIds: Set<string> | null,
  names: Record<string, string>,
  replaceName: string,
): { hits: SwapHit[]; houses: { id: string; name: string }[] } {
  const hits: SwapHit[] = [];
  const houses: { id: string; name: string }[] = [];
  for (const drink of drinks) {
    if (drink.lines.some((line) => !line.ingredientId)) continue;
    const changing = drink.lines.filter((line) => lineHits(line, findId, replaceId, mode));
    if (!changing.length) continue;
    if (drink.itemType === 'ingredient') {
      houses.push({ id: drink.id, name: drink.name });
      continue;
    }
    if (onMenuIds && !onMenuIds.has(drink.id)) continue;
    hits.push({
      drink,
      changes: changing.map((line) => ({
        amount: amountOf(line),
        from: names[line.ingredientId!] ?? 'that bottle',
        to: replaceName,
      })),
    });
  }
  return { hits, houses };
}

/** Every line of the drink, with the matched bottles pointed at the new one. */
export function swappedLines(drink: SwapDrink, findId: string, replaceId: string, mode: SwapMode): SpecLineInput[] {
  return drink.lines.map((line) => ({
    id: line.id,
    ingredient_item_id: lineHits(line, findId, replaceId, mode) ? replaceId : (line.ingredientId as string),
    amount: line.amount,
    unit: line.unit,
    preparation_notes: line.notes,
    is_optional: line.optional,
  }));
}

/** A spec line as the raw recipes table has it (fetchEditableRecipes). */
export interface RawSpecLine {
  id: string;
  ingredient_item_id: string | null;
  amount: number | string | null;
  unit: string | null;
  preparation_notes: string | null;
  is_optional: boolean | null;
}

/**
 * Every line of the drink as it is, with one line pointed at another bottle
 * (and given a new amount, when one is passed). Null when the line is gone or
 * a line has no ingredient: saving would then rewrite the spec blind.
 */
export function oneLineSwapped(rows: RawSpecLine[], lineId: string, ingredientId: string, amount?: number | null): SpecLineInput[] | null {
  if (!rows.some((row) => row.id === lineId) || rows.some((row) => !row.ingredient_item_id)) return null;
  return rows.map((row) => {
    const hit = row.id === lineId;
    const was = row.amount === null || row.amount === '' ? null : Number(row.amount);
    return {
      id: row.id,
      ingredient_item_id: hit ? ingredientId : (row.ingredient_item_id as string),
      amount: hit && amount !== undefined ? amount : was,
      unit: row.unit,
      preparation_notes: row.preparation_notes,
      is_optional: !!row.is_optional,
    };
  });
}

export interface BottleOption {
  id: string;
  name: string | null;
  bar_id?: string | null;
  generic_id?: string | null;
  hide_from_search?: boolean | null;
}

/**
 * What to offer in place of a line's ingredient before anything is typed:
 * the bottles of that kind when the line names a kind ("Blended Scotch":
 * Ballantine's, Ardray), else the other bottles of its kind. Only shared
 * bottles and this venue's own, the venue's first.
 */
export function bottlesFor<T extends BottleOption>(ingredientId: string, catalog: readonly T[], barId: string | null, limit = 6): T[] {
  const usable = (item: T) => item.id !== ingredientId && !item.hide_from_search && !!item.name && (!item.bar_id || item.bar_id === barId);
  const line = catalog.find((item) => item.id === ingredientId);
  let picks = catalog.filter((item) => item.generic_id === ingredientId && usable(item));
  if (!picks.length && line?.generic_id) picks = catalog.filter((item) => item.generic_id === line.generic_id && usable(item));
  return picks.sort((a, b) => Number(!!b.bar_id) - Number(!!a.bar_id) || (a.name ?? '').localeCompare(b.name ?? '')).slice(0, limit);
}
