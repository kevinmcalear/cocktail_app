/**
 * Fit it to the glass (QA Q38; Kevin picked "Scale it" on the design calls
 * canvas, 26 Oct 2026): how full a venue's glass is with a drink's serve,
 * against the glass's wash line (bar_glassware.wash_line_ml,
 * 20261123400000), and the spec scaled to land on that line. Dilution by
 * method is drinkMath's, so the serve here is the drink page's serve. Pure;
 * the drink page and the editor render it (components/screens/drink/FitGlass.tsx).
 */

import type { BatchMethod } from './batch';
import { density, dilutionFor, isWaterLine, toMl, type DilutionDefaults } from './drinkMath';

/** A glass's wash line, when the venue hasn't said: this much of what it holds to the brim. */
export const WASH_LINE_SHARE = 0.9;
/** Fit it scales by at most this much either way: past it the glass or the spec is more likely wrong than short. */
export const MAX_FIT = 2;
/** Ice is about 0.92 g per ml (lib/glass.ts): the room a serve's ice takes. */
const ICE_G_PER_ML = 0.92;

/** A venue glass as the wash line reads it: its own figure, else the capacity the venue typed, else its real glass's. */
export interface WashGlass {
  wash_line_ml: number | null;
  capacity_ml: number | null;
  model?: { capacity_ml: number | null } | null;
}

export interface WashLine {
  ml: number;
  /** The venue said it; false when it's read from the capacity. */
  said: boolean;
  /** To the brim, when known. */
  brimMl: number | null;
}

/** The glass's wash line: the venue's own, else about 90% of its capacity to the nearest 5 ml. Null with neither. */
export function washLine(glass: WashGlass): WashLine | null {
  const brim = glass.capacity_ml ?? glass.model?.capacity_ml ?? null;
  if (glass.wash_line_ml) return { ml: Number(glass.wash_line_ml), said: true, brimMl: brim };
  return brim ? { ml: Math.round((brim * WASH_LINE_SHARE) / 5) * 5, said: false, brimMl: brim } : null;
}

/** A spec line as the fill reads it: the editor's draft lines and the drink page's lines both fit. */
export interface FillLine {
  amount: number | string | null;
  unit: string | null;
  ingredient: string | null;
  /** The ingredient's own density, for weighed lines. */
  density?: number | null;
  atService?: boolean | null;
}

export interface FillOptions {
  method: BatchMethod;
  /** The drink's measured dilution, when it has one. */
  dilutionPct?: number | null;
  /** bars.dilution_defaults. */
  defaults?: DilutionDefaults | null;
  washLineMl: number;
  /** Grams of ice in the glass with the drink (items.ice_per_serve_g); 0 for a drink served up, null for ice nobody has weighed. */
  iceG: number | null;
}

export type FillState = 'fits' | 'short' | 'over';

export interface Fill {
  /** The serve after dilution, in ml. */
  serveMl: number;
  /** Where it comes to in the glass: the serve, plus the room the ice takes. */
  levelMl: number;
  washLineMl: number;
  /** Over the wash line (+) or under it (−), in ml. */
  diffMl: number;
  state: FillState;
  dilutionPct: number;
}

/** Why there's nothing to say: a top fills it to the line, the method's unknown, ice in the glass that nobody weighed, or no amounts. */
export type NoFill = 'top' | 'method' | 'ice' | 'empty';

// The units Fit it scales; dashes, drops and spoons stay as written, and count units (a twist, a wheel) aren't poured.
const SCALES = new Set(['ml', 'cl', 'dl', 'l', 'oz', 'fl oz', 'g', 'kg']);
const unitOf = (l: FillLine) => (l.unit ?? '').trim().toLowerCase();
const value = (l: FillLine) => {
  if (l.amount === null || l.amount === '') return null;
  const n = Number(l.amount);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const lineMl = (l: FillLine): number | null => {
  const n = value(l);
  return n === null ? null : toMl(n, l.unit, density(l.ingredient, null, l.density));
};

/** Within this much of the wash line it fits: the larger of 5 ml or 4% of the line. */
export const fitsWithin = (washLineMl: number) => Math.max(5, washLineMl * 0.04);

function dilution(lines: readonly FillLine[], o: FillOptions): number {
  const preDiluted = lines.some((l) => isWaterLine({ ingredient: l.ingredient, atService: l.atService ?? null }));
  return dilutionFor(o.method, { dilutionPct: o.dilutionPct, defaults: o.defaults, preDiluted });
}

/** How full the glass is, or why there's nothing to say. */
export function glassFill(lines: readonly FillLine[], o: FillOptions): Fill | NoFill {
  if (lines.some((l) => unitOf(l) === 'top')) return 'top';
  if (o.method === 'unknown' && o.dilutionPct == null) return 'method';
  // ponytail: ice in the glass needs its weight to know the room it takes; guessing from the glass's iced capacity is the upgrade.
  if (o.iceG === null || !(o.iceG >= 0)) return 'ice';
  const total = lines.reduce((s, l) => s + (lineMl(l) ?? 0), 0);
  if (total <= 0) return 'empty';
  const dilutionPct = dilution(lines, o);
  const serveMl = total * (1 + dilutionPct / 100);
  const iceMl = o.iceG / ICE_G_PER_ML;
  const levelMl = serveMl + iceMl;
  const diffMl = levelMl - o.washLineMl;
  const state: FillState = Math.abs(diffMl) <= fitsWithin(o.washLineMl) ? 'fits' : diffMl < 0 ? 'short' : 'over';
  return { serveMl, levelMl, washLineMl: o.washLineMl, diffMl, state, dilutionPct };
}

/** A bar measure in the line's own unit: 2.5 ml (0.5 under 10), a quarter cl, a quarter ounce (an eighth under half), a gram. */
export function barMeasure(n: number, unit: string): number {
  const u = unit.trim().toLowerCase();
  const step =
    u === 'ml' ? (n >= 10 ? 2.5 : 0.5) : u === 'cl' ? (n >= 1 ? 0.25 : 0.05) : u === 'oz' || u === 'fl oz' ? (n >= 0.5 ? 0.25 : 0.125) : u === 'g' ? (n >= 10 ? 1 : 0.5) : 0.01;
  // Never down to nothing: a line in the spec stays in it.
  return Number((Math.max(step, Math.round(n / step) * step)).toFixed(3));
}

export interface FittedLine {
  /** The new amount, as the spec stores it ("57.5"); the old one when the line doesn't scale. */
  amount: string;
  unit: string | null;
  /** This line's amount changed. */
  changed: boolean;
}

export interface Fitted {
  lines: FittedLine[];
  /** What every scaled amount was multiplied by, before rounding. */
  factor: number;
  /** The glass with the fitted spec. */
  fill: Fill;
}

/**
 * The spec scaled so the serve lands on the wash line: every ml, cl, oz and
 * gram line by the same factor, so the ratio stays the bar's, each rounded to
 * a bar measure in its own unit. Dashes and spoons stay as written. Null when
 * there's nothing to fit (see glassFill), nothing that scales, or it would
 * take more than doubling or halving (MAX_FIT).
 */
export function fitToWashLine(lines: readonly FillLine[], o: FillOptions): Fitted | null {
  const before = glassFill(lines, o);
  if (typeof before === 'string') return null;
  const scales = (l: FillLine) => SCALES.has(unitOf(l)) && lineMl(l) !== null;
  const scaledMl = lines.reduce((s, l) => s + (scales(l) ? lineMl(l)! : 0), 0);
  const fixedMl = lines.reduce((s, l) => s + (scales(l) ? 0 : (lineMl(l) ?? 0)), 0);
  const targetTotal = (o.washLineMl - (before.levelMl - before.serveMl)) / (1 + before.dilutionPct / 100);
  const factor = (targetTotal - fixedMl) / scaledMl;
  if (!(scaledMl > 0) || !(factor >= 1 / MAX_FIT && factor <= MAX_FIT)) return null;
  const fitted = lines.map((l): FittedLine => {
    const was = String(l.amount ?? '');
    if (!scales(l)) return { amount: was, unit: l.unit, changed: false };
    const amount = String(barMeasure(value(l)! * factor, l.unit!));
    return { amount, unit: l.unit, changed: Number(amount) !== Number(was) };
  });
  const fill = glassFill(
    lines.map((l, i) => ({ ...l, amount: fitted[i].amount })),
    o
  ) as Fill;
  return { lines: fitted, factor, fill };
}

/** A drink's cost as Fit it reads it (drink_cost): the total, and each line's cost by ingredient. */
export interface CostToFit {
  total_minor: number;
  missing: number;
  lines: readonly { ingredient: string; minor: number | null }[];
}

/**
 * What a serve costs with the fitted spec: the saved cost, with each changed
 * line's cost scaled as its amount is. Null when a line has no price, or a
 * changed line has no cost line of its name to scale (the cost would be a guess).
 * ponytail: matches lines by ingredient name, and the cost is the saved
 * spec's, so a draft that changed a line since its last save comes out near,
 * not exact. Per-line costs keyed by recipe id would make it exact.
 */
export function fittedCostMinor(cost: CostToFit, names: readonly string[], amounts: readonly string[], fitted: Fitted): number | null {
  if (cost.missing > 0) return null;
  let delta = 0;
  for (let i = 0; i < fitted.lines.length; i++) {
    const l = fitted.lines[i];
    if (!l.changed) continue;
    const was = Number(amounts[i]);
    const line = cost.lines.find((c) => c.ingredient.trim().toLowerCase() === names[i]?.trim().toLowerCase());
    if (!line || line.minor == null || !(was > 0)) return null;
    delta += line.minor * (Number(l.amount) / was - 1);
  }
  return Math.round(cost.total_minor + delta);
}

const ml = (n: number) => `${Math.round(n)} ml`;

/** "24 ml short of the 150 ml wash line", "12 ml over the 150 ml wash line", "Fills to the 150 ml wash line". */
export function fillWords(fill: Fill): string {
  if (fill.state === 'fits') return `Fills to the ${ml(fill.washLineMl)} wash line`;
  return `${ml(Math.abs(fill.diffMl))} ${fill.state === 'short' ? 'short of' : 'over'} the ${ml(fill.washLineMl)} wash line`;
}

/** "Every amount up by 25%." Said under the fitted spec. */
export function factorWords(factor: number): string {
  const pct = Math.round(Math.abs(factor - 1) * 100);
  return pct === 0 ? 'The amounts barely change.' : `Every amount ${factor > 1 ? 'up' : 'down'} by ${pct}%.`;
}
