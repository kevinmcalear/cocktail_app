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
 * every top ingredient it comes through. Null when the bar hasn't checked it,
 * so the page says Ask your bartender.
 */
export function allergyMatches(mine: readonly string[], drink: Pick<GuestDrinkAllergens, 'allergens' | 'checked_at'>): AllergyMatch[] | null {
  if (!drink.checked_at) return null;
  return drink.allergens
    .filter((a) => mine.includes(a.allergen))
    .flatMap((a): AllergyMatch[] => {
      const tops = [...new Set(a.via.map((path) => path[0]).filter(Boolean))];
      return tops.length ? tops.map((ingredient) => ({ allergen: a.allergen, ingredient })) : [{ allergen: a.allergen, ingredient: null }];
    });
}

export function allergenLabel(key: string): string {
  return ALLERGENS.find((a) => a.key === key)?.label ?? key;
}

export function andList(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "eggs and sulphites", "milk, eggs and sulphites". Lower case for mid-sentence. */
export function listAllergens(keys: readonly string[]): string {
  return andList(keys.map((k) => allergenLabel(k).toLowerCase()));
}
