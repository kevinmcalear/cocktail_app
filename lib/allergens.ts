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
  /** When the bar checked this drink's list, while that check still holds (20261204400000). */
  checked?: string | null;
  /** The bar checked it, then the spec or what it's made of changed. */
  stale?: boolean;
}

/** What guest_drink_allergens() returns for one drink: every allergen, never who checked. */
export interface GuestDrinkAllergens {
  item_id: string;
  allergens: DrinkAllergen[];
  unchecked: number;
  lines: number;
  /** When the bar checked it, while that holds; null: "Ask your bartender". */
  checked_at: string | null;
}

export interface AllergyMatch {
  allergen: Allergen;
  /** The ingredient it comes through, when the guest may see its name. */
  ingredient: string | null;
}

/**
 * The guest's own allergies found in a drink (guest-allergies): only on a
 * drink the bar has checked, warnings only (never a reassuring tick), naming
 * the top ingredient it comes through. Null when the bar hasn't checked it,
 * so the page says Ask your bartender.
 */
export function allergyMatches(mine: readonly string[], drink: Pick<GuestDrinkAllergens, 'allergens' | 'checked_at'>): AllergyMatch[] | null {
  if (!drink.checked_at) return null;
  return drink.allergens
    .filter((a) => mine.includes(a.allergen))
    .map((a) => ({ allergen: a.allergen, ingredient: a.via.find((path) => path.length > 0)?.[0] ?? null }));
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
 * A beer's, wine's or bottle's own declaration as one line (board Item-page,
 * staff: "Sulphites"): what it contains, "No allergens" once checked with
 * none, and never none when nobody has checked.
 */
export function ownAllergenLine(declared: { allergens: readonly string[] } | null): string {
  if (!declared) return 'Allergens not checked yet';
  const list = listAllergens(declared.allergens);
  return list ? list[0].toUpperCase() + list.slice(1) : 'No allergens';
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
