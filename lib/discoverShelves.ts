/**
 * Discover's shelves (option B on top of A, Kevin 15 Oct; reordered with Top
 * bars and Top-rated, 24 Oct): short rows over "All drinks near you", each
 * named for its reason, one drink per bar, and none with under three drinks.
 * Pure; checked by lib/discoverShelves.check.ts.
 */
import type { DiscoverDrink } from './discoverDrinks';
import { kindLabel, STYLES } from './drinkStyles';
import { distance, type Profile, type Taste } from './flavor';

/** A shelf with fewer drinks than this is left out. */
export const SHELF_MIN = 3;
/** The most drinks a shelf shows; See all has the rest. */
export const SHELF_MAX = 10;
/** discover_list's first page: the top style counts only these, so it holds still as more load. */
export const FIRST_PAGE = 30;

const ZERO = 'zero-proof';
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export interface Shelf {
  key: string;
  title: string;
  note: string;
  /** See all: the filter that lists all of them; none for the first shelf (the list below is that). */
  kind: string | null;
  drinks: DiscoverDrink[];
  /** Picked for the viewer's taste: the note shows their palate and opens the taste page. */
  taste?: boolean;
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
 * The closest drink at each bar, nearest your taste first. A drink with no
 * profile sorts after the ones that have one, in the order given.
 */
export function byTaste(drinks: readonly DiscoverDrink[], taste: Taste, profiles: Readonly<Record<string, Profile>>): DiscoverDrink[] {
  const ranked = drinks
    .map((d, i) => ({ d, i, gap: profiles[d.id] ? distance(taste, profiles[d.id]) : 2 }))
    .sort((a, b) => a.gap - b.gap || a.i - b.i)
    .map((row) => row.d);
  return onePerBar(ranked);
}

/**
 * The style the most bars here pour, from the first page of drinks, so long
 * as at least SHELF_MIN bars pour it; ties go to the chips' order. Zero-proof
 * has its own shelf. ponytail: counts the mixed list's first page; the
 * upgrade is a per-style bar count from the server.
 */
export function topStyle(drinks: readonly DiscoverDrink[]): string | null {
  const bars = barsPerStyle(drinks);
  let best: string | null = null;
  let most = SHELF_MIN - 1;
  for (const { id } of STYLES) {
    const n = id === ZERO ? 0 : (bars.get(id) ?? 0);
    if (n > most) [best, most] = [id, n];
  }
  return best;
}

/**
 * The map's drink chips (disc-maps-habits): every style a bar here pours, the
 * most bars first, ties in the chips' order. Counts the first page, as topStyle.
 */
export function stylesByBars(drinks: readonly DiscoverDrink[]): string[] {
  const bars = barsPerStyle(drinks);
  return STYLES.filter((s) => bars.has(s.id))
    .sort((a, b) => bars.get(b.id)! - bars.get(a.id)!)
    .map((s) => s.id);
}

/** The chips to show: the ones on first, then the rest in `order` (the last unfiltered stylesByBars), at most `max` in all. */
export function chipIds(kinds: readonly string[], order: readonly string[], max = Infinity): string[] {
  const rest = order.filter((id) => !kinds.includes(id));
  return [...kinds, ...rest.slice(0, Math.max(0, max - kinds.length))];
}

/** How many bars pour each style, from the first page. */
function barsPerStyle(drinks: readonly DiscoverDrink[]): Map<string, number> {
  const bars = new Map<string, Set<string>>();
  for (const d of drinks.slice(0, FIRST_PAGE)) {
    for (const s of d.styles ?? []) {
      if (!bars.has(s)) bars.set(s, new Set());
      bars.get(s)!.add(d.barId);
    }
  }
  return new Map([...bars].map(([s, set]) => [s, set.size]));
}

/** "Martinis, five ways". */
export function waysTitle(style: string, n: number): string {
  return `${kindLabel(style)}, ${WORDS[n] ?? n} ways`;
}

/**
 * The drinks people have scored, best first, one per bar: the Top-rated
 * shelf. ponytail: scores the mixed list's first page, so it's the best of
 * what loaded; the upgrade is discover_list ordered by score.
 */
export function topRated(drinks: readonly DiscoverDrink[], scores: Readonly<Record<string, number>>): DiscoverDrink[] {
  return onePerBar([...drinks].filter((d) => scores[d.id] !== undefined).sort((a, b) => scores[b.id] - scores[a.id]));
}

/**
 * The shelves to show, in order, each one drink per bar, leaving out any
 * under SHELF_MIN (disc-map-browse, approved 24 Oct): menus around you (For
 * your taste once you have one), top-rated, the style most bars pour, then
 * Low & no. Top bars sits after the first; it's bars, so the screen adds it.
 * `where`: "near you", "in Brooklyn". `around`: the mixed list; `rated`: its
 * scored drinks (topRated); `styled`: `style`'s drinks here; `zero`: Low & no.
 */
export function pickShelves({ where, around, rated = [], style, styled, zero }: { where: string; around: readonly DiscoverDrink[]; rated?: readonly DiscoverDrink[]; style: string | null; styled: readonly DiscoverDrink[]; zero: readonly DiscoverDrink[] }): Shelf[] {
  const near = where === 'near you';
  const ways = style ? onePerBar(styled) : [];
  const shelves: Shelf[] = [
    { key: 'around', title: `On menus ${near ? 'around you' : where}`, note: 'One from each bar', kind: null, drinks: onePerBar(around) },
    { key: 'rated', title: `Top-rated ${near ? 'around you' : where}`, note: 'Scored by the people who ranked them', kind: null, drinks: [...rated] },
    { key: 'style', title: style ? waysTitle(style, ways.length) : '', note: `The style poured most ${near ? 'around here' : where}`, kind: style, drinks: ways },
    { key: 'zero', title: `Low & no ${where}`, note: 'From bars here that pour one', kind: ZERO, drinks: onePerBar(zero) },
  ];
  return shelves.filter((s) => s.drinks.length >= SHELF_MIN);
}
