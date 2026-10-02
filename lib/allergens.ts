/**
 * The 14 allergens venues in the UK and EU must be able to declare. Declared
 * on what a bar buys, rolled up to drinks by drink_allergens() on the server.
 */
export const ALLERGENS = [
  { key: 'celery', label: 'Celery' },
  { key: 'gluten', label: 'Cereals containing gluten' },
  { key: 'crustaceans', label: 'Crustaceans' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'fish', label: 'Fish' },
  { key: 'lupin', label: 'Lupin' },
  { key: 'milk', label: 'Milk' },
  { key: 'molluscs', label: 'Molluscs' },
  { key: 'mustard', label: 'Mustard' },
  { key: 'tree_nuts', label: 'Tree nuts' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'soya', label: 'Soya' },
  { key: 'sulphites', label: 'Sulphites' },
] as const;

export type Allergen = (typeof ALLERGENS)[number]['key'];

export interface DrinkAllergen {
  allergen: Allergen;
  /** Ingredient names on the way down, top line first. Names the viewer can't see are left out. */
  via: string[][];
}

/** What drink_allergens() returns. */
export interface DrinkAllergens {
  allergens: DrinkAllergen[];
  /** Bought ingredients nobody has checked yet. */
  unchecked: number;
  /** Lines in the spec. */
  lines: number;
}

export function allergenLabel(key: string): string {
  return ALLERGENS.find((a) => a.key === key)?.label ?? key;
}

/** "eggs and sulphites", "milk, eggs and sulphites". Lower case for mid-sentence. */
export function listAllergens(keys: readonly string[]): string {
  const names = keys.map((k) => allergenLabel(k).toLowerCase());
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The one line a server reads out: "Contains eggs and sulphites." Unchecked
 * ingredients are never hidden behind a clean bill.
 */
export function containsLine(d: DrinkAllergens | null | undefined): string {
  if (!d || d.lines === 0) return 'No spec yet, so nothing to declare.';
  const contains = d.allergens.length ? `Contains ${listAllergens(d.allergens.map((a) => a.allergen))}.` : 'No allergens declared.';
  if (d.unchecked === 0) return contains;
  const n = d.unchecked === 1 ? '1 ingredient' : `${d.unchecked} ingredients`;
  return `${contains} ${n} not checked yet.`;
}

/** "via Raspberry syrup, in Egg white" for one path, or "" when every name is hidden. */
export function viaLine(path: string[]): string {
  if (!path.length) return '';
  return `via ${path.join(', in ')}`;
}

/** "Checked 24 Sep" or "Not checked yet". */
export function checkedLine(checkedAt: string | null | undefined, now = new Date()): string {
  if (!checkedAt) return 'Not checked yet';
  const at = new Date(checkedAt);
  const sameYear = at.getFullYear() === now.getFullYear();
  const date = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return `Checked ${date}`;
}
