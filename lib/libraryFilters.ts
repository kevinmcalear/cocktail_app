import type { ItemCategory } from '@/lib/itemRoutes';
import { groupMenus } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

/** Library's filters, as they read in the URL: /library?show=staff (Classics; the old Staff list's value, kept so old links work). */
export type Show =
  | 'all' | 'on-menu' | 'staff' | 'past' | 'rnd'
  | 'batched' | 'preps' | 'garnishes' | 'bottles'
  | 'cocktails' | 'ingredients' | 'beer' | 'wine' | 'needs-price'
  | 'ready' | 'needs';

/**
 * Which drinks: only at a venue. Classics is the ranked list that used to be
 * called Staff list (?show=staff), Old drinks what was Past (?show=past).
 * R&D is one of the extras (EXTRA_FILTERS).
 */
export const LIST_FILTERS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'on-menu', label: 'On menu' },
  { value: 'staff', label: 'Classics' },
  { value: 'past', label: 'Old drinks' },
  { value: 'rnd', label: 'R&D' },
];

/**
 * A venue's spec book, shelved the way bar teams file it: drinks served from a
 * batch, what the bar makes, how drinks are finished, and what it buys. Only at
 * a venue, where they replace the one Ingredients filter.
 */
export const SHELF_FILTERS: { value: Show; label: string }[] = [
  { value: 'batched', label: 'Batched' },
  { value: 'preps', label: 'Made in-house' },
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

/** The kit check (Kit and ice, step 11): drinks the venue can make with its Kit, and the rest. Only at a venue. */
export const KIT_FILTERS: { value: Show; label: string }[] = [
  { value: 'ready', label: 'Ready here' },
  { value: 'needs', label: 'Needs something' },
];

/** "All" is the drinks: cocktails, beer and wine. Ingredients have their own filter. */
export const DRINK_CATEGORIES: readonly ItemCategory[] = ['Cocktail', 'Beer', 'Wine'];

const SHOWS = new Set<string>([...LIST_FILTERS, ...SHELF_FILTERS, ...TYPE_FILTERS, NEEDS_PRICE, ...KIT_FILTERS].map((f) => f.value));

/**
 * The filters past All, On menu, Classics, Old drinks, Beer and Wine: a venue
 * shows them once it switches on More library filters (the libraryExtras
 * feature, lib/venueFeatures.ts).
 */
export const EXTRA_FILTERS: ReadonlySet<Show> = new Set<Show>(['rnd', 'batched', 'preps', 'garnishes', 'bottles', 'cocktails', 'ingredients', 'needs-price']);

/**
 * The filter in the URL, or All. The old Off menu screen arrives as ?show=staff.
 * At a venue without the extras, theirs fall back to All.
 */
export function parseShow(param: string | string[] | undefined, atVenue: boolean, extras = true): Show {
  const value = Array.isArray(param) ? param[0] : param;
  const show = value && SHOWS.has(value) ? (value as Show) : 'all';
  if (atVenue && !extras && EXTRA_FILTERS.has(show)) return 'all';
  // Without a venue there are no menus, staff list or shelves.
  if (!atVenue && (LIST_FILTERS.some((f) => f.value === show) || show === 'batched')) return 'cocktails';
  if (!atVenue && SHELF_FILTERS.some((f) => f.value === show)) return 'ingredients';
  if (!atVenue && KIT_FILTERS.some((f) => f.value === show)) return 'cocktails';
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
 * one picked), the drinks that were on a past menu and aren't on now, and
 * R&D: drinks on an R&D collection and on no menu (or the picked collection's).
 */
export function menuDrinks(
  menus: MenuSummary[],
  now: number,
  picked: string | null
): { onMenus: OnMenu[]; on: string[]; onNow: string[]; past: string[]; rndMenus: OnMenu[]; rnd: string[] } {
  const groups = groupMenus(menus, now);
  const listed = (ms: MenuSummary[]) => ms.map((m) => ({ id: m.id, name: m.name, itemIds: [...new Set(m.itemIds)] }));
  const onMenus = listed(groups.on);
  const onNow = new Set(onMenus.flatMap((m) => m.itemIds));
  const pick = onMenus.find((m) => m.id === picked);
  const on = pick ? pick.itemIds : [...onNow];
  const past = [...new Set(groups.previous.flatMap((m) => m.itemIds))].filter((id) => !onNow.has(id));
  const rndMenus = listed(groups.rnd);
  const onAMenu = new Set([...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous].flatMap((m) => m.itemIds));
  const rndPick = rndMenus.find((m) => m.id === picked);
  const rnd = rndPick ? rndPick.itemIds : [...new Set(rndMenus.flatMap((m) => m.itemIds))].filter((id) => !onAMenu.has(id));
  return { onMenus, on, onNow: [...onNow], past, rndMenus, rnd };
}

export type MenuState = 'On menu' | 'Old drink' | 'Off menu';

/** Where a drink stands with the menus: on one now, on one before (an old drink, as the Old drinks filter says), or never. */
export function menuState(itemId: string, onNow: ReadonlySet<string>, past: ReadonlySet<string>): MenuState {
  if (onNow.has(itemId)) return 'On menu';
  return past.has(itemId) ? 'Old drink' : 'Off menu';
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

/**
 * The groups of the chip row, in order (desktop draws a thin line between
 * them). A venue starts with All, On menu, Classics, Old drinks (the phone's
 * order, decided 24 Oct 2026), then Beer and
 * Wine; `extras` adds R&D, the shelves, Cocktails and Needs a price.
 */
export function filterGroups(atVenue: boolean, canCost: boolean, extras = true): { value: Show; label: string }[][] {
  const types = atVenue ? TYPE_FILTERS.filter((f) => f.value !== 'ingredients') : TYPE_FILTERS;
  const groups = atVenue ? [LIST_FILTERS, SHELF_FILTERS, KIT_FILTERS] : [];
  const all = [...groups, [...types, ...(canCost ? [NEEDS_PRICE] : [])]];
  if (!atVenue || extras) return all;
  return all.map((g) => g.filter((f) => !EXTRA_FILTERS.has(f.value))).filter((g) => g.length);
}

/** The four out front on a phone, in this order (lib-filters-proposal, decided 22 Oct 2026). */
const FRONT: Show[] = ['all', 'on-menu', 'staff', 'preps'];
/** The rest, in the filter button's menu. */
const MORE: { title: string; values: Show[] }[] = [
  { title: 'Drinks', values: ['past', 'rnd', 'batched'] },
  { title: 'Shelves', values: ['garnishes', 'bottles'] },
  { title: 'Kind', values: ['cocktails', 'ingredients', 'beer', 'wine'] },
  { title: 'Costs', values: ['needs-price'] },
  { title: 'Kit', values: ['ready', 'needs'] },
];

/**
 * A phone's chip row: All, On menu, Classics and Preps out front (those the
 * venue has), every other view in the filter button's menu by section.
 * Without a venue there's no All, so each type stays out front and there's no menu.
 */
export function splitFilters(groups: { value: Show; label: string }[][]) {
  const all = groups.flat();
  const pick = (values: Show[]) => values.flatMap((v) => all.filter((f) => f.value === v));
  const front = pick(FRONT);
  if (!front.some((f) => f.value === 'all')) return { front: all, more: [] };
  return { front, more: MORE.map((s) => ({ title: s.title, filters: pick(s.values) })).filter((s) => s.filters.length) };
}

/** "Stirred · Coupe", "Stirred · Martini · Martini flight", "Beer · Pint": a tile's second line. */
export function tileLine(...parts: (string | null | undefined)[]): string | null {
  const shown = parts.filter((p): p is string => !!p && !!p.trim());
  return shown.length ? shown.join(' · ') : null;
}

const METHOD_WORDS: Record<string, string> = { stir: 'Stirred', shake: 'Shaken', build: 'Built', blend: 'Blended', swizzle: 'Swizzled', throw: 'Thrown', roll: 'Rolled', whip: 'Whipped', dry: 'Dry shaken' };

/** "Stirred" for the method Stir: how a tile says how it's made. Other names stay as they are. */
export function methodWord(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/\s+shake$/, '');
  return METHOD_WORDS[key] ?? name;
}

/** What a prep is, by what was done to it: Preps' second chip row (Spec Book Shelves' "filter by action"). */
export type PrepGroup = 'Syrup' | 'Cordial' | 'Infusion' | 'Clarified' | 'Fat-washed' | 'Shrub';

export const PREP_GROUPS: { value: string; label: string; group: PrepGroup }[] = [
  { value: 'syrups', label: 'Syrups', group: 'Syrup' },
  { value: 'cordials', label: 'Cordials', group: 'Cordial' },
  { value: 'infusions', label: 'Infusions', group: 'Infusion' },
  { value: 'clarified', label: 'Clarified', group: 'Clarified' },
  { value: 'fat-washed', label: 'Fat-washed', group: 'Fat-washed' },
  { value: 'shrubs', label: 'Shrubs', group: 'Shrub' },
];

/**
 * A prep's group. Cordial and Shrub aren't prep actions (lib/scale.ts
 * PREP_ACTIONS), so the name decides those; clarifying and fat-washing are
 * what was done whatever it's called; then infusions and syrups, by action or name.
 */
export function prepGroup(name: string, actions: readonly string[] = []): PrepGroup | null {
  const has = (a: string) => actions.includes(a);
  if (/\bshrub\b/i.test(name)) return 'Shrub';
  if (/\bcordial\b/i.test(name)) return 'Cordial';
  if (has('Clarify') || has('Milk wash') || /\bclarified\b|\bmilk[- ]?washed\b/i.test(name)) return 'Clarified';
  if (has('Fat wash') || /\bfat[- ]?washed\b|\bbrown[- ]butter\b/i.test(name)) return 'Fat-washed';
  if (has('Infuse') || has('Tincture') || /\binfus(ed|ion)\b|\btincture\b/i.test(name)) return 'Infusion';
  if (has('Syrup') || /\bsyrup\b|\bgomme\b|\boleo\b/i.test(name)) return 'Syrup';
  return null;
}

/** "1 L", "750 ml", "2 kg": a prep's yield as the board writes it. */
export function yieldText(amount: number | null | undefined, unit: string | null | undefined): string | null {
  if (!amount || amount <= 0) return null;
  const u = (unit ?? '').trim();
  if (u.toLowerCase() === 'ml' && amount >= 1000) return `${Number((amount / 1000).toFixed(2))} L`;
  if (u.toLowerCase() === 'g' && amount >= 1000) return `${Number((amount / 1000).toFixed(2))} kg`;
  return u ? `${Number(amount.toFixed(2))} ${u}` : String(Number(amount.toFixed(2)));
}
