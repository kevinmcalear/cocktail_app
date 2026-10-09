/**
 * "Make it house" on a drink's line: the bottle you'd reach for, then what
 * you did to it. Which techniques can change a line, and the nudge when the
 * drink's own name already says ("Coconut Fat-Washed Daiquiri"). Pure: the
 * wizard (IngredientsStep) opens the prep builder from these.
 */
import { capitalize } from '@/lib/stringUtils';
import { TECHNIQUES, type Technique } from '@/lib/techniques';
import { FITS, startsFrom, waysToMake } from '@/lib/techniques/makeIt';
import { splitName } from '@/lib/techniques/template';
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

