/**
 * "Make it house" on a drink's line: the bottle you'd reach for, then what
 * you did to it. Which techniques can change a line, and the nudge when the
 * drink's own name already says ("Coconut Fat-Washed Daiquiri"). Pure: the
 * wizard (IngredientsStep) opens the prep builder from these.
 */
import { searchIngredients, type IngredientAlias, type IngredientRow } from '@/lib/ingredientNames';
import { capitalize } from '@/lib/stringUtils';
import { TECHNIQUES, type Technique } from '@/lib/techniques';
import { FITS, looksMadeInHouse, startsFrom, waysToMake } from '@/lib/techniques/makeIt';
import { nameParts, splitName } from '@/lib/techniques/template';
import type { BaseKind } from '@/lib/techniques/types';

/** The order the sheet lists them in: the ones bars reach for first, then by group, the rare ones last. */
const FIRST = ['fat-wash', 'milk-wash', 'cold-infusion', 'nitrous-infusion', 'sous-vide-infusion'];
const GROUP_ORDER = ['wash', 'infuse', 'clarify', 'preserve', 'carbonate', 'distil'] as const;

/** Made from the produce, not from a line in the drink: offered from the search instead. */
const SCRATCH = new Set(['infused-oil', 'tepache']);

/**
 * A technique that changes something on the shelf: not made from nothing (a
 * syrup), not a finish (a foam, pearls) and not a way of making the drink.
 */
const changes = (t: Technique) =>
  !t.method && !SCRATCH.has(t.id) && t.group !== 'foam' && t.group !== 'texture' && t.group !== 'syrup' && !!t.starts && !['none', 'water', 'sugar', 'fat'].includes(t.starts);

/**
 * What a line can be made into, best fit first. A spirit lists the washes and
 * infusions, a juice the clarifying; a line that says neither lists them all.
 */
export function houseWays(lineName: string, styleName?: string | null): Technique[] {
  const kind = startsFrom(lineName) ?? (styleName ? startsFrom(styleName) : null);
  const fits = kind ? FITS[kind] ?? [kind] : null;
  return TECHNIQUES.filter((t) => changes(t) && (!fits || fits.includes(t.starts as BaseKind) || t.starts === 'liquid')).sort(
    (a, b) => rank(a) - rank(b),
  );
}

const rank = (t: Technique) => {
  const first = FIRST.indexOf(t.id);
  if (first !== -1) return first;
  const g = GROUP_ORDER.indexOf(t.group as (typeof GROUP_ORDER)[number]);
  return FIRST.length + (g === -1 ? GROUP_ORDER.length : g);
};

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
  const misfit = (r: T) => (technique.starts === 'liquid' || fits.includes(kind(r) as BaseKind) ? 0 : 1);
  const bottles = searchIngredients(base, rows, { ...opts, limit: 12 })
    .filter((r) => !looksMadeInHouse(r.name ?? ''))
    .sort((a, b) => Number(have.has(b.id)) - Number(have.has(a.id)) || misfit(a) - misfit(b))
    .slice(0, 3);
  if (!bottles.length) return null;
  const { before, word } = splitName(text);
  const phrase = [...before, technique.word ?? word ?? technique.name].join(' ').toLowerCase();
  return { technique, adjunct, base, bottles, phrase };
}
