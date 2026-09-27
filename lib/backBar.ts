// Plan geometry and the "waiting for a spot" list for the back bar map.
// Zones are stored as fractions of the plan (0..1), so the phone card, the web
// map and printed labels draw the same plan at any size.

import type { BarZoneKind } from '@/types/backBar';

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
  return `${Number(n.toFixed(2))} ${unit}`;
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

/**
 * Every ingredient the drinks use, walking down through house-made ones (a
 * syrup's honey and ginger need a spot too). In spec order, each once, and
 * never the drinks themselves.
 */
export function ingredientsUsed(drinkIds: string[], recipeOf: Record<string, NamedItem[]>): NamedItem[] {
  const seen = new Set(drinkIds);
  const out: NamedItem[] = [];
  let frontier = drinkIds;
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const ing of recipeOf[id] ?? []) {
        if (seen.has(ing.id)) continue;
        seen.add(ing.id);
        out.push(ing);
        next.push(ing.id);
      }
    }
    frontier = next;
  }
  return out;
}

/** The used items with no place at the venue yet. */
export function waitingForSpot(used: NamedItem[], locations: { item_id: string }[]): NamedItem[] {
  const placed = new Set(locations.map((l) => l.item_id));
  return used.filter((i) => !placed.has(i.id));
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
