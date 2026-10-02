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
  methodId: string | null;
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
