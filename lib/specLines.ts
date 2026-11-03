/**
 * The drink page's words around a spec: each line's role, the method line, the
 * serve lines and the amount taken apart. Kept off lib/specView, which Tonight
 * loads on every web page.
 */

import { isGarnishLine } from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';
import { grated, overIce } from '@/lib/units';

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
export function lineRole(l: Pick<SpecLine, 'unit' | 'ingredient' | 'float' | 'houseMade' | 'optional' | 'garnish'>, layout: SpecLayout, underFloat = false): string | null {
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

