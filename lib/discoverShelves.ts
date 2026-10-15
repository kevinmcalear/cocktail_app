/**
 * Discover's shelves (option B on top of A, Kevin 15 Oct): short rows over
 * "All drinks near you", each named for its reason, one drink per bar, and
 * none with under three drinks. Pure; checked by lib/discoverShelves.check.ts.
 */
import type { DiscoverDrink } from './discoverDrinks';
import { kindLabel, STYLES } from './drinkStyles';

/** A shelf with fewer drinks than this is left out. */
export const SHELF_MIN = 3;
/** The most drinks a shelf shows; See all has the rest. */
export const SHELF_MAX = 10;

const ZERO = 'zero-proof';
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export interface Shelf {
  key: string;
  title: string;
  note: string;
  /** See all: the filter that lists all of them; none for the first shelf (the list below is that). */
  kind: string | null;
  drinks: DiscoverDrink[];
}

/** The first drink from each bar, in the order given, up to `max`. */
export function onePerBar(drinks: readonly DiscoverDrink[], max = SHELF_MAX): DiscoverDrink[] {
  const seen = new Set<string>();
  const out: DiscoverDrink[] = [];
  for (const d of drinks) {
    if (out.length >= max) break;
    if (seen.has(d.barId)) continue;
    seen.add(d.barId);
    out.push(d);
  }
  return out;
}

/**
 * The style the most bars here pour, from the drinks loaded so far, so long
 * as at least SHELF_MIN bars pour it; ties go to the chips' order. Zero-proof
 * has its own shelf. ponytail: counts the mixed list's first page; the
 * upgrade is a per-style bar count from the server.
 */
export function topStyle(drinks: readonly DiscoverDrink[]): string | null {
  const bars = new Map<string, Set<string>>();
  for (const d of drinks) {
    for (const s of d.styles ?? []) {
      if (s === ZERO) continue;
      if (!bars.has(s)) bars.set(s, new Set());
      bars.get(s)!.add(d.barId);
    }
  }
  let best: string | null = null;
  let most = SHELF_MIN - 1;
  for (const { id } of STYLES) {
    const n = bars.get(id)?.size ?? 0;
    if (n > most) [best, most] = [id, n];
  }
  return best;
}

/** "Martinis, five ways". */
export function waysTitle(style: string, n: number): string {
  return `${kindLabel(style)}, ${WORDS[n] ?? n} ways`;
}

/**
 * The shelves to show, in order, each one drink per bar, leaving out any
 * under SHELF_MIN. `where`: "near you", "in Brooklyn". `around`: the mixed
 * list; `styled`: `style`'s drinks here, mixed; `zero`: the zero-proof ones.
 */
export function pickShelves({ where, around, style, styled, zero }: { where: string; around: readonly DiscoverDrink[]; style: string | null; styled: readonly DiscoverDrink[]; zero: readonly DiscoverDrink[] }): Shelf[] {
  const near = where === 'near you';
  const ways = style ? onePerBar(styled) : [];
  const shelves: Shelf[] = [
    { key: 'around', title: `On menus ${near ? 'around you' : where}`, note: 'One from each bar, nearest first', kind: null, drinks: onePerBar(around) },
    { key: 'style', title: style ? waysTitle(style, ways.length) : '', note: `The style poured most ${near ? 'around here' : where}`, kind: style, drinks: ways },
    { key: 'zero', title: `Zero-proof ${where}`, note: 'Every bar here that pours one', kind: ZERO, drinks: onePerBar(zero) },
  ];
  return shelves.filter((s) => s.drinks.length >= SHELF_MIN);
}
