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
  /** When it started; month is null when only the year is known. */
  year: number;
  month: number | null;
  /** When it came off; null while it's on, or when nobody knows. */
  end_year: number | null;
  end_month: number | null;
  /** The menu the bar is pouring now. */
  is_current: boolean;
  theme: string | null;
  drinks: MenuEditionDrink[];
  source_url: string | null;
}

/**
 * When a menu, or a drink's run across a bar's menus, was on. A drink on
 * several menus runs from the first one's start to the last one's end.
 */
export interface MenuDates {
  startYear: number;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
}

/** On now; or past, with a known end; or neither, when the record stops without saying. */
export type MenuState = 'current' | 'past' | 'unknown';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function editionDates(e: Pick<MenuEdition, 'year' | 'month' | 'end_year' | 'end_month' | 'is_current'>): MenuDates {
  return { startYear: e.year, startMonth: e.month, endYear: e.end_year, endMonth: e.end_month, isCurrent: e.is_current };
}

/** A drink's run as menu_drink_runs and search_bar_drinks return it. */
export interface MenuRunRow {
  start_year: number;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
}

export function runDates(r: MenuRunRow): MenuDates {
  return { startYear: r.start_year, startMonth: r.start_month, endYear: r.end_year, endMonth: r.end_month, isCurrent: r.is_current };
}

/** A bar's drink whose every menu has come off is tagged "Past menu" (never "sold out"). */
export function withPastMenuTag(tags: string[], runs: MenuDates[]): string[] {
  return runs.length && runs.every((r) => menuState(r) === 'past') ? [...tags, 'Past menu'] : tags;
}

export function menuState(d: MenuDates): MenuState {
  if (d.isCurrent) return 'current';
  return d.endYear !== null ? 'past' : 'unknown';
}

/** "Mar 2024", or "2024" when the month isn't known. */
function shortDate(year: number, month: number | null): string {
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
}

/** "On now since Sep 2025", "Mar 2024 to Jan 2025", or "From 2019, end date unknown". */
export function menuRange(d: MenuDates): string {
  const start = shortDate(d.startYear, d.startMonth);
  const state = menuState(d);
  if (state === 'current') return `On now since ${start}`;
  if (state === 'unknown') return `From ${start}, end date unknown`;
  const end = shortDate(d.endYear!, d.endMonth);
  return end === start ? start : `${start} to ${end}`;
}

/** "17 months", "3 years": how long a menu ran, when both months are known. */
function runLength(d: MenuDates): string | null {
  if (d.startMonth === null || d.endYear === null || d.endMonth === null) return null;
  const months = (d.endYear - d.startYear) * 12 + d.endMonth - d.startMonth;
  if (months < 1) return null;
  if (months < 24) return months === 1 ? '1 month' : `${months} months`;
  return `${Math.round(months / 12)} years`;
}

/** A menu on a bar's timeline: "On now · since Sep 2025", "Mar 2024 to Aug 2025 · 17 months", "2021 · end date unknown". */
export function timelineDates(d: MenuDates): string {
  const start = shortDate(d.startYear, d.startMonth);
  const state = menuState(d);
  if (state === 'current') return `On now · since ${start}`;
  if (state === 'unknown') return `${start} · end date unknown`;
  return [menuRange(d), runLength(d)].filter(Boolean).join(' · ');
}

/** "Night Garden menu"; a name that already says menu stays as it is. */
function menuName(name: string): string {
  return /\bmenu$/i.test(name.trim()) ? name.trim() : `${name.trim()} menu`;
}

/**
 * The card on a bar's drink: when it was on the menu, and whether it's on
 * now, so nobody asks for one that came off. "On the menu Mar 2024 to Jan
 * 2025" over "Night Garden menu · not on at Little Rye now".
 */
export function drinkMenuCard(bar: string, edition: string, d: MenuDates): { title: string; detail: string } {
  const start = shortDate(d.startYear, d.startMonth);
  const state = menuState(d);
  if (state === 'current') return { title: `On the menu now, since ${start}`, detail: `${menuName(edition)} · on at ${bar} now` };
  if (state === 'unknown') return { title: `On the menu from ${start}`, detail: `${menuName(edition)} at ${bar} · end date unknown` };
  return { title: `On the menu ${menuRange(d)}`, detail: `${menuName(edition)} · not on at ${bar} now` };
}

/** A bar's drink in search: "on now", "Past · Mar 2024 to Jan 2025", or nothing when the record doesn't say. */
export function searchMenuTag(d: MenuDates | null): { onNow: boolean; past?: string } | undefined {
  if (!d) return undefined;
  const state = menuState(d);
  if (state === 'current') return { onNow: true };
  return state === 'past' ? { onNow: false, past: `Past · ${menuRange(d)}` } : undefined;
}

/** Where a bar's drink sorts in search: on a menu now, then undated or open-ended, then past. */
export function menuOrder(d: MenuDates | null): number {
  if (!d) return 1;
  return { current: 0, unknown: 1, past: 2 }[menuState(d)];
}

/** "Plum Negroni, Lavender Static and 10 more"; "Drinks not listed in our sources" when there are none. */
export function editionDrinkLine(names: string[], shown = 3): string {
  if (!names.length) return 'Drinks not listed in our sources';
  if (names.length <= shown) return names.join(', ');
  return `${names.slice(0, shown).join(', ')} and ${names.length - shown} more`;
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
