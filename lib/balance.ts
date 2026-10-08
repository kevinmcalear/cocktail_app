/**
 * What a drink being built is missing, from the same taste rules the flavor
 * profiles use (supabase/functions/_shared/flavor.ts). A hint, never a rule:
 * bartenders break balance on purpose.
 */
import { profileFromSpec, type SpecPart } from '../supabase/functions/_shared/flavor';

export interface BalanceLine {
  name: string;
  genericName?: string | null;
  amount: number | null;
  unit: string | null;
}

export interface Balance {
  strong: number;
  sour: number;
  sweet: number;
  bitter: number;
  /** One plain sentence, or null when there's nothing worth saying. */
  hint: string | null;
  /** What would round it out, for one-tap fixes (fixesFor). */
  need: Need | null;
}

export type Need = 'sweet' | 'sour' | 'body';

/** Below this share of the spec understood, the meters would mislead: say nothing. */
const MIN_COVERAGE = 0.5;

const LOW = 0.1;

export function balanceOf(lines: readonly BalanceLine[]): Balance | null {
  if (!lines.length) return null;
  const parts: SpecPart[] = lines.map((l) => ({ id: null, name: l.name, genericName: l.genericName ?? null, amount: l.amount, unit: l.unit }));
  const { profile, coverage } = profileFromSpec(parts);
  if (coverage < MIN_COVERAGE) return null;
  const { strong, sour, sweet, bitter } = profile;
  let hint: string | null = null;
  let need: Need | null = null;
  if (sour > 0.25 && sweet < LOW) {
    hint = 'Sour with nothing sweet. Most drinks like this add a syrup or a liqueur.';
    need = 'sweet';
  } else if (sweet > 0.35 && sour < LOW && bitter < LOW) {
    hint = 'Sweet with nothing to balance it. A little citrus or bitters would.';
    need = 'sour';
  } else if (strong > 0.85 && sour < LOW && bitter < LOW) {
    // Neat spirit already reads a little sweet (whiskey), so strength alone says "all spirit".
    hint = 'All spirit so far. Stirred drinks usually add a vermouth, or a little sugar and bitters.';
    need = 'body';
  }
  return { strong, sour, sweet, bitter, hint, need };
}

// The base spirit decides which sugar, citrus or vermouth is the natural fit.
const BASES: readonly [RegExp, Record<Need, readonly string[]>][] = [
  [/tequila|mezcal|raicilla|sotol|agave/, { sweet: ['Agave syrup', 'Orange liqueur'], sour: ['Lime juice', 'Angostura bitters'], body: ['Agave syrup', 'Orange bitters'] }],
  [/rum|cacha[cç]a|rhum|arrack/, { sweet: ['Simple syrup', 'Demerara syrup'], sour: ['Lime juice', 'Angostura bitters'], body: ['Demerara syrup', 'Angostura bitters'] }],
  [/whisk|bourbon|rye|scotch|brandy|cognac|armagnac|calvados/, { sweet: ['Simple syrup', 'Honey syrup'], sour: ['Lemon juice', 'Angostura bitters'], body: ['Sweet vermouth', 'Angostura bitters'] }],
  [/gin|vodka|genever|aquavit|pisco|shochu|baijiu/, { sweet: ['Simple syrup', 'Orange liqueur'], sour: ['Lemon juice', 'Lime juice'], body: ['Dry vermouth', 'Orange bitters'] }],
];
const ANY: Record<Need, readonly string[]> = { sweet: ['Simple syrup'], sour: ['Lemon juice', 'Angostura bitters'], body: ['Sweet vermouth', 'Angostura bitters'] };

/** The one-tap fixes for what a drink needs, by its base: "Agave syrup" for a sour mezcal drink. Leaves out what's already in it. */
export function fixesFor(need: Need, lines: readonly Pick<BalanceLine, 'name' | 'genericName'>[]): string[] {
  const text = lines.map((l) => `${l.name} ${l.genericName ?? ''}`.toLowerCase()).join(' | ');
  const names = BASES.find(([re]) => re.test(text))?.[1][need] ?? ANY[need];
  return names.filter((n) => !text.includes(n.toLowerCase()));
}
