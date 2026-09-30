/**
 * Drink maths: grams to ml through density, ethanol per line, the drink's
 * ABV, dilution by method (with the venue's own defaults), the serve after
 * dilution and its ABV. Pure. The same rules run on the server
 * (private.refresh_drink_strength, migration 20261001130000) so roles that
 * can't see the amounts still get the strength; drinkMath.check.ts and
 * supabase/tests/drink-math.test.mjs pin both to the same worked example.
 */

import type { BatchMethod } from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';

export type MassUnit = 'g' | 'ml' | 'oz';
export const ML_PER_OZ = 29.57;
/** A UK unit is 10 ml of pure ethanol. */
const ML_ETHANOL_PER_UK_UNIT = 10;

/** House dilution by method, in percent of the undiluted drink. */
export const DEFAULT_DILUTION: Record<BatchMethod, number> = { stirred: 20, shaken: 25, built: 10, unknown: 0 };

/** bars.dilution_defaults: the venue's own figures, by method. */
export type DilutionDefaults = Partial<Record<'stirred' | 'shaken' | 'built', number>>;

const VOLUME_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, oz: 29.57, 'fl oz': 29.57,
  dash: 0.8, dashes: 0.8, drop: 0.05, drops: 0.05,
  bsp: 5, barspoon: 5, tsp: 5, tbsp: 15,
};
const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000 };
const WATER = /^(filtered |still |chilled |cold |mineral |spring |tap )?water$/i;

/**
 * Grams per ml for an ingredient: its own density when set, else a guess from
 * the name (syrups, honey, juice) and the ABV: a 40% spirit is about 0.95, a
 * 17% vermouth about 0.98, and water 1.
 */
export function density(name: string | null | undefined, abv: number | null | undefined, own?: number | null): number {
  if (own) return own;
  const n = name ?? '';
  if (/honey/i.test(n)) return 1.42;
  if (/syrup|cordial|agave|oleo|sherbet|grenadine|orgeat/i.test(n)) return 1.23;
  if (/juice/i.test(n)) return 1.04;
  if (abv == null || abv <= 0) return 1;
  if (abv <= 40) return 1 - 0.0013 * abv;
  return 0.948 - 0.0025 * (abv - 40);
}

/** A spec amount in ml: bar volumes straight, weights through the density, counts null. */
export function toMl(amount: number, unit: string | null | undefined, gPerMl: number): number | null {
  const u = (unit ?? '').trim().toLowerCase();
  if (u in WEIGHT_G) return (amount * WEIGHT_G[u]) / gPerMl;
  if (u in VOLUME_ML) return amount * VOLUME_ML[u];
  return null;
}

/** Ethanol in a line, in ml. */
export function ethanolMl(ml: number, abv: number | null | undefined): number {
  return abv && abv > 0 ? (ml * abv) / 100 : 0;
}

/** Is this line just water, so the drink is already diluted in the bottle? */
export function isWaterLine(line: Pick<SpecLine, 'ingredient' | 'atService'>): boolean {
  return line.atService !== true && WATER.test((line.ingredient ?? '').trim());
}

/**
 * The dilution to use: the drink's measured figure, else 0 when water is
 * already in the spec, else the venue's default for the method, else the
 * house rule.
 */
export function dilutionFor(method: BatchMethod, opts: { dilutionPct?: number | null; defaults?: DilutionDefaults | null; preDiluted?: boolean }): number {
  if (opts.dilutionPct != null) return opts.dilutionPct;
  if (opts.preDiluted) return 0;
  const own = method === 'unknown' ? undefined : opts.defaults?.[method];
  return typeof own === 'number' && Number.isFinite(own) ? own : DEFAULT_DILUTION[method];
}

export interface StrengthLine {
  key: string;
  ingredient: string;
  ml: number;
  ethanolMl: number;
  /** The ingredient has no ABV on file, so it counted as 0. */
  abvUnknown: boolean;
}

export interface Strength {
  lines: StrengthLine[];
  /** The undiluted drink, in ml. */
  totalMl: number;
  ethanolMl: number;
  /** Percent, before dilution. */
  abv: number;
  dilutionPct: number;
  serveMl: number;
  serveAbv: number;
  unitsUk: number;
  /** Lines that counted as 0% for want of an ABV. */
  unknownAbv: number;
  preDiluted: boolean;
}

/** The strength of a drink from the lines this role can see; null with nothing measured. */
export function drinkStrength(
  lines: SpecLine[],
  method: BatchMethod,
  opts: { dilutionPct?: number | null; defaults?: DilutionDefaults | null } = {}
): Strength | null {
  const out: StrengthLine[] = [];
  for (const l of lines) {
    if (l.value === null || l.ml === null) continue;
    out.push({ key: l.key, ingredient: l.ingredient ?? 'Hidden ingredient', ml: l.ml, ethanolMl: ethanolMl(l.ml, l.abv), abvUnknown: l.abv == null });
  }
  const totalMl = out.reduce((s, l) => s + l.ml, 0);
  if (totalMl <= 0) return null;
  const ethanol = out.reduce((s, l) => s + l.ethanolMl, 0);
  const preDiluted = lines.some(isWaterLine);
  const dilutionPct = dilutionFor(method, { ...opts, preDiluted });
  const serveMl = totalMl * (1 + dilutionPct / 100);
  return {
    lines: out,
    totalMl,
    ethanolMl: ethanol,
    abv: (ethanol / totalMl) * 100,
    dilutionPct,
    serveMl,
    serveAbv: (ethanol / serveMl) * 100,
    unitsUk: ethanol / ML_ETHANOL_PER_UK_UNIT,
    unknownAbv: out.filter((l) => l.abvUnknown).length,
    preDiluted,
  };
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** "24.6%", "0.5%". */
export function formatAbv(abv: number | null | undefined): string | null {
  return abv == null ? null : `${trim(abv, 1)}%`;
}

/** "122 ml", "1.2 L", "4.1 oz", "52.6 g". */
export function formatAmount(value: number, unit: MassUnit): string {
  if (unit === 'oz') return `${trim(value / ML_PER_OZ, value / ML_PER_OZ < 1 ? 2 : 1)} oz`;
  if (value >= 1000) return `${trim(value / 1000, 2)} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${trim(value, value < 10 ? 1 : value < 100 ? 1 : 0)} ${unit}`;
}

/**
 * A spec line read in another unit: a weighed line in ml or oz, a poured
 * line in grams. Null when the line has no amount, the unit is a count, or
 * it's already in that unit.
 */
export function convertLine(line: Pick<SpecLine, 'value' | 'unit' | 'ml' | 'ingredient' | 'abv'>, to: MassUnit, gPerMl: number): string | null {
  if (line.value === null || line.ml === null) return null;
  const u = (line.unit ?? '').toLowerCase();
  if ((to === 'g' && u === 'g') || (to === 'ml' && u === 'ml') || (to === 'oz' && u === 'oz')) return null;
  if (to === 'g') return formatAmount(line.ml * gPerMl, 'g');
  return formatAmount(line.ml, to);
}

/** "52.6 ml · 21.1 ml ethanol", for the small line under a spec row. */
export function lineDetail(line: SpecLine, to: MassUnit): string | null {
  const converted = convertLine(line, to, density(line.ingredient, line.abv, line.density));
  const ethanol = line.ml !== null && line.abv ? `${trim(ethanolMl(line.ml, line.abv), 1)} ml ethanol` : null;
  const parts = [converted, ethanol].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
