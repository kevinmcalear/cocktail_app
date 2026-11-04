import { kindLabel, spiritsOf, stylesOf } from './drinkStyles';
import type { Show } from './drinksFilters';
import { labelDate, useByDate as keepsUntil } from './makeSteps';
import { plural } from './menus';
import type { BuyLine } from './prep';
import { formatQuantity, toQuantity, type Quantity } from './quantity';
import type { Batch } from './stock';
import { dayMonth } from './dayMonth';

/**
 * The Drinks tab's pure parts (Prod-phone drinks and shelf, Sta-drinks,
 * Sta-capsules): which capsule a view sits under, the On now card's lines,
 * House-made's fridge, Bottles' kinds and counts, the order to export, and
 * home's chips. Checked by lib/drinksTab.check.ts.
 */

/** A capsule at a bar: Drinks, House-made, Bottles. */
export type StaffCapsule = 'drinks' | 'house' | 'bottles';
export const STAFF_CAPSULES: readonly { value: StaffCapsule; label: string }[] = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'house', label: 'House-made' },
  { value: 'bottles', label: 'Bottles' },
];

/** A capsule at home: Drinks, Shelf, Menus. */
export type HomeCapsule = 'drinks' | 'shelf' | 'menus';
export const HOME_CAPSULES: readonly { value: HomeCapsule; label: string }[] = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'menus', label: 'Menus' },
];

/** Home's capsule from the URL (/drinks?tab=shelf), else Drinks. */
export function homeCapsule(param: string | string[] | undefined): HomeCapsule {
  const value = Array.isArray(param) ? param[0] : param;
  return HOME_CAPSULES.find((c) => c.value === value)?.value ?? 'drinks';
}

/** Everything bought rather than made or poured sits under Bottles: garnishes, and Needs a price. */
const BOUGHT: readonly Show[] = ['bottles', 'garnishes', 'needs-price', 'ingredients'];

/** The capsule a view (?show=) sits under. */
export function capsuleOf(show: Show): StaffCapsule {
  if (show === 'preps') return 'house';
  return BOUGHT.includes(show) ? 'bottles' : 'drinks';
}

/** Where a capsule opens. */
export const CAPSULE_SHOW: Record<StaffCapsule, Show> = { drinks: 'all', house: 'preps', bottles: 'bottles' };

/** A capsule's chips: the views (filterGroups) under it, in their groups. */
export function capsuleChips<F extends { value: Show }>(groups: readonly (readonly F[])[], capsule: StaffCapsule): F[][] {
  return groups.map((g) => g.filter((f) => capsuleOf(f.value) === capsule)).filter((g) => g.length > 0);
}

/** The allergens a row tags, as the board writes them: the ones that change how a drink is made or served. Sulphites and the rest stay on the drink page. */
const SERVICE_TAGS: readonly [string, string][] = [
  ['eggs', 'Egg'],
  ['milk', 'Dairy'],
  ['peanuts', 'Nuts'],
  ['tree_nuts', 'Nuts'],
];

/** A drink row's allergen tag ("Egg"), or null. */
export function serviceTag(allergens: readonly string[]): string | null {
  return SERVICE_TAGS.find(([key]) => allergens.includes(key))?.[1] ?? null;
}

/** The On now card's line under the menu's name: "8 drinks · Winter on 1 Dec". */
export function onNowSub(count: number, next: { name: string; startsAt: string | null } | null, locale?: string): string {
  const on = next?.startsAt ? `${next.name} on ${dayMonth(new Date(next.startsAt), { month: 'short' }, locale)}` : null;
  return [plural(count, 'drink'), on].filter(Boolean).join(' · ');
}

/** A low house-made's line under House-made's Low: "200 ml · Jack Rose needs it", "make 1 L · back to par". */
export function lowLine(line: { have: string | null; needed: string; forDrinks: readonly string[] }): string {
  const drink = line.forDrinks.find((d) => d !== 'back to par');
  return `${line.have ? line.have.replace(/^have /, '') : `make ${line.needed}`} · ${drink ? `${drink} needs it` : 'back to par'}`;
}

export interface FridgeRow {
  id: string;
  name: string;
  /** The last batch's day, for its day colour (0 is Sunday). */
  madeDay: number;
  /** "1.2 L · use by Fri 14 Nov", "400 ml · use today", "100 ml · keeps". */
  line: string;
  /** Its last day is today. */
  today: boolean;
  /** Past its use-by: still listed, so someone throws it out. */
  gone: boolean;
  useBy: number | null;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * In the fridge: each house-made's newest batch while it keeps, the soonest
 * to go first (past its use-by at the top, to throw out), then the ones that
 * keep with no date. `keeps`: hours from each card (item_prep).
 */
export function fridgeRows(batches: readonly Batch[], keeps: Readonly<Record<string, number>>, nameOf: (id: string) => string | null, now: Date): FridgeRow[] {
  const newest = new Map<string, Batch>();
  for (const b of batches) {
    const had = newest.get(b.itemId);
    if (!had || Date.parse(b.madeAt) > Date.parse(had.madeAt)) newest.set(b.itemId, b);
  }
  const rows: FridgeRow[] = [];
  for (const b of newest.values()) {
    const name = nameOf(b.itemId);
    if (!name) continue;
    const made = new Date(b.madeAt);
    const by = keepsUntil(made, keeps[b.itemId] ?? null);
    const today = !!by && sameDay(by, now);
    const gone = !!by && !today && by.getTime() < now.getTime();
    const when = !by ? 'keeps' : today ? 'use today' : gone ? `use by ${labelDate(by)}, past it` : `use by ${labelDate(by)}`;
    rows.push({ id: b.itemId, name, madeDay: made.getDay(), line: `${amountText(b.amount, b.unit)} · ${when}`, today, gone, useBy: by?.getTime() ?? null });
  }
  return rows.sort((a, b) => (a.useBy ?? Infinity) - (b.useBy ?? Infinity) || a.name.localeCompare(b.name));
}

/** "1.2 L" for 1200 ml, "400 ml", "2 kg": a batch as the board writes it. */
function amountText(amount: number, unit: string): string {
  const q = toQuantity(amount, unit);
  return q ? formatQuantity(q) : `${amount} ${unit}`.trim();
}

/** A bottle's kind for Bottles' chips and rows, from its name: "Gin", "Amaro & aperitivo". Null when the name doesn't say. */
export function bottleKind(name: string): string | null {
  const id = spiritsOf({ name, ingredients: [name] })[0];
  return id ? kindLabel(id) : null;
}

/** A bottle row's line: "Gin · in 9 drinks", "Amaro & aperitivo · Last Word". */
export function bottleLine(kind: string | null, drinks: readonly string[]): string | null {
  const used = drinks.length === 1 ? drinks[0] : drinks.length ? `in ${plural(drinks.length, 'drink')}` : null;
  return [kind, used].filter(Boolean).join(' · ') || null;
}

/** The count on a bottle row: "2" for bottles, "700 ml" when counted by volume. */
export function countText(q: Quantity | undefined): string | null {
  if (!q) return null;
  return q.kind === 'count' ? String(Math.round(q.value * 10) / 10) : formatQuantity(q);
}

/** Under par: what's on hand is less than par (both in the same kind of unit). Never counted reads as not low: nobody looked. */
export function isLow(have: Quantity | undefined, par: Quantity | undefined): boolean {
  return !!have && !!par && have.kind === par.kind && have.value < par.value;
}

/** To order's line: "5 things from 2 suppliers", "1 thing". */
export function orderSummary(order: readonly { supplier: string; lines: readonly BuyLine[] }[]): string | null {
  const lines = order.reduce((n, g) => n + g.lines.length, 0);
  if (!lines) return null;
  const from = order.filter((g) => g.lines.length).length;
  return from > 1 ? `${plural(lines, 'thing')} from ${from} suppliers` : plural(lines, 'thing');
}

/** The order as text to send a supplier: each supplier, then a line per thing with its packs (or what's needed). */
export function orderText(order: readonly { supplier: string; lines: readonly BuyLine[] }[]): string {
  return order
    .filter((g) => g.lines.length)
    .map((g) => [g.supplier, ...g.lines.map((l) => `${l.name}: ${l.packs ?? l.needed}`)].join('\n'))
    .join('\n\n');
}

/** Home's chips (Prod-phone drinks, home): what you can make, saved, ranked, then two styles. */
export type HomeChip = 'make' | 'saved' | 'ranked' | 'sours' | 'stirred';
export const HOME_CHIPS: readonly { value: HomeChip; label: string }[] = [
  { value: 'make', label: 'Can make' },
  { value: 'saved', label: 'Saved' },
  { value: 'ranked', label: 'Ranked' },
  { value: 'sours', label: 'Sours' },
  { value: 'stirred', label: 'Stirred' },
];

/** A home drink and what's known about it for the chips. */
export interface HomeDrink {
  id: string;
  name: string;
  /** Its ingredient names, in spec order. */
  ingredients: readonly string[];
  /** Its method's name ("Stir"). */
  method: string | null;
}

/** Whether a drink belongs under a style chip: Sours by its build or name (lib/drinkStyles), Stirred by its method. */
export function homeStyle(chip: 'sours' | 'stirred', drink: HomeDrink): boolean {
  if (chip === 'stirred') return /^stir/i.test(drink.method?.trim() ?? '');
  return stylesOf({ name: drink.name, ingredients: drink.ingredients }).includes('sour');
}

type Named = { id: string; name: string };

/**
 * Home Drinks' rows for a chip: Can make is what the shelf makes, then what
 * one bottle more would (the order the shelf sorts them in); Saved and
 * Ranked A to Z; Sours and Stirred every drink you keep of that style, A to
 * Z. A drink shows once. `factsOf`: its ingredients and method, once loaded.
 */
export function homeRows(chip: HomeChip, src: { make: readonly Named[]; saved: readonly Named[]; ranked: readonly Named[] }, factsOf: (id: string) => Omit<HomeDrink, 'id' | 'name'> | undefined): Named[] {
  const once = (list: readonly Named[]) => [...new Map(list.map((d) => [d.id, d])).values()];
  const az = (list: Named[]) => list.sort((a, b) => a.name.localeCompare(b.name));
  if (chip === 'make') return once(src.make);
  if (chip === 'saved' || chip === 'ranked') return az(once(src[chip]));
  return az(
    once([...src.make, ...src.saved, ...src.ranked]).filter((d) => {
      const facts = factsOf(d.id);
      return !!facts && homeStyle(chip, { ...d, ...facts });
    })
  );
}
