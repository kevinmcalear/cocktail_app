/** One cocktail menu a bar put out, as stored in profile_menu_editions. */
export interface MenuEdition {
  id: string;
  name: string;
  year: number;
  month: number | null;
  theme: string | null;
  drinks: string[];
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
