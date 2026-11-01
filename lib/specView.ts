/**
 * How a spec reads on the 2027 drink page (canvas GWBCX, Decided page, "The
 * spec by who is looking"): Ingredients (ruled rows in pour order) or Steps
 * (the same rows grouped by step in making order), Makes 1, 2 or 3, and amounts
 * that land on a jigger's marks once they are scaled or converted.
 */

import { isGarnishUnit } from '@/lib/batch';
import { barMl, convertLine, density, ML_PER_OZ, type MassUnit } from '@/lib/drinkMath';
import type { SpecLine } from '@/lib/spec';
import { amountText } from '@/lib/units';

export type SpecView = 'ingredients' | 'steps';

export const SPEC_VIEWS: readonly { value: SpecView; label: string }[] = [
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'steps', label: 'Steps' },
];

/**
 * Who is looking decides the first view: people who make the drink (a bar's
 * staff, a home bartender's own drink) get Steps, everyone else Ingredients.
 */
export function defaultSpecView(maker: boolean): SpecView {
  return maker ? 'steps' : 'ingredients';
}

/** A person's own pick wins over their default; nobody picked yet reads the default. */
export function pickSpecView(saved: Record<string, SpecView>, person: string, maker: boolean): SpecView {
  return saved[person] ?? defaultSpecView(maker);
}

/** Makes on the page (Kevin trimmed it to these, plus A batch, which opens the Batch sheet). Never saved: every page opens at 1. */
export const MAKES = [1, 2, 3] as const;
export type Makes = (typeof MAKES)[number];

/** Units a line can be scaled and snapped in; dashes, spoons and counts multiply as written. */
const POURED = new Set(['ml', 'cl', 'dl', 'l', 'oz', 'fl oz', 'g', 'kg']);

/**
 * A scaled or converted amount on the nearest jigger mark: quarter ounces;
 * 2.5 ml under 30 ml and 5 ml from there (a metric jigger's lines); whole grams.
 * Never snaps a real amount to nothing.
 *
 * ponytail: one set of marks for every bar. Read a bar's own jiggers from its
 * kit (bar_kit tools) when a bar can record them.
 */
export function snapToJigger(value: number, unit: MassUnit): number {
  if (value <= 0) return value;
  const step = unit === 'oz' ? 0.25 : unit === 'g' ? 1 : value < 30 ? 2.5 : 5;
  return Math.max(step, Math.round(value / step) * step);
}

const trim = (n: number) => String(Number(n.toFixed(2)));

/**
 * A spec line's amount for this many serves, in the person's unit. One serve
 * reads as written (or converted, as today's page does); more than one is
 * scaled and snapped to the jigger. Null when the line has no amount.
 */
export function scaledAmount(line: SpecLine, makes: number, to: MassUnit): string | null {
  if (makes <= 1) return convertLine(line, to, density(line.ingredient, line.abv, line.density)) ?? line.amount;
  if (line.value === null) return line.amount;
  const unit = (line.unit ?? '').toLowerCase();
  if (!POURED.has(unit) || line.ml === null) return amountText(trim(line.value * makes), line.unit);
  const ml = (unit === 'oz' || unit === 'fl oz' ? barMl(line.ml) : line.ml) * makes;
  if (to === 'oz') return `${trim(snapToJigger(ml / ML_PER_OZ, 'oz'))} oz`;
  if (to === 'g') return `${trim(snapToJigger(ml * density(line.ingredient, line.abv, line.density), 'g'))} g`;
  const snapped = snapToJigger(ml, 'ml');
  return snapped >= 1000 ? `${trim(snapped / 1000)} L` : `${trim(snapped)} ml`;
}

export interface SpecGroup {
  key: string;
  /** "1", "2": numbered in making order; null for the garnish rows at the end, which sit under no heading. */
  number: string | null;
  /** "Shake", "Float", "Part 2"; null when the drink is one group with no method to name. */
  title: string | null;
  lines: SpecLine[];
  /** Garnish rows carry their tag instead of a heading. */
  tag?: 'Garnish';
}

/**
 * Steps view: the ruled rows split where the drink has stages, in making order.
 * A drink made in parts gets a group per part; otherwise the main pour (titled
 * by its method: Shake, Stir, Build), then anything floated on top. A garnish
 * isn't a step: its rows come last, tagged, under no heading. A simple drink is
 * one group, so it reads like a spec sheet.
 */
export function specGroups(lines: SpecLine[], verb: string | null = null): SpecGroup[] {
  const garnish = lines.filter((l) => isGarnishUnit(l.unit));
  const rest = lines.filter((l) => !isGarnishUnit(l.unit));
  const parts = [...new Set(rest.map((l) => l.part ?? 1))].sort((a, b) => a - b);
  const titled: { key: string; title: string | null; lines: SpecLine[] }[] =
    parts.length > 1
      ? parts.map((p) => ({ key: `part-${p}`, title: p === parts[0] && verb ? verb : `Part ${p}`, lines: rest.filter((l) => (l.part ?? 1) === p) }))
      : [
          { key: 'main', title: verb, lines: rest.filter((l) => !l.float) },
          { key: 'float', title: 'Float', lines: rest.filter((l) => l.float) },
        ];
  const groups: SpecGroup[] = titled.filter((g) => g.lines.length).map((g, i) => ({ ...g, number: String(i + 1) }));
  if (garnish.length) groups.push({ key: 'garnish', number: null, title: null, lines: garnish, tag: 'Garnish' });
  return groups;
}

/** "Shake", "Stir", "Build" from the drink's method names ("Shaken", "stir and strain"); null when there's none to name. */
export function methodVerb(methods: readonly string[]): string | null {
  const all = methods.join(' ').toLowerCase();
  if (/shak/.test(all)) return 'Shake';
  if (/stir/.test(all)) return 'Stir';
  if (/throw/.test(all)) return 'Throw';
  if (/blend/.test(all)) return 'Blend';
  if (/build|built/.test(all)) return 'Build';
  return null;
}

/** The glass, ice and garnish in one quiet line: "Rocks · Large cube · Candied ginger". Blanks drop out. */
export function serveLine(parts: readonly (string | null | undefined)[]): string | null {
  const kept = parts.map((p) => p?.trim()).filter((p): p is string => !!p);
  return kept.length ? kept.join(' · ') : null;
}
