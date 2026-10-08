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
}

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
  if (sour > 0.25 && sweet < LOW) hint = 'Sour with nothing sweet. Most drinks like this add a syrup or a liqueur.';
  else if (sweet > 0.35 && sour < LOW && bitter < LOW) hint = 'Sweet with nothing to balance it. A little citrus or bitters would.';
  // Neat spirit already reads a little sweet (whiskey), so strength alone says "all spirit".
  else if (strong > 0.85 && sour < LOW && bitter < LOW)
    hint = 'All spirit so far. Stirred drinks usually add a vermouth, or a little sugar and bitters.';
  return { strong, sour, sweet, bitter, hint };
}
