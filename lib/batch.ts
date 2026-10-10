/**
 * Batching a drink: scale the spec by N serves (or to fill a bottle, or to use
 * up what's on the shelf), work out what goes in the bottle and what's added
 * at the station, how much water a stirred drink needs, how strong the bottle
 * is and whether it stays liquid in a freezer. Pure; the drink page's Batch
 * sheet renders it.
 *
 * Dilution is always water as a percent of what's in the bottle before the
 * water goes in (the undiluted mix).
 *
 * The rules follow the Back Bar brief's spec glass:
 * - stirred drinks get 20% filtered water, so they pour straight from the freezer;
 * - shaken drinks batch only the spirits and syrups: citrus is juiced fresh on
 *   the day, and egg or cream goes in to order;
 * - built drinks never batch the bubbles.
 */

import { VOLUME_ML } from '@/lib/quantity';
import type { SpecLine } from '@/lib/spec';

export type BatchMethod = 'stirred' | 'shaken' | 'built' | 'unknown';
export type VolumeUnit = 'ml' | 'oz';
export type BottleSize = 700 | 750 | 1000;
export const BOTTLE_SIZES: readonly BottleSize[] = [700, 750, 1000];
/** Why a line stays out of the bottle. `station`: the bar said so, for no reason the name gives away. */
export type LeaveOut = 'citrus' | 'dairy' | 'bubbles' | 'garnish' | 'station';

export interface BatchLine {
  key: string;
  ingredient: string;
  /** Scaled and formatted: "1.44 L", "975 g", "3 dashes", "24 twists", or "" with no amount. */
  amount: string;
  /** A second reading, e.g. "24 dashes" under a dash line shown in ml. */
  sub: string | null;
  /** Null when it goes in the bottle. */
  leaveOut: LeaveOut | null;
  /** Scaled volume in ml (weights by density); null for counts and missing amounts. */
  ml: number | null;
  /** The same line for one serve: "22.5 ml", "1 twist", or "". */
  perServe: string;
  /** The ingredient's ABV, for the bottle's strength; null when not on file. */
  abv: number | null;
}

export interface Batch {
  serves: number;
  method: BatchMethod;
  lines: BatchLine[];
  /** Filtered water for dilution, when the bottle is poured straight (stirred, bottled, carbonated or on draught). */
  water: { ml: number; amount: string; pct: number } | null;
  totalMl: number;
  total: string;
  bottles: number;
  bottleSize: BottleSize;
  /** What to pour from the bottle for each serve, water included. */
  pourMl: number;
  pour: string;
  /** Percent ABV of what's in the bottle, water included; null when no bottled line has an ABV on file. */
  abv: number | null;
  /** What to do, in plain words. */
  note: string;
}

/** The default when the caller gives no dilution: a stirred drink's 20%. */
export const DILUTION = 0.2;
export const MIN_SERVES = 1;
export const MAX_SERVES = 60;
/** Up to this many dashes in the batch, count them; past it, measure. */
const DASH_LIMIT = 12;
const ML_PER_OZ = 29.5735;

const GRAMS: Record<string, number> = { g: 1, kg: 1000 };
const DASH_UNITS = new Set(['dash', 'dashes', 'drop', 'drops']);
// A finish (a spray, a rinse, a float) is counted and done at the station too, never bottled.
const GARNISH_UNITS = new Set(['each', 'pinch', 'sprig', 'leaf', 'peel', 'twist', 'wheel', 'slice', 'cube', 'wedge', 'rim', 'spray', 'rinse', 'float']);
// Drops of an oil go on top of each serve; saline and tincture drops go in the bottle.
const OIL = /\boil\b/i;
const PLURAL: Record<string, string> = { dash: 'dashes', pinch: 'pinches', leaf: 'leaves', each: 'each' };

// Name matching, so it's English-only and misses house names like "Sour mix".
// It's only the guess for lines nobody has decided yet: recipes.at_service
// (set on the drink page's Service section) wins whenever it's set.
const BUBBLES = /soda|tonic|sparkling|champagne|prosecco|cava|cr[eé]mant|ginger (beer|ale)|cola|seltzer|lemonade|\bbeer\b|cider|fizz/i;
const CITRUS = /juice|\b(lemon|lime|grapefruit|yuzu|citrus)\b/i;
const NOT_CITRUS = /cordial|syrup|liqueur|bitters|sherbet|oleo|cello|zest|peel|twist|wheel|wedge|acid/i;
const WATER = /^(filtered |still |chilled |cold |mineral |spring |tap )?water$/i;
const DAIRY = /\begg\b|egg white|yolk|aquafaba|\b(heavy|double|single|whipping) cream\b|^cream$|^milk$|whole milk/i;

/** From the drink's method names ("Shake", "Stir", "shake and top", "Build"). */
export function classifyMethod(names: readonly string[]): BatchMethod {
  const all = names.join(' ').toLowerCase();
  if (/shak/.test(all)) return 'shaken';
  if (/stir/.test(all)) return 'stirred';
  if (/buil/.test(all)) return 'built';
  return 'unknown';
}

/** A count unit (twist, wheel, each): a garnish, never a liquid. */
export function isGarnishUnit(unit: string | null | undefined): boolean {
  return GARNISH_UNITS.has((unit ?? '').toLowerCase());
}

/** The guess from the name and unit, for lines nobody has decided yet. */
export function guessLeaveOut(name: string, unit: string): LeaveOut | null {
  if (GARNISH_UNITS.has(unit) || (DASH_UNITS.has(unit) && OIL.test(name))) return 'garnish';
  if (unit === 'top' || BUBBLES.test(name)) return 'bubbles';
  if (DAIRY.test(name)) return 'dairy';
  if (CITRUS.test(name) && !NOT_CITRUS.test(name)) return 'citrus';
  return null;
}

/** The bar's decision first (recipes.at_service), then the guess. */
export function leaveOutFor(name: string, unit: string, atService: boolean | null): LeaveOut | null {
  const guess = guessLeaveOut(name, unit);
  if (atService === false) return null;
  if (atService === true) return guess ?? 'station';
  return guess;
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

/** Weighed lines stay in weight, whatever the volume unit: "975 g", "1.95 kg". */
export function formatWeight(g: number): string {
  if (g >= 1000) return `${trim(g / 1000, 2)} kg`;
  if (g < 10) return `${trim(g, 1)} g`;
  return `${Math.round(g * 2) / 2} g`;
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
  const out = leaveOutFor(ingredient, u, line.atService);
  const base = { key: line.key, ingredient, leaveOut: out, perServe: '', abv: line.abv };
  if (line.value === null) return { ...base, amount: '', sub: null, ml: null };
  const n = line.value * serves;
  const perG = GRAMS[u];
  if (perG !== undefined) return { ...base, amount: formatWeight(n * perG), sub: null, ml: line.ml === null ? null : line.ml * serves };
  const perMl = VOLUME_ML[u];
  if (perMl === undefined) return { ...base, amount: formatCount(n, u || 'each'), sub: null, ml: null };
  const ml = n * perMl;
  if (DASH_UNITS.has(u)) {
    const counted = formatCount(n, u.startsWith('drop') ? 'drop' : 'dash');
    return n <= DASH_LIMIT ? { ...base, amount: counted, sub: null, ml } : { ...base, amount: formatVolume(ml, unit), sub: counted, ml };
  }
  return { ...base, amount: formatVolume(ml, unit), sub: null, ml };
}

function noteFor(method: BatchMethod, lines: BatchLine[], water: { amount: string; pct: number } | null, poured: boolean): string {
  const bottled = lines.filter((l) => !l.leaveOut && l.ml !== null).map((l) => l.ingredient);
  const has = (why: LeaveOut) => lines.some((l) => l.leaveOut === why);
  const bubbles = lines.filter((l) => l.leaveOut === 'bubbles').map((l) => l.ingredient);
  const station = lines.filter((l) => l.leaveOut === 'station').map((l) => l.ingredient);
  const fresh = has('citrus') ? ' Juice the citrus fresh on the day.' : '';
  const dairy = has('dairy') ? ' Add the egg or cream to order.' : '';
  const top = bubbles.length ? ` Top with ${list(bubbles)} to order; never batch the bubbles.` : '';
  const added = station.length ? ` Add ${list(station)} at the station.` : '';
  const only = bottled.length ? `Batch the ${list(bottled)} only.` : 'Nothing here goes in a bottle.';
  if (poured && water) {
    return `Add ${water.amount} of filtered water (${trim(water.pct, 1)}% dilution), bottle it, and pour straight from the ${method === 'stirred' ? 'freezer' : 'bottle'}.${fresh}${dairy}${top}${added}`;
  }
  if (poured) return `Water is already in the spec, so bottle it as it is and pour straight from the ${method === 'stirred' ? 'freezer' : 'bottle'}.${fresh}${dairy}${top}${added}`;
  switch (method) {
    case 'stirred':
      return `Add no water: the venue's dilution for a stirred drink is 0%. Bottle it and pour straight from the freezer.${fresh}${dairy}${top}${added}`;
    case 'shaken':
      return `${only}${fresh}${dairy} Shake each serve to order with ice.${top}${added}`;
    case 'built':
      return `${only}${fresh}${dairy}${top || ' Build each serve over ice.'}${added}`;
    default:
      return `Scaled straight, with no water added. Only stirred drinks get water in the bottle; set the drink's method to be sure.${fresh}${dairy}${top}${added}`;
  }
}

/**
 * Scale a spec by `serves` and work out the bottle. Water goes in when the
 * bottle is poured straight (a stirred drink, or one served bottled,
 * carbonated or on draught), at `dilutionPct` (the drink's figure from
 * lib/drinkMath.ts; the stirred default without one), unless the spec
 * already has water in it.
 */
export function buildBatch(
  spec: SpecLine[],
  methodNames: readonly string[],
  serves: number,
  opts: { unit?: VolumeUnit; bottleSize?: BottleSize; dilutionPct?: number | null; serviceStyle?: string | null } = {}
): Batch {
  const unit = opts.unit ?? 'ml';
  const bottleSize = opts.bottleSize ?? 750;
  const n = clampServes(serves);
  const method = classifyMethod(methodNames);
  const lines = spec.map((l) => ({ ...scaleLine(l, n, unit), perServe: scaleLine(l, 1, unit).amount }));
  const bottledMl = lines.reduce((sum, l) => sum + (!l.leaveOut && l.ml !== null ? l.ml : 0), 0);
  const poured = method === 'stirred' || opts.serviceStyle === 'bottled' || opts.serviceStyle === 'carbonated' || opts.serviceStyle === 'draught';
  const preDiluted = spec.some((l) => l.atService !== true && WATER.test((l.ingredient ?? '').trim()));
  const pct = opts.dilutionPct ?? (method === 'stirred' ? DILUTION * 100 : 0);
  const waterMl = poured && !preDiluted ? (bottledMl * pct) / 100 : 0;
  const water = waterMl > 0 ? { ml: waterMl, amount: formatVolume(waterMl, unit), pct } : null;
  const totalMl = bottledMl + waterMl;
  const bottled = lines.filter((l) => !l.leaveOut && l.ml !== null);
  const ethanolMl = bottled.reduce((sum, l) => sum + (l.ml! * (l.abv ?? 0)) / 100, 0);
  const abv = totalMl > 0 && bottled.some((l) => l.abv !== null) ? (ethanolMl / totalMl) * 100 : null;
  return {
    serves: n,
    method,
    lines,
    water,
    totalMl,
    total: formatVolume(totalMl, unit),
    bottles: totalMl > 0 ? Math.ceil(totalMl / bottleSize) : 0,
    bottleSize,
    pourMl: totalMl / n,
    pour: formatVolume(totalMl / n, unit),
    abv,
    note: noteFor(method, lines, water, poured),
  };
}

type BatchOpts = Parameters<typeof buildBatch>[3];

/** As many whole serves as fit in one bottle of `bottleMl`, water included (at least 1). */
export function servesToFill(spec: SpecLine[], methodNames: readonly string[], bottleMl: number, opts: BatchOpts = {}): number {
  const perServe = buildBatch(spec, methodNames, 1, opts).totalMl;
  return perServe > 0 ? clampServes(Math.max(MIN_SERVES, Math.floor(bottleMl / perServe + 1e-9))) : MIN_SERVES;
}

/** The lines you can start from: a measured amount in ml or grams. */
export function stockLines(spec: SpecLine[]): SpecLine[] {
  return spec.filter((l) => l.value !== null && l.ingredient !== null && (GRAMS[(l.unit ?? '').toLowerCase()] !== undefined || l.ml !== null));
}

/** Weighed lines are counted in grams; everything else in ml or oz. */
export function stockUnit(line: SpecLine, unit: VolumeUnit): 'g' | VolumeUnit {
  return GRAMS[(line.unit ?? '').toLowerCase()] !== undefined ? 'g' : unit;
}

/** How many whole serves `have` of one line makes ("I have 430 ml of Campari"), at least 1. */
export function servesFromStock(line: SpecLine, have: number, haveUnit: 'g' | VolumeUnit): number {
  if (!(have > 0) || line.value === null) return MIN_SERVES;
  const perG = GRAMS[(line.unit ?? '').toLowerCase()];
  const perServe = haveUnit === 'g' ? (perG !== undefined ? line.value * perG : null) : line.ml;
  const amount = haveUnit === 'oz' ? have * ML_PER_OZ : have;
  return perServe ? clampServes(Math.max(MIN_SERVES, Math.floor(amount / perServe + 1e-9))) : MIN_SERVES;
}

// Ethanol in water by volume (Engineering ToolBox), as [ABV %, freezes at °C].
// Sugar lowers it further, so for a sweet batch this errs on the warm side.
const FREEZES: readonly [number, number][] = [[0, 0], [10, -3.5], [20, -9], [30, -15], [40, -23], [50, -32], [60, -37]];

/** About where a mix of this ABV starts to freeze, in °C. */
export function freezingPointC(abv: number): number {
  const a = Math.min(60, Math.max(0, abv));
  const i = Math.min(FREEZES.length - 2, Math.floor(a / 10));
  const [a0, t0] = FREEZES[i];
  const [a1, t1] = FREEZES[i + 1];
  return t0 + ((a - a0) / (a1 - a0)) * (t1 - t0);
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
  station: 'At the station',
};
