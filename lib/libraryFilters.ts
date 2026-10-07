import type { ItemCategory } from '@/lib/itemRoutes';
import { groupMenus } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

/** Library's filters, as they read in the URL: /library?show=staff. */
export type Show = 'all' | 'on-menu' | 'staff' | 'past' | 'cocktails' | 'ingredients' | 'beer' | 'wine' | 'needs-price';

/** Which drinks: only at a venue. */
export const LIST_FILTERS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'on-menu', label: 'On menu' },
  { value: 'staff', label: 'Staff list' },
  { value: 'past', label: 'Past' },
];

/** What kind of thing. Needs a price shows with the costs capability. */
export const TYPE_FILTERS: { value: Show; label: string; category?: ItemCategory }[] = [
  { value: 'cocktails', label: 'Cocktails', category: 'Cocktail' },
  { value: 'ingredients', label: 'Ingredients', category: 'Ingredient' },
  { value: 'beer', label: 'Beer', category: 'Beer' },
  { value: 'wine', label: 'Wine', category: 'Wine' },
];
export const NEEDS_PRICE = { value: 'needs-price' as Show, label: 'Needs a price' };

/** "All" is the drinks: cocktails, beer and wine. Ingredients have their own filter. */
export const DRINK_CATEGORIES: readonly ItemCategory[] = ['Cocktail', 'Beer', 'Wine'];

const SHOWS = new Set<string>([...LIST_FILTERS, ...TYPE_FILTERS, NEEDS_PRICE].map((f) => f.value));

/** The filter in the URL, or All. The old Off menu screen arrives as ?show=staff. */
export function parseShow(param: string | string[] | undefined, atVenue: boolean): Show {
  const value = Array.isArray(param) ? param[0] : param;
  const show = value && SHOWS.has(value) ? (value as Show) : 'all';
  // Without a venue there are no menus or staff list: show the cocktails.
  if (!atVenue && LIST_FILTERS.some((f) => f.value === show)) return 'cocktails';
  return show;
}

/** The items row id behind a catalog card: beer and wine cards carry a `beer-`/`wine-` prefix. */
export function itemIdOf(cardId: string): string {
  return cardId.replace(/^(beer|wine)-/, '');
}

export interface OnMenu {
  id: string;
  name: string;
  itemIds: string[];
}

/**
 * The venue's drinks by menu: the menus on now, the drinks on them (or on the
 * one picked), and the drinks that were on a past menu and aren't on now.
 */
export function menuDrinks(
  menus: MenuSummary[],
  now: number,
  picked: string | null
): { onMenus: OnMenu[]; on: string[]; onNow: string[]; past: string[] } {
  const groups = groupMenus(menus, now);
  const onMenus = groups.on.map((m) => ({ id: m.id, name: m.name, itemIds: [...new Set(m.itemIds)] }));
  const onNow = new Set(onMenus.flatMap((m) => m.itemIds));
  const pick = onMenus.find((m) => m.id === picked);
  const on = pick ? pick.itemIds : [...onNow];
  const past = [...new Set(groups.previous.flatMap((m) => m.itemIds))].filter((id) => !onNow.has(id));
  return { onMenus, on, onNow: [...onNow], past };
}

export type MenuState = 'On menu' | 'Past' | 'Off menu';

/** Where a drink stands with the menus: on one now, on one before, or never. */
export function menuState(itemId: string, onNow: ReadonlySet<string>, past: ReadonlySet<string>): MenuState {
  if (onNow.has(itemId)) return 'On menu';
  return past.has(itemId) ? 'Past' : 'Off menu';
}
