/**
 * A bottle in the drink made in house by a technique: the nudge when the
 * drink's own name already says ("Coconut Fat-Washed Daiquiri"), and a line
 * typed the way a spec says it ("coconut fat-washed bacardi"). Pure: the
 * wizard (IngredientsStep) opens the house prep steps from these.
 */
import { searchIngredients, type IngredientAlias, type IngredientRow } from '@/lib/ingredientNames';
import { capitalize, capitalizeFirst } from '@/lib/stringUtils';
import type { Technique } from '@/lib/techniques';
import { FITS, looksMadeInHouse, startsFrom, waysToMake } from '@/lib/techniques/makeIt';
import { nameParts, splitName } from '@/lib/techniques/template';
import type { BaseKind } from '@/lib/techniques/types';

/** Made from the produce, not from a line in the drink: offered from the search instead. */
const SCRATCH = new Set(['infused-oil', 'tepache']);

/**
 * A technique that changes something on the shelf: not made from nothing (a
 * syrup), not a finish (a foam, pearls) and not a way of making the drink.
 */
const changes = (t: Technique) =>
  !t.method && !SCRATCH.has(t.id) && t.group !== 'foam' && t.group !== 'texture' && t.group !== 'syrup' && !!t.starts && !['none', 'water', 'sugar', 'fat'].includes(t.starts);

export interface HouseNudge {
  /** The line to make house. */
  key: string;
  technique: Technique;
  /** The words before the technique in the drink's name ("Coconut"), if any. */
  adjunct: string | null;
  /** "coconut fat-washed", as the name says it. */
  phrase: string;
  /** Where it was said: the drink's name, or the line as typed or pasted ("60 ml coconut fat-washed bacardi"). */
  from?: 'name' | 'typed';
}

/**
 * The drink's name says how one of its lines is made ("Coconut Fat-Washed
 * Daiquiri") and that line is still a plain bottle: offer to do it. Only a
 * technique that changes a spirit or juice, and only a line it fits.
 */
export function houseNudge(drinkName: string, lines: readonly { key: string; name: string; id: string | null; prep?: unknown; styleName?: string | null }[]): HouseNudge | null {
  const t = waysToMake(drinkName).find(changes);
  if (!t) return null;
  if (lines.some((l) => l.prep)) return null;
  const fits = FITS[t.starts as BaseKind] ?? [t.starts as BaseKind];
  const line = lines.find((l) => {
    const kind = startsFrom(l.name) ?? (l.styleName ? startsFrom(l.styleName) : null);
    return !!l.id && !!kind && (fits.includes(kind) || t.starts === 'liquid');
  });
  if (!line) return null;
  const { before, word } = splitName(drinkName);
  const adjunct = before.length ? capitalize(before.join(' ')) : null;
  const phrase = [...before, t.word ?? word ?? t.name].join(' ').toLowerCase();
  return { key: line.key, technique: t, adjunct, phrase };
}


export interface HouseReading<T> {
  technique: Technique;
  /** The "with what" ("Coconut"), if the line says one. */
  adjunct: string | null;
  /** What it's made from, as written ("Bacardi"). */
  base: string;
  /** The bottles that could be, the ones you have first: the line starts as the first. */
  bottles: T[];
  /** "coconut fat-washed", as written. */
  phrase: string;
}

/**
 * A line written the way a spec says it, "coconut fat-washed bacardi": a
 * bottle you have, changed by a technique, with what. Null when the line
 * names no technique that changes a bottle, or no bottle it could start
 * from. Made things (another wash, a cordial) are never the bottle.
 */
export function readHouse<T extends IngredientRow & { generic_id?: string | null }>(
  text: string,
  rows: readonly T[],
  opts: { aliases?: readonly IngredientAlias[]; coreIds?: ReadonlySet<string>; have?: ReadonlySet<string> } = {},
): HouseReading<T> | null {
  const technique = waysToMake(text).find(changes);
  if (!technique) return null;
  const { base, adjunct } = nameParts(text, technique);
  if (!base) return null;
  // Yours first, then ones it can start from (a rum for a wash, not "Bacardi Falernum"), then as search ranks them.
  const have = opts.have ?? new Set<string>();
  const fits = FITS[technique.starts as BaseKind] ?? [technique.starts as BaseKind];
  const kind = (r: T) => startsFrom(r.name ?? '') ?? startsFrom(rows.find((g) => g.id === r.generic_id)?.name ?? '');
  const ranked = searchIngredients(base, rows, { ...opts, limit: 12 })
    .filter((r) => !looksMadeInHouse(r.name ?? ''))
    // Each one's rank once: its kind looks up its style in the whole catalog.
    .map((r, i) => ({ r, i, mine: have.has(r.id) ? 0 : 1, misfit: technique.starts === 'liquid' || fits.includes(kind(r) as BaseKind) ? 0 : 1 }));
  const bottles = ranked.sort((a, b) => a.mine - b.mine || a.misfit - b.misfit || a.i - b.i).slice(0, 3).map((x) => x.r);
  if (!bottles.length) return null;
  const { before, word } = splitName(text);
  const phrase = [...before, technique.word ?? word ?? technique.name].join(' ').toLowerCase();
  return { technique, adjunct, base, bottles, phrase };
}

// "House", "homemade", "in-house", "house-made": the words a spec uses for one of its own.
const HOUSE = /\b(?:in[- ]?house|house[- ]?made|home[- ]?made|house)\b/i;
const LEADING_HOUSE = /^(?:(?:our|the)\s+)?(?:in[- ]?house|house[- ]?made|home[- ]?made|house)\s+/i;
const TRAILING_HOUSE = /[\s,]*\(?(?:in[- ]?house|house[- ]?made|home[- ]?made)\)?$/i;

/** The word that says a line is made here ("house" in "house miso banana liqueur"), lower case; null when none does. Make it in-house is then offered first (call 12). */
export const houseWord = (name: string): string | null => name.match(HOUSE)?.[0].toLowerCase() ?? null;

/**
 * The recipe's name without the words that only say it's made here:
 * "house miso banana liqueur" is "Miso banana liqueur", "Orgeat (house-made)"
 * is "Orgeat". A name that is only those words stays as it was.
 */
export function houseName(name: string): string {
  const bare = name.trim().replace(LEADING_HOUSE, '').replace(TRAILING_HOUSE, '').trim();
  return capitalizeFirst(bare || name);
}
