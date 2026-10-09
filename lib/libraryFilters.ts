import type { ItemCategory } from '@/lib/itemRoutes';
import { groupMenus } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

/** Library's filters, as they read in the URL: /library?show=staff. */
export type Show =
  | 'all' | 'on-menu' | 'staff' | 'past'
  | 'batched' | 'preps' | 'garnishes' | 'bottles'
  | 'cocktails' | 'ingredients' | 'beer' | 'wine' | 'needs-price';

/** Which drinks: only at a venue. */
export const LIST_FILTERS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'on-menu', label: 'On menu' },
  { value: 'staff', label: 'Staff list' },
  { value: 'past', label: 'Past' },
];

/**
 * A venue's spec book, shelved the way bar teams file it: drinks served from a
 * batch, what the bar makes, how drinks are finished, and what it buys. Only at
 * a venue, where they replace the one Ingredients filter.
 */
export const SHELF_FILTERS: { value: Show; label: string }[] = [
  { value: 'batched', label: 'Batched' },
  { value: 'preps', label: 'Preps' },
  { value: 'garnishes', label: 'Garnishes' },
  { value: 'bottles', label: 'Bottles' },
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

const SHOWS = new Set<string>([...LIST_FILTERS, ...SHELF_FILTERS, ...TYPE_FILTERS, NEEDS_PRICE].map((f) => f.value));

/** The filter in the URL, or All. The old Off menu screen arrives as ?show=staff. */
export function parseShow(param: string | string[] | undefined, atVenue: boolean): Show {
  const value = Array.isArray(param) ? param[0] : param;
  const show = value && SHOWS.has(value) ? (value as Show) : 'all';
  // Without a venue there are no menus, staff list or shelves.
  if (!atVenue && (LIST_FILTERS.some((f) => f.value === show) || show === 'batched')) return 'cocktails';
  if (!atVenue && SHELF_FILTERS.some((f) => f.value === show)) return 'ingredients';
  // At a venue the shelves replace Ingredients; old links land on Bottles.
  if (atVenue && show === 'ingredients') return 'bottles';
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

/** Service styles poured from a batch made ahead (lib/service.ts). */
export const BATCHED_STYLES: readonly string[] = ['batched', 'bottled', 'carbonated', 'draught'];

/**
 * A drink's line that finishes it rather than goes in it: the note says
 * garnish, or the unit is a peel, twist, wheel or rim. Same rule as My Bar's
 * (supabase/migrations/20261009960000_my_bar_garnish.sql), minus the names.
 */
export function isGarnishLine(note: string | null | undefined, unit: string | null | undefined): boolean {
  return /\bgarnish/i.test(note ?? '') || ['peel', 'twist', 'wheel', 'rim'].includes((unit ?? '').toLowerCase());
}

export interface ShelfLine {
  display_ingredient_id?: string | null;
  preparation_notes?: string | null;
  unit?: string | null;
}

export interface ShelfIngredient {
  id: string;
  bar_id: string | null;
  ingredient_role?: string | null;
}

/**
 * Which shelf each ingredient sits on at a venue: its own ingredients, and the
 * shared ones its drinks use. Garnishes are what the drinks only ever finish
 * with; preps are made in house (the prep role); everything else is bought.
 * ponytail: a prep's own lines aren't read here, so a bottle used only inside
 * a prep stays off Bottles. Upgrade: an RPC that walks the venue's recipes.
 */
export function venueShelves(
  venueId: string,
  drinks: { recipes?: ShelfLine[] | null }[],
  ingredients: ShelfIngredient[]
): { preps: string[]; garnishes: string[]; bottles: string[] } {
  const garnish = new Set<string>();
  const inSpec = new Set<string>();
  for (const d of drinks) {
    for (const l of d.recipes ?? []) {
      if (!l.display_ingredient_id) continue;
      (isGarnishLine(l.preparation_notes, l.unit) ? garnish : inSpec).add(l.display_ingredient_id);
    }
  }
  const out = { preps: [] as string[], garnishes: [] as string[], bottles: [] as string[] };
  for (const i of ingredients) {
    const used = garnish.has(i.id) || inSpec.has(i.id);
    if (i.bar_id !== venueId && !used) continue;
    if (garnish.has(i.id) && !inSpec.has(i.id)) out.garnishes.push(i.id);
    else if (i.ingredient_role === 'prep') out.preps.push(i.id);
    else out.bottles.push(i.id);
  }
  return out;
}
