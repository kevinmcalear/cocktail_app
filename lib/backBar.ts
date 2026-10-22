// Plan geometry and the "waiting for a spot" list for the back bar map.
// Zones are stored as fractions of the plan (0..1), so the phone card, the web
// map and printed labels draw the same plan at any size.

import type { BarZoneKind } from '@/types/backBar';

import { barSection } from './barSections';
import { friendlyWhen } from './searchCaptions';

/**
 * Every plan is drawn 2:1. ponytail: one shape for every venue; a per-venue
 * aspect (a column on bars) if a long, thin bar ever needs it.
 */
export const PLAN_ASPECT = 2;
/** One arrow press moves or resizes a zone by this much of the plan. */
export const PLAN_STEP = 0.02;
const MIN_SIZE = 0.04;
/** Held back from the far edges so x + w stays <= 1 after float4 rounding in the database. */
const EDGE = 0.001;

export interface PlanRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placeable {
  plan_x: number | null;
  plan_y: number | null;
  plan_w: number | null;
  plan_h: number | null;
}

/** A zone's rectangle on the plan, or null if it hasn't been drawn yet. */
export function zoneRect(z: Placeable): PlanRect | null {
  if (z.plan_x == null || z.plan_y == null || z.plan_w == null || z.plan_h == null) return null;
  return { x: z.plan_x, y: z.plan_y, w: z.plan_w, h: z.plan_h };
}

export function rectColumns(r: PlanRect) {
  return { plan_x: r.x, plan_y: r.y, plan_w: r.w, plan_h: r.h };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const milli = (v: number) => Math.round(v * 1000) / 1000;

/** Keeps a rectangle whole and inside the plan, as the database requires. */
export function clampRect(r: PlanRect): PlanRect {
  const w = milli(clamp(r.w, MIN_SIZE, 1 - EDGE));
  const h = milli(clamp(r.h, MIN_SIZE, 1 - EDGE));
  const x = milli(clamp(r.x, 0, 1 - EDGE - w));
  const y = milli(clamp(r.y, 0, 1 - EDGE - h));
  return { x, y, w, h };
}

export function nudgeRect(r: PlanRect, dx: number, dy: number): PlanRect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy });
}

export function resizeRect(r: PlanRect, dw: number, dh: number): PlanRect {
  return clampRect({ ...r, w: r.w + dw, h: r.h + dh });
}

/** Centres a zone on a point someone tapped on the plan. */
export function moveRectTo(r: PlanRect, px: number, py: number): PlanRect {
  return clampRect({ ...r, x: px - r.w / 2, y: py - r.h / 2 });
}

export function overlaps(a: PlanRect, b: PlanRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Where a new zone goes: the first free spot, reading the plan like a page. */
export function freeSpot(taken: PlanRect[], w = 0.2, h = 0.14): PlanRect {
  for (let y = 0.02; y + h <= 1 - EDGE; y += 0.04) {
    for (let x = 0.02; x + w <= 1 - EDGE; x += 0.02) {
      const r = clampRect({ x, y, w, h });
      if (!taken.some((t) => overlaps(r, t))) return r;
    }
  }
  return clampRect({ x: 0, y: 0, w, h });
}

/** "Fridge 2 · top shelf · left" */
export function locationLine(zoneName: string | null | undefined, shelf: string | null | undefined): string {
  const s = shelf?.trim();
  const parts = [zoneName?.trim(), s ? s.charAt(0).toLowerCase() + s.slice(1) : null].filter(Boolean);
  return parts.join(' · ');
}

/** "2 L", "3 bottles"; null when there's no par. */
export function formatPar(amount: number | string | null | undefined, unit: string | null | undefined): string | null {
  if (amount == null || !unit) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const v = Number(n.toFixed(2));
  // A count reads singular at one: "1 bottle", not "1 bottles". Short units (L, ml, kg) stay.
  return `${v} ${v === 1 && unit.length > 3 && unit.endsWith('s') ? unit.slice(0, -1) : unit}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 zones · 84 items placed · 3 waiting for a spot" */
export function summaryLine(zoneCount: number, locations: { item_id: string }[], waitingCount: number): string {
  const placed = new Set(locations.map((l) => l.item_id)).size;
  const parts = [plural(zoneCount, 'zone', 'zones'), `${plural(placed, 'item', 'items')} placed`];
  if (waitingCount) parts.push(`${waitingCount} waiting for a spot`);
  return parts.join(' · ');
}

export interface NamedItem {
  id: string;
  name: string;
}

/** An ingredient the drinks use, and which of them pour it (down through house-made ones). */
export interface UsedItem extends NamedItem {
  drinkIds: string[];
}

/**
 * Every ingredient the drinks use, walking down through house-made ones (a
 * syrup's honey and ginger need a spot too). Drink by drink in menu order,
 * each ingredient once, and never the drinks themselves.
 */
export function ingredientsUsed(drinkIds: string[], recipeOf: Record<string, NamedItem[]>): UsedItem[] {
  const drinks = new Set(drinkIds);
  const used = new Map<string, UsedItem>();
  for (const drink of drinkIds) {
    const seen = new Set([drink]);
    let frontier = [drink];
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const ing of recipeOf[id] ?? []) {
          if (seen.has(ing.id) || drinks.has(ing.id)) continue;
          seen.add(ing.id);
          const item = used.get(ing.id) ?? { ...ing, drinkIds: [] };
          item.drinkIds.push(drink);
          used.set(ing.id, item);
          next.push(ing.id);
        }
      }
      frontier = next;
    }
  }
  return [...used.values()];
}

/** A bottle on the venue's stock list (types/backBar BarStock), as the waiting list reads it. */
export interface StockedItem extends NamedItem {
  added_from: string | null;
  added_at: string;
}

/** Waiting for a spot: what it is, and why it's waiting ("Added from Ash Garden, just now", "Poured in Low Tide"). */
export interface WaitingItem extends NamedItem {
  line: string;
}

/**
 * The bottles the venue stocks and the ingredients its menus use, with no
 * place yet. Stocked ones first, newest first; then the menus', in menu order.
 */
export function waitingForSpot(
  used: UsedItem[],
  locations: { item_id: string }[],
  stock: StockedItem[] = [],
  drinkName: (id: string) => string | undefined = () => undefined,
  now = Date.now()
): WaitingItem[] {
  const placed = new Set(locations.map((l) => l.item_id));
  const out: WaitingItem[] = [];
  const newest = [...stock].sort((a, b) => b.added_at.localeCompare(a.added_at));
  for (const s of newest) {
    if (placed.has(s.id)) continue;
    placed.add(s.id);
    const when = friendlyWhen(new Date(s.added_at).getTime(), now);
    out.push({ id: s.id, name: s.name, line: s.added_from ? `Added from ${s.added_from}, ${when}` : `Added ${when}` });
  }
  for (const u of used) {
    if (placed.has(u.id)) continue;
    const one = u.drinkIds.length === 1 ? drinkName(u.drinkIds[0]) : undefined;
    out.push({ id: u.id, name: u.name, line: one ? `Poured in ${one}` : `Poured in ${plural(u.drinkIds.length, 'drink', 'drinks')}` });
  }
  return out;
}

interface LineIngredient {
  name: string | null;
  bar_id?: string | null;
  ingredient_role?: string | null;
}

/**
 * Whether a spec line's ingredient can go on a back bar or a shelf: bottles
 * (spirits, liqueurs, vermouth, beer, wine, bitters, syrups). Not juice,
 * garnish, water or a mixer, not lab powders, and not the bar's own house
 * preps (a drink's own batch). The catalogue's preps (agave syrup,
 * grenadine) are bought as often as made, so they count. `generic` is its
 * kind's name, if any.
 */
export function isShelfBottle(item: LineIngredient, generic: string | null = null): boolean {
  if (item.bar_id && item.ingredient_role !== 'product') return false;
  const section = barSection({ name: item.name ?? '', kind: generic, role: item.ingredient_role });
  return section !== 'fridge' && section !== 'lab';
}

const KIND_WORDS: [RegExp, BarZoneKind][] = [
  [/freez/i, 'freezer'],
  [/fridge|lowboy|cooler/i, 'fridge'],
  [/rail/i, 'speed_rail'],
  [/well|ice/i, 'well'],
  [/garnish/i, 'garnish'],
  [/glass/i, 'glass_rack'],
  [/sink/i, 'sink'],
  [/bar ?top|counter/i, 'bar_top'],
  [/store|cellar|back ?room/i, 'storeroom'],
  [/shelf|shelves/i, 'shelf'],
];

/** A new zone's kind from its name ("Fridge 3" is a fridge), so adding one is a single field. */
export function kindFromName(name: string): BarZoneKind {
  return KIND_WORDS.find(([re]) => re.test(name))?.[1] ?? 'other';
}

/** Reads the par fields: both empty, or a number above zero and a unit, as the database requires. */
export function parsePar(amountText: string, unitText: string): { amount: number | null; unit: string | null; error?: string } {
  const unit = unitText.trim() || null;
  const amount = amountText.trim() ? Number(amountText.trim().replace(',', '.')) : null;
  if (amount !== null && !(amount > 0)) return { amount: null, unit, error: 'Par is a number above zero, like 2.' };
  if ((amount === null) !== (unit === null)) return { amount, unit, error: 'Give par an amount and a unit (2 L, 3 bottles), or leave both empty.' };
  return { amount, unit };
}
