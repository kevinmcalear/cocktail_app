import type { MenuDrink } from '@/types/menus';

/** A cocktail on a menu edition: the bar's own drink, not a bare name. */
export interface MenuEditionDrink {
  id: string;
  name: string;
}

/** One cocktail menu a bar put out, as stored in profile_menu_editions. */
export interface MenuEdition {
  id: string;
  name: string;
  year: number;
  month: number | null;
  theme: string | null;
  drinks: MenuEditionDrink[];
  source_url: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "May 2023", or "2023" when the month isn't known. */
export function menuDate(edition: Pick<MenuEdition, 'year' | 'month'>): string {
  return edition.month ? `${MONTHS[edition.month - 1]} ${edition.year}` : String(edition.year);
}

/** Newest menu first; a menu with only a year sorts after the dated ones that year. */
export function sortEditions<T extends Pick<MenuEdition, 'year' | 'month' | 'name'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0) || a.name.localeCompare(b.name));
}

/**
 * An edition's drinks as a menu sets them, in the edition's order: the full
 * drink (ingredients, picture) when the reader could load it, else its name.
 */
export function editionMenuDrinks(drinks: MenuEditionDrink[], loaded: MenuDrink[]): MenuDrink[] {
  const byId = new Map(loaded.map((d) => [d.id, d]));
  return drinks.map(
    (d) => byId.get(d.id) ?? { id: d.id, name: d.name, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null }
  );
}
