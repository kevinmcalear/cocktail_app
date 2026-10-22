// Plan geometry and the "waiting for a spot" list for the back bar map.
// Zones are stored as fractions of the plan (0..1), so the phone card, the web
// map and printed labels draw the same plan at any size.

import type { BarZoneKind } from '@/types/backBar';

import { barSection } from './barSections';
import { agoLabel } from './team';

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

/** "12 zones · 84 items placed · 4 waiting" */
export function summaryLine(zoneCount: number, locations: { item_id: string }[], waitingCount: number): string {
  const placed = new Set(locations.map((l) => l.item_id)).size;
  const parts = [plural(zoneCount, 'zone', 'zones'), `${plural(placed, 'item', 'items')} placed`];
  if (waitingCount) parts.push(`${waitingCount} waiting`);
  return parts.join(' · ');
}

export interface NamedItem {
  id: string;
  name: string;
}

/** An ingredient the menus use, with the drinks that pour it (through house-made ones too). */
export interface UsedItem extends NamedItem {
  drinks: string[];
}

/**
 * Every ingredient the drinks use, walking down through house-made ones (a
 * syrup's honey and ginger need a spot too). In spec order, each once, and
 * never the drinks themselves. Each says which of the drinks pour it.
 */
export function ingredientsUsed(drinkIds: string[], recipeOf: Record<string, NamedItem[]>): UsedItem[] {
  const roots = new Set(drinkIds);
  const seen = new Set(drinkIds);
  const out: UsedItem[] = [];
  let frontier = drinkIds;
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const ing of recipeOf[id] ?? []) {
        if (seen.has(ing.id)) continue;
        seen.add(ing.id);
        out.push({ ...ing, drinks: [] });
        next.push(ing.id);
      }
    }
    frontier = next;
  }
  // Which drinks reach each one, each drink walked on its own.
  const byId = new Map(out.map((i) => [i.id, i]));
  for (const drink of drinkIds) {
    const reached = new Set<string>();
    const stack = [drink];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      for (const ing of recipeOf[id] ?? []) {
        if (reached.has(ing.id) || roots.has(ing.id)) continue;
        reached.add(ing.id);
        stack.push(ing.id);
      }
    }
    for (const id of reached) byId.get(id)?.drinks.push(drink);
  }
  return out;
}

/** A row on the stock list, as the waiting list reads it. */
export interface StockedItem {
  item_id: string;
  source: string;
  from_name: string | null;
  added_at: string;
  item: NamedItem | null;
}

/** Waiting for a spot, with the line under its name. */
export interface WaitingItem extends NamedItem {
  detail: string;
}

/** "Added from Ash Garden, just now", "Added in setup, yesterday". */
export function addedLine(row: Pick<StockedItem, 'source' | 'from_name' | 'added_at'>, now: number): string {
  const ago = now - new Date(row.added_at).getTime();
  const when = ago < 60 * 60 * 1000 ? 'just now' : (agoLabel(row.added_at, now) ?? 'just now');
  const from = row.from_name?.trim();
  if (row.source === 'drink' && from) return `Added from ${from}, ${when}`;
  if (row.source === 'setup') return `Added in setup, ${when}`;
  return `Added ${when}`;
}

/** "Poured in Low Tide", "Poured in 3 drinks". */
export function pouredLine(drinks: string[], nameOf: (id: string) => string | undefined): string {
  const only = drinks.length === 1 ? nameOf(drinks[0]) : undefined;
  return only ? `Poured in ${only}` : `Poured in ${plural(drinks.length, 'drink', 'drinks')}`;
}

/**
 * What has no place at the venue yet: bottles put on the back bar (newest
 * first), then what the menus pour. Each once.
 */
export function waitingForSpot(
  stock: StockedItem[],
  used: UsedItem[],
  locations: { item_id: string }[],
  nameOf: (drinkId: string) => string | undefined,
  now: number
): WaitingItem[] {
  const listed = new Set(locations.map((l) => l.item_id));
  const out: WaitingItem[] = [];
  for (const row of stock) {
    if (!row.item || listed.has(row.item_id)) continue;
    listed.add(row.item_id);
    out.push({ id: row.item_id, name: row.item.name, detail: addedLine(row, now) });
  }
  for (const i of used) {
    if (listed.has(i.id)) continue;
    listed.add(i.id);
    out.push({ id: i.id, name: i.name, detail: pouredLine(i.drinks, nameOf) });
  }
  return out;
}

/**
 * Whether a line's ingredient is a bottle a bar stocks: spirits, liqueurs,
 * vermouth, beer, wine, bitters and bought syrups. Not juice, garnish,
 * water, mixers or something the bar makes itself. Read from the name, as
 * My Bar sorts its shelves: the catalog files syrups as preps (one recipe
 * among many), but a bar can buy them by the bottle.
 */
export function isStockable(item: { name: string; kind?: string | null; role?: string | null; ownPrep?: boolean }): boolean {
  if (item.ownPrep) return false;
  const section = barSection({ name: item.name, kind: item.kind, role: item.role === 'product' ? 'product' : null });
  return section === 'bottles' || section === 'preps';
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
