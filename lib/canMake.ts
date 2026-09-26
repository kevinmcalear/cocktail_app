/**
 * "Can make" for My Bar: which drinks the bottles on your shelf cover, and
 * which drinks are one bottle away. Pure, so it runs on whatever recipes the
 * person can see (the role-masked presentation), and never needs the spec.
 *
 * A recipe row is covered by a bottle that is the row's ingredient, or that
 * shares the row's generic: a shelf with Tanqueray covers "Gin", and a shelf
 * with "Gin" covers a row that calls for Tanqueray. A house-made ingredient
 * (one with its own recipe) counts as on hand when its recipe is covered,
 * worked out as a bounded fixpoint. Optional rows never block a drink.
 */

export interface RecipeRow {
  /** The ingredient shown for the row (a brand, or its generic when masked). */
  ingredientId: string;
  /** The row's generic, when it has one ("Gin" for a Tanqueray row). */
  genericId: string | null;
  optional: boolean;
}

export interface CanMakeInput {
  /** Item ids on the shelf: bottles or generics. */
  shelf: string[];
  /** Drinks to check, by id, with their rows. */
  drinks: Record<string, RecipeRow[]>;
  /** House-made ingredients' own recipes, by ingredient id. */
  houseMade: Record<string, RecipeRow[]>;
}

export interface OneAway {
  /** The missing ingredient (the row's generic when it has one). */
  ingredientId: string;
  drinkIds: string[];
}

export interface CanMakeResult {
  canMake: string[];
  /** Grouped by what's missing, most drinks unlocked first. */
  oneAway: OneAway[];
  /** Everything counted as on hand, including house-made ingredients. */
  onHand: Set<string>;
}

// Deeper nesting than this (a syrup made from a syrup made from a syrup) is
// unlikely; the bound stops a recipe cycle looping forever.
const MAX_DEPTH = 5;

/** Bottle to generic, learned from the rows themselves (items don't store it). */
function genericsOf(rowLists: RecipeRow[][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rows of rowLists)
    for (const r of rows) if (r.genericId && r.genericId !== r.ingredientId) map.set(r.ingredientId, r.genericId);
  return map;
}

function isCovered(row: RecipeRow, have: Set<string>, generic: Map<string, string>): boolean {
  if (have.has(row.ingredientId)) return true;
  const key = row.genericId ?? generic.get(row.ingredientId);
  return !!key && have.has(key);
}

/** The ids that satisfy rows: what's on hand plus each item's generic. */
function haveKeys(onHand: Set<string>, generic: Map<string, string>): Set<string> {
  const keys = new Set(onHand);
  for (const id of onHand) {
    const g = generic.get(id);
    if (g) keys.add(g);
  }
  return keys;
}

function missingRows(rows: RecipeRow[], have: Set<string>, generic: Map<string, string>): RecipeRow[] {
  return rows.filter((r) => !r.optional && !isCovered(r, have, generic));
}

export function canMake({ shelf, drinks, houseMade }: CanMakeInput): CanMakeResult {
  const generic = genericsOf([...Object.values(drinks), ...Object.values(houseMade)]);
  const onHand = new Set(shelf);
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const have = haveKeys(onHand, generic);
    let added = false;
    for (const [id, rows] of Object.entries(houseMade)) {
      if (onHand.has(id) || rows.length === 0) continue;
      if (missingRows(rows, have, generic).length === 0) {
        onHand.add(id);
        added = true;
      }
    }
    if (!added) break;
  }

  const have = haveKeys(onHand, generic);
  // What to buy for a missing row: the bottle itself, or for a house-made
  // ingredient, the bottles its own recipe is missing (so "olive oil", not
  // "olive oil-washed gin").
  const toBuy = (row: RecipeRow, depth: number): Set<string> => {
    const recipe = houseMade[row.ingredientId];
    if (recipe?.length && depth < MAX_DEPTH) {
      const out = new Set<string>();
      for (const r of missingRows(recipe, have, generic)) for (const k of toBuy(r, depth + 1)) out.add(k);
      if (out.size) return out;
    }
    return new Set([row.genericId ?? generic.get(row.ingredientId) ?? row.ingredientId]);
  };

  const can: string[] = [];
  const away = new Map<string, string[]>();
  for (const [id, rows] of Object.entries(drinks)) {
    if (rows.length === 0) continue;
    const missing = missingRows(rows, have, generic);
    if (missing.length === 0) {
      can.push(id);
      continue;
    }
    const buy = new Set<string>();
    for (const m of missing) for (const k of toBuy(m, 0)) buy.add(k);
    if (buy.size === 1) {
      const [key] = buy;
      away.set(key, [...(away.get(key) ?? []), id]);
    }
  }
  const oneAway = [...away.entries()]
    .map(([ingredientId, drinkIds]) => ({ ingredientId, drinkIds }))
    .sort((a, b) => b.drinkIds.length - a.drinkIds.length || a.ingredientId.localeCompare(b.ingredientId));
  return { canMake: can, oneAway, onHand };
}
