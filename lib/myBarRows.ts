// My Bar as one virtualized list: the screen's sections flattened into
// typed rows, so a big shelf or hundreds of drinks you can make only mount
// what's on screen (components/screens/home/MyBarScreen.tsx).

import { foldName } from './discover';
import { arrangeShelf, type ShelfBottle, type ShelfSort } from './pantry';

export type MakeTab = 'ready' | 'first' | 'one' | 'two' | 'projects';
/** Drinks and bottle groups listed before "Show more"; a big shelf can make hundreds. */
export const MAKE_PAGE = 25;
/** Bottles shown before "Show all", so the shelf never pushes the drinks off the first screen. */
export const SHELF_FOLDED = 5;

/** The sections of a search, which covers every tab but Make first and Projects at once. */
export type Found = 'ready' | 'one' | 'two';

/** A drink, with the shelf rows it uses, so a search finds it by a bottle too. */
interface Drink {
  id: string;
  name: string;
  shelfUses?: string[];
}

/** Bottles to buy, and the drinks they open. */
interface Group<D extends Drink = Drink> {
  bottles: { id: string; name: string }[];
  drinks: D[];
}

export interface MyBarState<B extends ShelfBottle, D extends Drink, G extends Group<D>> {
  /** The shelf's bottles, without the pantry staples. */
  bottles: B[];
  sort: ShelfSort;
  query: string;
  shelfOpen: boolean;
  /** How much is in the sections past the fridge; an empty one folds to a line. */
  more?: { lab: number; preps: number; kit: number };
  /** What the shelf makes, or null before there's anything on it. */
  /**
   * `first`: house preps to make first; `projects`: what the kit and lab shelf
   * allow. Each is a short list, shown whole in one row.
   */
  make: {
    canMake: D[];
    oneAway: G[];
    twoAway: G[];
    first?: number;
    projects?: number;
    tab: MakeTab;
    shown: number;
    /** What to make's search: while it has text, every section's matches replace the tabs. */
    query?: string;
    /** Rows of each section of a search before its "Show more". */
    shownIn?: Partial<Record<Found, number>>;
    /** The shelf, so a drink matches by the bottles it uses. */
    shelf?: { id: string; name: string; kind?: string | null }[];
  } | null;
}

export type MyBarRow<B, D, G> =
  | { kind: 'top'; key: string }
  /** Shortcuts to each section, once there's more than bottles and the fridge. */
  | { kind: 'jump'; key: string }
  | { kind: 'shelf-head'; key: string }
  /** `heading`: the style caption above the first bottle of each style, when sorted by style. */
  | { kind: 'bottle'; key: string; bottle: B; heading: string | null }
  | { kind: 'shelf-foot'; key: string; found: number }
  | { kind: 'pantry'; key: string }
  | { kind: 'lab'; key: string }
  | { kind: 'preps'; key: string }
  | { kind: 'kit'; key: string }
  | { kind: 'folds'; key: string; empty: ('lab' | 'preps' | 'kit')[] }
  /** `found`: while searching, how many drinks match in each section (for the caption that replaces the tabs). */
  | { kind: 'make-head'; key: string; found?: Record<Found, number> }
  /** A search's section title: Ready, One bottle away, Two bottles away. */
  | { kind: 'make-heading'; key: string; section: Found }
  | { kind: 'make-more'; key: string; section: Found; more: number }
  /** A search nothing matches. */
  | { kind: 'make-none'; key: string; query: string }
  | { kind: 'drink'; key: string; drink: D }
  | { kind: 'group'; key: string; group: G }
  | { kind: 'first'; key: string }
  | { kind: 'projects'; key: string }
  | { kind: 'make-empty'; key: string }
  /** `searching`: under a search, so the list keeps its height while results come and go. */
  | { kind: 'make-foot'; key: string; more: number; searching?: boolean };

/** Until the person picks, open on what they can make, or on what's closest when that's nothing. */
export function makeTab(picked: MakeTab | null, make: { canMake: unknown[]; oneAway: unknown[]; twoAway: unknown[] }): MakeTab {
  return picked ?? (make.canMake.length ? 'ready' : make.oneAway.length ? 'one' : make.twoAway.length ? 'two' : 'ready');
}

/** The row a section shortcut scrolls to. */
export const JUMP_ROW = { bottles: 'shelf-head', fridge: 'pantry', lab: 'lab', preps: 'preps', kit: 'kit' } as const;

export const groupKey = (g: { bottles: { id: string }[] }) => `g:${g.bottles.map((b) => b.id).join('+')}`;

/** The rows only a search has, rendered by WhatToMake's MakeSearchRow. */
export type MakeSearchRowData = Extract<MyBarRow<unknown, unknown, unknown>, { kind: 'make-heading' | 'make-more' | 'make-none' }>;

/**
 * What to make, narrowed to a search: a drink matches by its name, by a
 * bottle on the shelf it uses, or by the bottle it's missing. Case and accents
 * don't matter. A group whose bottle matches keeps all its drinks; any other
 * keeps only the drinks that match.
 */
export function searchMake<D extends Drink, G extends Group<D>>(
  make: { canMake: D[]; oneAway: G[]; twoAway: G[] },
  query: string,
  shelf: { id: string; name: string; kind?: string | null }[],
): { ready: D[]; one: G[]; two: G[] } {
  const q = foldName(query);
  const has = (s: string | null | undefined) => !!s && foldName(s).includes(q);
  const onShelf = new Set(shelf.filter((b) => has(b.name) || has(b.kind)).map((b) => b.id));
  const hit = (d: D) => has(d.name) || !!d.shelfUses?.some((id) => onShelf.has(id));
  const away = (groups: G[]) =>
    groups.flatMap((g) => {
      if (g.bottles.some((b) => has(b.name))) return [g];
      const drinks = g.drinks.filter(hit);
      return drinks.length ? [{ ...g, drinks }] : [];
    });
  return { ready: make.canMake.filter(hit), one: away(make.oneAway), two: away(make.twoAway) };
}

/** The line in place of the tabs while searching: "Nothing ready with rye. 3 one bottle away, 1 two away." */
export function searchCaption(query: string, found: Record<Found, number>): string | null {
  const away = [found.one ? `${found.one} one bottle away` : null, found.two ? `${found.two} two away` : null].filter(Boolean);
  if (!found.ready && !away.length) return null;
  if (!found.ready) return `Nothing ready with ${query.trim()}. ${away.join(', ')}.`;
  return `${[`${found.ready} ready`, ...away].join(', ')}.`;
}

function searchRows<B, D extends Drink, G extends Group<D>>(make: NonNullable<MyBarState<ShelfBottle, D, G>['make']>, query: string): MyBarRow<B, D, G>[] {
  const found = searchMake(make, query, make.shelf ?? []);
  const drinks = (groups: G[]) => groups.reduce((n, g) => n + g.drinks.length, 0);
  const rows: MyBarRow<B, D, G>[] = [{ kind: 'make-head', key: 'make-head', found: { ready: found.ready.length, one: drinks(found.one), two: drinks(found.two) } }];
  const section = <T>(name: Found, list: T[], row: (x: T) => MyBarRow<B, D, G>) => {
    if (!list.length) return;
    const shown = make.shownIn?.[name] ?? MAKE_PAGE;
    rows.push({ kind: 'make-heading', key: `h:${name}`, section: name });
    for (const x of list.slice(0, shown)) rows.push(row(x));
    if (list.length > shown) rows.push({ kind: 'make-more', key: `more:${name}`, section: name, more: list.length - shown });
  };
  section('ready', found.ready, (d) => ({ kind: 'drink', key: `d:${d.id}`, drink: d }));
  const group = (g: G): MyBarRow<B, D, G> => ({ kind: 'group', key: groupKey(g), group: g });
  section('one', found.one, group);
  section('two', found.two, group);
  if (rows.length === 1) rows.push({ kind: 'make-none', key: 'make-none', query: query.trim() });
  rows.push({ kind: 'make-foot', key: 'make-foot', more: 0, searching: true });
  return rows;
}

export function myBarRows<B extends ShelfBottle, D extends Drink, G extends Group<D>>(s: MyBarState<B, D, G>): MyBarRow<B, D, G>[] {
  const rows: MyBarRow<B, D, G>[] = [{ kind: 'top', key: 'top' }];
  const more = s.more ?? { lab: 0, preps: 0, kit: 0 };
  const extras = (['lab', 'preps', 'kit'] as const).filter((k) => more[k] > 0);
  if (extras.length) rows.push({ kind: 'jump', key: 'jump' });
  if (s.bottles.length) {
    const arranged = arrangeShelf(s.bottles, s.sort, s.query);
    const shown = s.shelfOpen || s.query.trim() ? arranged : arranged.slice(0, SHELF_FOLDED);
    rows.push({ kind: 'shelf-head', key: 'shelf-head' });
    shown.forEach((b, i) => {
      const heading = s.sort === 'style' && b.kind !== shown[i - 1]?.kind ? (b.kind ?? 'Other') : null;
      rows.push({ kind: 'bottle', key: `b:${b.id}`, bottle: b, heading });
    });
    rows.push({ kind: 'shelf-foot', key: 'shelf-foot', found: arranged.length });
  }
  rows.push({ kind: 'pantry', key: 'pantry' });
  for (const k of extras) rows.push({ kind: k, key: k });
  const empty = (['lab', 'preps', 'kit'] as const).filter((k) => !more[k]);
  if (empty.length) rows.push({ kind: 'folds', key: 'folds', empty });
  if (s.make?.query?.trim()) {
    rows.push(...searchRows<B, D, G>(s.make, s.make.query));
  } else if (s.make) {
    const { tab, shown } = s.make;
    rows.push({ kind: 'make-head', key: 'make-head' });
    const whole = tab === 'first' || tab === 'projects';
    if (whole) {
      if (s.make[tab]) rows.push({ kind: tab, key: tab });
    } else if (tab === 'ready') {
      for (const d of s.make.canMake.slice(0, shown)) rows.push({ kind: 'drink', key: `d:${d.id}`, drink: d });
    } else {
      for (const g of (tab === 'one' ? s.make.oneAway : s.make.twoAway).slice(0, shown)) rows.push({ kind: 'group', key: groupKey(g), group: g });
    }
    const total = whole ? (s.make[tab] ?? 0) : tab === 'ready' ? s.make.canMake.length : (tab === 'one' ? s.make.oneAway : s.make.twoAway).length;
    if (!total) rows.push({ kind: 'make-empty', key: 'make-empty' });
    rows.push({ kind: 'make-foot', key: 'make-foot', more: whole ? 0 : Math.max(0, total - shown) });
  }
  return rows;
}
