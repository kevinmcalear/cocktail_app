/**
 * Batching a drink for prep: scale the spec by N serves, work out what goes
 * in the bottle and what's added fresh or to order, how much water a stirred
 * drink needs, and how many bottles to fill. Pure; the batch screen renders it.
 *
 * The rules follow the Back Bar brief's spec glass:
 * - stirred drinks get 20% filtered water, so they pour straight from the freezer;
 * - shaken drinks batch only the spirits and syrups: citrus is juiced fresh on
 *   the day, and egg or cream goes in to order;
 * - built drinks never batch the bubbles.
 */

import type { SpecLine } from '@/lib/spec';

export type BatchMethod = 'stirred' | 'shaken' | 'built' | 'unknown';
export type VolumeUnit = 'ml' | 'oz';
export type BottleSize = 750 | 1000;
/** Why a line stays out of the bottle. */
export type LeaveOut = 'citrus' | 'dairy' | 'bubbles' | 'garnish';

export interface BatchLine {
  key: string;
  ingredient: string;
  /** Scaled and formatted: "1.44 L", "3 dashes", "24 twists", or "" with no amount. */
  amount: string;
  /** A second reading, e.g. "24 dashes" under a dash line shown in ml. */
  sub: string | null;
  /** Null when it goes in the bottle. */
  leaveOut: LeaveOut | null;
  /** Scaled volume in ml; null for counts, weights and missing amounts. */
  ml: number | null;
}

export interface Batch {
  serves: number;
  method: BatchMethod;
  lines: BatchLine[];
  /** Stirred only: filtered water for dilution. */
  water: { ml: number; amount: string } | null;
  totalMl: number;
  total: string;
  bottles: number;
  bottleSize: BottleSize;
  /** What to do, in plain words. */
  note: string;
}

export const DILUTION = 0.2;
export const MIN_SERVES = 1;
export const MAX_SERVES = 60;
/** Up to this many dashes in the batch, count them; past it, measure. */
const DASH_LIMIT = 12;
const ML_PER_OZ = 29.5735;

// ponytail: the volume table from lib/quantity.ts (step4a/prep), copied rather
// than shared until that branch lands. Bar units only; dashes are approximate.
const VOLUME_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, oz: 29.57, 'fl oz': 29.57,
  dash: 0.8, dashes: 0.8, drop: 0.05, drops: 0.05,
  bsp: 5, barspoon: 5, tsp: 5, tbsp: 15,
};
const DASH_UNITS = new Set(['dash', 'dashes', 'drop', 'drops']);
const GARNISH_UNITS = new Set(['each', 'pinch', 'sprig', 'leaf', 'peel', 'twist', 'wheel', 'slice', 'cube', 'wedge']);
const PLURAL: Record<string, string> = { dash: 'dashes', pinch: 'pinches', leaf: 'leaves', each: 'each' };

// ponytail: name matching, so it's English-only and misses house names like
// "Sour mix". Upgrade path: a batch flag on the ingredient.
const BUBBLES = /soda|tonic|sparkling|champagne|prosecco|cava|cr[eé]mant|ginger (beer|ale)|cola|seltzer|lemonade|\bbeer\b|cider|fizz/i;
const CITRUS = /juice|\b(lemon|lime|grapefruit|yuzu|citrus)\b/i;
const NOT_CITRUS = /cordial|syrup|liqueur|bitters|sherbet|oleo|cello|zest|peel|twist|wheel|wedge|acid/i;
const DAIRY = /\begg\b|egg white|yolk|aquafaba|\b(heavy|double|single|whipping) cream\b|^cream$|^milk$|whole milk/i;

/** From the drink's method names ("Shake", "Stir", "shake and top", "Build"). */
export function classifyMethod(names: readonly string[]): BatchMethod {
  const all = names.join(' ').toLowerCase();
  if (/shak/.test(all)) return 'shaken';
  if (/stir/.test(all)) return 'stirred';
  if (/buil/.test(all)) return 'built';
  return 'unknown';
}

function leaveOutFor(name: string, unit: string): LeaveOut | null {
  if (GARNISH_UNITS.has(unit)) return 'garnish';
  if (unit === 'top' || BUBBLES.test(name)) return 'bubbles';
  if (DAIRY.test(name)) return 'dairy';
  if (CITRUS.test(name) && !NOT_CITRUS.test(name)) return 'citrus';
  return null;
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** "1.44 L", "364 ml", "22.5 ml", "4.8 ml"; or "2 oz", "0.75 oz", "12.2 oz". */
export function formatVolume(ml: number, unit: VolumeUnit): string {
  if (unit === 'oz') {
    const oz = ml / ML_PER_OZ;
    if (oz >= 10) return `${trim(oz, 1)} oz`;
    if (oz < 0.25) return `${trim(oz, 2)} oz`;
    return `${Math.round(oz * 4) / 4} oz`;
  }
  if (ml >= 1000) return `${trim(ml / 1000, 2)} L`;
  if (ml < 10) return `${trim(ml, 1)} ml`;
  return `${Math.round(ml * 2) / 2} ml`;
}

function formatCount(n: number, unit: string): string {
  const v = trim(n, 1);
  return `${v} ${n === 1 ? unit : (PLURAL[unit] ?? (unit.endsWith('s') ? unit : `${unit}s`))}`;
}

/** "A", "A and B", "A, B and C". */
function list(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function scaleLine(line: SpecLine, serves: number, unit: VolumeUnit): BatchLine {
  const ingredient = line.ingredient ?? 'Hidden ingredient';
  const u = (line.unit ?? '').toLowerCase();
  const out = leaveOutFor(ingredient, u);
  const base = { key: line.key, ingredient, leaveOut: out };
  if (line.value === null) return { ...base, amount: '', sub: null, ml: null };
  const n = line.value * serves;
  const perMl = VOLUME_ML[u];
  if (perMl === undefined) return { ...base, amount: formatCount(n, u || 'each'), sub: null, ml: null };
  const ml = n * perMl;
  if (DASH_UNITS.has(u)) {
    const counted = formatCount(n, u.startsWith('drop') ? 'drop' : 'dash');
    return n <= DASH_LIMIT ? { ...base, amount: counted, sub: null, ml } : { ...base, amount: formatVolume(ml, unit), sub: counted, ml };
  }
  return { ...base, amount: formatVolume(ml, unit), sub: null, ml };
}

function noteFor(method: BatchMethod, lines: BatchLine[], water: string | null): string {
  const bottled = lines.filter((l) => !l.leaveOut && l.ml !== null).map((l) => l.ingredient);
  const has = (why: LeaveOut) => lines.some((l) => l.leaveOut === why);
  const bubbles = lines.filter((l) => l.leaveOut === 'bubbles').map((l) => l.ingredient);
  const fresh = has('citrus') ? ' Juice the citrus fresh on the day.' : '';
  const dairy = has('dairy') ? ' Add the egg or cream to order.' : '';
  const top = bubbles.length ? ` Top with ${list(bubbles)} to order; never batch the bubbles.` : '';
  const only = bottled.length ? `Batch the ${list(bottled)} only.` : 'Nothing here goes in a bottle.';
  switch (method) {
    case 'stirred':
      return `Add ${water} of filtered water (20% dilution), bottle it, and pour straight from the freezer.${fresh}${dairy}${top}`;
    case 'shaken':
      return `${only}${fresh}${dairy} Shake each serve to order with ice.${top}`;
    case 'built':
      return `${only}${fresh}${dairy}${top || ' Build each serve over ice.'}`;
    default:
      return `Scaled straight, with no water added. Only stirred drinks get water in the bottle; set the drink's method to be sure.${fresh}${dairy}${top}`;
  }
}

/** Scale a spec by `serves` and work out the bottle. */
export function buildBatch(
  spec: SpecLine[],
  methodNames: readonly string[],
  serves: number,
  opts: { unit?: VolumeUnit; bottleSize?: BottleSize } = {}
): Batch {
  const unit = opts.unit ?? 'ml';
  const bottleSize = opts.bottleSize ?? 750;
  const n = clampServes(serves);
  const method = classifyMethod(methodNames);
  const lines = spec.map((l) => scaleLine(l, n, unit));
  const bottledMl = lines.reduce((sum, l) => sum + (!l.leaveOut && l.ml !== null ? l.ml : 0), 0);
  const waterMl = method === 'stirred' ? bottledMl * DILUTION : 0;
  const water = method === 'stirred' ? { ml: waterMl, amount: formatVolume(waterMl, unit) } : null;
  const totalMl = bottledMl + waterMl;
  return {
    serves: n,
    method,
    lines,
    water,
    totalMl,
    total: formatVolume(totalMl, unit),
    bottles: totalMl > 0 ? Math.ceil(totalMl / bottleSize) : 0,
    bottleSize,
    note: noteFor(method, lines, water?.amount ?? null),
  };
}

/** Whole serves between MIN_SERVES and MAX_SERVES; anything unreadable is 1. */
export function clampServes(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVES;
  return Math.min(MAX_SERVES, Math.max(MIN_SERVES, Math.round(value)));
}

export const LEAVE_OUT_LABEL: Record<LeaveOut, string> = {
  citrus: 'Fresh daily',
  dairy: 'To order',
  bubbles: 'To order',
  garnish: 'Per serve',
};
