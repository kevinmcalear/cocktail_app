// The small sums and words of a house prep (lib/prepKinds.ts), on their own so
// the screens that only add up a batch, list what's left to finish or guess a
// kind from a name don't load every kind, way and technique with them.
// lib/prepKinds.ts re-exports all of it.

import type { Allergen } from './allergens';
import type { PrepDraft, PrepDraftLine, PrepKindId, RecipeStep } from './prepKinds';
import { prepFacts } from './techniques/template';

const STEP_NAMES: Record<RecipeStep, string> = { kind: 'what it is', recipe: 'what goes in', method: 'how it’s made' };

const KIND_WORDS: [RegExp, PrepKindId][] = [
  [/\bsuper\s*juice\b/i, 'super'],
  [/\brich\b.*\bsyrup\b|\b2\s*:\s*1\b/i, 'rich'],
  [/\bshrub\b/i, 'shrub'],
  [/\bcordial\b/i, 'cordial'],
  [/\boleo\b/i, 'oleo'],
  // Not tinctures or bitters by name: Tincture is a way of an infusion, made from its own technique (strong spirit, kept a year). A house liqueur is a spirit with a flavour in it.
  [/\b(infused|infusion|liqueur)\b/i, 'infusion'],
  [/\bsyrup\b|\bgomme\b/i, 'syrup'],
  [/\bclarified\b/i, 'clarified'],
  [/\b(distillate|hydrosol)\b/i, 'distillate'],
  [/\bbatch\b/i, 'batch'],
];

/** "at what goes in": where a recipe to finish picks up. */
export const pickUpAt = (d: Pick<PrepDraft, 'at'>): string => `at ${STEP_NAMES[d.at ?? 'kind']}`;

/**
 * Every recipe still to finish in what's being made, down through the
 * recipes inside it (make-anything-steps-3, steps 9 and 10): its name, where
 * it picks up, and how deep. A line left with no recipe at all (Later on its
 * first step) counts too.
 */
export function recipesToFinish(lines: readonly { name: string; later?: boolean; prep?: PrepDraft }[], depth = 0): { name: string; at: string; depth: number }[] {
  return lines.flatMap((l) => [
    ...(l.prep?.at || l.later ? [{ name: l.name, at: l.prep ? pickUpAt(l.prep) : 'nothing written yet', depth }] : []),
    ...(l.prep ? recipesToFinish(l.prep.lines, depth + 1) : []),
  ]);
}

/** The kind a name says it is ("Pineapple chili shrub" is a shrub), or null. */
export function guessKind(name: string): PrepKindId | null {
  return KIND_WORDS.find(([re]) => re.test(name))?.[1] ?? null;
}

/** How much of each line, from the base amount and the parts. */
export function prepAmounts(d: PrepDraft): { line: PrepDraftLine; amount: number | null }[] {
  const base = d.lines.find((l) => l.key === d.baseKey);
  const perPart = base?.parts ? d.baseAmount / base.parts : null;
  return d.lines.map((l) => {
    if (l.parts !== null && perPart !== null) return { line: l, amount: Math.round(l.parts * perPart * 10) / 10 };
    const typed = Number(l.amount);
    return { line: l, amount: l.amount.trim() && typed > 0 ? typed : null };
  });
}

/** About how much a batch makes, in ml, rounded to 10; null when nothing says. */
export function prepYield(d: PrepDraft): number | null {
  let ml = 0;
  for (const { line: l, amount } of prepAmounts(d)) {
    if (amount === null || l.removed) continue;
    ml += amount * (l.yieldPer ?? (l.unit === 'ml' ? 1 : 0));
  }
  // A batch fills its bottle exactly, so 60 ml of it costs what the drink's own pours do.
  if (ml > 0 && d.kind === 'batch') return Math.round(ml);
  return ml > 0 ? Math.round(ml / 10) * 10 : null;
}

/**
 * What its parts carry up (board Add-parts): each part's allergens, found or
 * set by hand, and its own parts' in turn; what else they contain; vegan.
 */
export function partFacts(d: PrepDraft): { allergens: Allergen[]; contains: string[]; vegan: boolean | null } {
  const parts = d.lines.filter((l) => l.prep && !l.slot).map((l) => withFacts(l.prep!));
  return {
    allergens: [...new Set(parts.flatMap((p) => [...(p.allergens ?? []), ...partFacts(p).allergens]))],
    contains: [...new Set(parts.flatMap((p) => p.contains ?? []))],
    vegan: parts.some((p) => p.vegan === false) ? false : parts.some((p) => p.vegan == null) ? null : true,
  };
}

/**
 * Every allergen in it: its own (`allergens`: from its lines, or set by hand)
 * and its parts'. Shown together, as drink_allergens rolls them up once
 * saved, but kept apart: a part's stays the part's, so it goes when the part
 * drops it, and the house-made never declares it as its own.
 */
export function allAllergens(d: PrepDraft): Allergen[] {
  return [...new Set([...(d.allergens ?? []), ...partFacts(d).allergens])];
}

/**
 * Allergens and vegan, read again from the lines as they are now (a line
 * swapped or added). What else it contains, and vegan, count its parts too.
 */
export function withFacts<D extends PrepDraft>(d: D): D {
  const facts = prepFacts(d.lines.filter((l) => !l.slot).map((l) => l.name), d.lines.some((l) => l.slot));
  const parts = partFacts(d);
  const vegan = facts.vegan === false || parts.vegan === false ? false : facts.vegan === null || parts.vegan === null ? null : true;
  // Allergens set by hand stay as they were set.
  return { ...d, allergens: d.allergensSet ? d.allergens : facts.allergens, contains: [...new Set([...facts.contains, ...parts.contains])], vegan };
}

/** "https://www.imbibemagazine.com/recipe/x" → "imbibemagazine.com": a source as people say it. */
export function sourceSite(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
}
