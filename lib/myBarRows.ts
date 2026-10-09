// My Bar as one virtualized list: the screen's sections flattened into
// typed rows, so a big shelf or hundreds of drinks you can make only mount
// what's on screen (components/screens/home/MyBarScreen.tsx).

import { foldName } from './discover';
import { arrangeShelf, type ShelfBottle, type ShelfSort } from './pantry';

export type MakeTab = 'ready' | 'first' | 'one' | 'two' | 'projects';
/** Drinks and bottle groups listed before "Show more"; a big shelf can make hundreds. */
export const MAKE_PAGE = 25;
/** Rows of bottle tiles shown before "Show all", so the shelf never pushes the drinks off the first screen. */
export const SHELF_FOLDED_ROWS = 2;

/** My Bar's sections, in the order they're listed. */
export const SHELF_SECTIONS = ['bottles', 'fridge', 'lab', 'preps', 'kit'] as const;
export type ShelfSection = (typeof SHELF_SECTIONS)[number];

/**
 * A tap on a section filter: All shows everything again; a section on its own
 * the first time, then each tap adds or drops one. Dropping the last is All.
 */
export function pickSection(shown: readonly ShelfSection[], tapped: ShelfSection | 'all'): ShelfSection[] {
  if (tapped === 'all') return [];
  return shown.includes(tapped) ? shown.filter((s) => s !== tapped) : [...shown, tapped];
}

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
  /** Taking bottles off: no Add tile, so the bottles close up. */
  editing?: boolean;
  /** Tiles to a row: the bottles are listed a row of tiles at a time. */
  cols: number;
  /** How much is in the sections past the bottles; an empty one past the fridge folds to a line. */
  more?: { fridge?: number; lab: number; preps: number; kit: number };
  /** The sections picked in the filter; none picked shows them all. */
  show?: readonly ShelfSection[];
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
  /** The section filter, once two sections have something in them. */
  | { kind: 'filters'; key: string }
  | { kind: 'shelf-head'; key: string }
  /**
   * One row of bottle tiles. `heading`: the style caption above it, when sorted by style and a style starts here.
   * `add`: the row opens with the Add tile.
   */
  | { kind: 'bottles'; key: string; bottles: B[]; heading: string | null; add?: boolean }
  /** `foldable`: there are more bottles than the folded shelf shows, so it offers Show all / Show fewer. */
  | { kind: 'shelf-foot'; key: string; found: number; foldable: boolean }
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
  const sizes: Record<ShelfSection, number> = { bottles: s.bottles.length, fridge: more.fridge ?? 0, lab: more.lab, preps: more.preps, kit: more.kit };
  // A pick whose section has since emptied is dropped; nothing left picked is everything.
  const picked = (s.show ?? []).filter((k) => sizes[k] > 0);
  const on = (k: ShelfSection) => !picked.length || picked.includes(k);
  if (SHELF_SECTIONS.filter((k) => sizes[k] > 0).length > 1) rows.push({ kind: 'filters', key: 'filters' });
  const extras = (['lab', 'preps', 'kit'] as const).filter((k) => more[k] > 0 && on(k));
  if (s.bottles.length && on('bottles')) {
    const arranged = arrangeShelf(s.bottles, s.sort, s.query);
    const cols = Math.max(1, s.cols);
    const searching = !!s.query.trim();
    // The Add tile takes the first place, except under a search or while editing; by style it gets a row of its own.
    const add = !searching && !s.editing;
    const fold = SHELF_FOLDED_ROWS * cols - (add && s.sort !== 'style' ? 1 : 0);
    // Picking Bottles in the filter is asking for the whole shelf.
    const shown = s.shelfOpen || searching || picked.length ? arranged : arranged.slice(0, fold);
    rows.push({ kind: 'shelf-head', key: 'shelf-head' });
    // A row is full, or ends where the next style starts.
    let row: B[] = [];
    let heading: string | null = null;
    let first = add;
    const flush = () => {
      if (row.length || first) rows.push({ kind: 'bottles', key: first ? 'b:add' : `b:${row[0].id}`, bottles: row, heading, ...(first ? { add: true } : {}) });
      row = [];
      heading = null;
      first = false;
    };
    shown.forEach((b, i) => {
      const starts = s.sort === 'style' && (i === 0 || b.kind !== shown[i - 1].kind);
      if (starts || row.length === cols - (first ? 1 : 0)) flush();
      if (starts) heading = b.kind ?? 'Other';
      row.push(b);
    });
    flush();
    rows.push({ kind: 'shelf-foot', key: 'shelf-foot', found: arranged.length, foldable: !searching && !picked.length && arranged.length > fold });
  }
  if (on('fridge')) rows.push({ kind: 'pantry', key: 'pantry' });
  for (const k of extras) rows.push({ kind: k, key: k });
  const empty = (['lab', 'preps', 'kit'] as const).filter((k) => !more[k]);
  if (empty.length && !picked.length) rows.push({ kind: 'folds', key: 'folds', empty });
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
