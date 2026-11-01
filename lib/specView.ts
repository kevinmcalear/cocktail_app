/**
 * How a spec reads on the 2027 drink page (canvas GWBCX, Decided page, "The
 * spec by who is looking"): Ingredients (ruled rows in pour order) or Steps
 * (the same rows grouped by step in making order), Makes 1, 2 or 3, and amounts
 * that land on a jigger's marks once they are scaled or converted.
 */

import { isGarnishLine } from '@/lib/batch';
import { barMl, convertLine, density, ML_PER_OZ, type MassUnit } from '@/lib/drinkMath';
import type { SpecLine } from '@/lib/spec';
import { amountText, grated, overIce } from '@/lib/units';

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
}

/**
 * Steps view: the ruled rows split where the drink has stages, in making order.
 * A drink made in parts gets a group per part; otherwise the main pour (titled
 * by its method: Shake, Stir, Build), then anything floated on top. A garnish
 * isn't a step: its rows come last under no heading, each saying "garnish" (lineRole). A simple drink is
 * one group, so it reads like a spec sheet.
 */
export function specGroups(lines: SpecLine[], verb: string | null = null): SpecGroup[] {
  const garnish = lines.filter(isGarnishLine);
  const rest = lines.filter((l) => !isGarnishLine(l));
  const parts = [...new Set(rest.map((l) => l.part ?? 1))].sort((a, b) => a - b);
  const titled: { key: string; title: string | null; lines: SpecLine[] }[] =
    parts.length > 1
      ? parts.map((p) => ({ key: `part-${p}`, title: p === parts[0] && verb ? verb : `Part ${p}`, lines: rest.filter((l) => (l.part ?? 1) === p) }))
      : [
          { key: 'main', title: verb, lines: rest.filter((l) => !l.float) },
          { key: 'float', title: 'Float', lines: rest.filter((l) => l.float) },
        ];
  const groups: SpecGroup[] = titled.filter((g) => g.lines.length).map((g, i) => ({ ...g, number: String(i + 1) }));
  if (garnish.length) groups.push({ key: 'garnish', number: null, title: null, lines: garnish });
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

/** The floor's serve line (board Decided-who-floor): "Goes out: rocks, large cube, candied ginger". */
export function goesOutLine(parts: readonly (string | null | undefined)[]): string | null {
  const kept = parts.map((p) => p?.trim().toLowerCase()).filter((p): p is string => !!p);
  return kept.length ? `Goes out: ${kept.join(', ')}` : null;
}

/** The garnish as said aloud: a discard says what happened to the peel ("Lemon peel, expressed and discarded"), grated says so ("Grated nutmeg"). */
export function garnishLabel(name: string, unit: string | null | undefined): string {
  const u = (unit ?? '').toLowerCase();
  return u === 'discard' ? `${name} peel, expressed and discarded` : u === 'grated' ? grated(name) : name;
}

/** The drink's garnishes in spec order, as said aloud. Names as written. */
export function garnishNames(lines: readonly SpecLine[]): string[] {
  return lines.filter((l) => l.ingredient && isGarnishLine(l)).map((l) => garnishLabel(l.ingredient!, l.unit));
}

/** How the spec is laid out: Ingredients' ruled rows, Steps' groups, or names only (a guest, the floor, no amounts). */
export type SpecLayout = 'rows' | 'steps' | 'names';

/**
 * The word after a line's name (boards Draw-bg, Desk-page, And-page). In
 * the ruled rows it follows the name, muted: "float", "garnish". On a names
 * list it sits at the right, capitalised: "Garnish", "Float", "House-made".
 * In Steps the Float heading already says it (`underFloat`). Whether a line
 * floats never depends on the view someone saved.
 */
export function lineRole(l: Pick<SpecLine, 'unit' | 'ingredient' | 'float' | 'houseMade' | 'optional'>, layout: SpecLayout, underFloat = false): string | null {
  const kind = isGarnishLine(l) ? 'garnish' : l.float && !underFloat ? 'float' : l.houseMade && layout === 'names' ? 'house-made' : null;
  const words = [kind, l.optional ? 'optional' : null].filter(Boolean).join(', ');
  if (!words) return null;
  return layout === 'names' ? words[0].toUpperCase() + words.slice(1) : words;
}

/** A glass or ice name mid-line: "coupe", "large cube", but a name with its own capitals ("Nick & Nora") as written. */
function midLine(name: string): string {
  const n = name.trim();
  return /\s\p{Lu}/u.test(n) ? n : n.toLowerCase();
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

export interface MethodLineInput {
  /** "Shake", "Stir" (methodVerb). */
  verb: string | null;
  /** The drink's method names, for a double strain. */
  methods: readonly string[];
  glass: string | null | undefined;
  /** The ice it's served over; "No ice" or "Up" for none. */
  ice: string | null | undefined;
  lines: readonly SpecLine[];
}

/**
 * Ingredients view's one line under the rows (boards Decided-spec-rows,
 * who-public, Desk-who-public): how it's made, how it goes in, what floats,
 * the garnish. "Shake · strain over a large cube · float the Islay scotch ·
 * Candied ginger". A rocks glass goes without saying over ice; any other
 * glass is named. Ingredient names as written. Null with nothing to say.
 */
export function methodLine({ verb, methods, glass, ice, lines }: MethodLineInput): string | null {
  const said = methods.join(' ').toLowerCase();
  const strained = verb === 'Shake' || verb === 'Stir' || verb === 'Throw';
  const strain = /strain/.test(said) && /double|fine/.test(said) ? 'double strain' : strained ? 'strain' : null;
  const iced = ice?.trim() && !/^(no ice|up|neat)\b/i.test(ice.trim()) ? ice.trim() : null;
  const cup = glass?.trim() ? midLine(glass) : null;
  const rocks = !!cup && /rocks|old fashioned|lowball|tumbler/i.test(cup);
  const into = iced
    ? [`over ${overIce(iced)}`, cup && !rocks ? `in ${article(cup)}` : null].filter(Boolean).join(' ')
    : cup
      ? // "a rocks glass": a rocks with no ice to say it by still needs its noun.
        `${strain ? 'into' : 'in'} ${article(rocks && !/glass$/i.test(cup) ? `${cup} glass` : cup)}`
      : null;
  const pour = [strain, into].filter(Boolean).join(' ');
  const floats = lines.filter((l) => l.float && l.ingredient && !isGarnishLine(l)).map((l) => `float the ${l.ingredient}`);
  const garnish = garnishNames(lines).join(', ');
  const parts = [verb, pour, ...floats, garnish].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : null;
}
