// My Bar as one virtualized list: the screen's sections flattened into
// typed rows, so a big shelf or hundreds of drinks you can make only mount
// what's on screen (components/screens/home/MyBarScreen.tsx).

import { arrangeShelf, type ShelfBottle, type ShelfSort } from './pantry';

export type MakeTab = 'ready' | 'first' | 'one' | 'two' | 'projects';
/** Drinks and bottle groups listed before "Show more"; a big shelf can make hundreds. */
export const MAKE_PAGE = 25;
/** Rows of bottle tiles shown before "Show all", so the shelf never pushes the drinks off the first screen. */
export const SHELF_FOLDED_ROWS = 2;

interface Group {
  bottles: { id: string }[];
}

export interface MyBarState<B extends ShelfBottle, D extends { id: string }, G extends Group> {
  /** The shelf's bottles, without the pantry staples. */
  bottles: B[];
  sort: ShelfSort;
  query: string;
  shelfOpen: boolean;
  /** Tiles to a row: the bottles are listed a row of tiles at a time. */
  cols: number;
  /** How much is in the sections past the fridge; an empty one folds to a line. */
  more?: { lab: number; preps: number; kit: number };
  /** What the shelf makes, or null before there's anything on it. */
  /**
   * `first`: house preps to make first; `projects`: what the kit and lab shelf
   * allow. Each is a short list, shown whole in one row.
   */
  make: { canMake: D[]; oneAway: G[]; twoAway: G[]; first?: number; projects?: number; tab: MakeTab; shown: number } | null;
}

export type MyBarRow<B, D, G> =
  | { kind: 'top'; key: string }
  /** Shortcuts to each section, once there's more than bottles and the fridge. */
  | { kind: 'jump'; key: string }
  | { kind: 'shelf-head'; key: string }
  /** One row of bottle tiles. `heading`: the style caption above it, when sorted by style and a style starts here. */
  | { kind: 'bottles'; key: string; bottles: B[]; heading: string | null }
  | { kind: 'shelf-foot'; key: string; found: number }
  | { kind: 'pantry'; key: string }
  | { kind: 'lab'; key: string }
  | { kind: 'preps'; key: string }
  | { kind: 'kit'; key: string }
  | { kind: 'folds'; key: string; empty: ('lab' | 'preps' | 'kit')[] }
  | { kind: 'make-head'; key: string }
  | { kind: 'drink'; key: string; drink: D }
  | { kind: 'group'; key: string; group: G }
  | { kind: 'first'; key: string }
  | { kind: 'projects'; key: string }
  | { kind: 'make-empty'; key: string }
  | { kind: 'make-foot'; key: string; more: number };

/** Until the person picks, open on what they can make, or on what's closest when that's nothing. */
export function makeTab(picked: MakeTab | null, make: { canMake: unknown[]; oneAway: unknown[]; twoAway: unknown[] }): MakeTab {
  return picked ?? (make.canMake.length ? 'ready' : make.oneAway.length ? 'one' : make.twoAway.length ? 'two' : 'ready');
}

/** The row a section shortcut scrolls to. */
export const JUMP_ROW = { bottles: 'shelf-head', fridge: 'pantry', lab: 'lab', preps: 'preps', kit: 'kit' } as const;

export const groupKey = (g: Group) => `g:${g.bottles.map((b) => b.id).join('+')}`;

export function myBarRows<B extends ShelfBottle, D extends { id: string }, G extends Group>(s: MyBarState<B, D, G>): MyBarRow<B, D, G>[] {
  const rows: MyBarRow<B, D, G>[] = [{ kind: 'top', key: 'top' }];
  const more = s.more ?? { lab: 0, preps: 0, kit: 0 };
  const extras = (['lab', 'preps', 'kit'] as const).filter((k) => more[k] > 0);
  if (extras.length) rows.push({ kind: 'jump', key: 'jump' });
  if (s.bottles.length) {
    const arranged = arrangeShelf(s.bottles, s.sort, s.query);
    const cols = Math.max(1, s.cols);
    const shown = s.shelfOpen || s.query.trim() ? arranged : arranged.slice(0, SHELF_FOLDED_ROWS * cols);
    rows.push({ kind: 'shelf-head', key: 'shelf-head' });
    // A row is full, or ends where the next style starts.
    let row: B[] = [];
    let heading: string | null = null;
    const flush = () => {
      if (row.length) rows.push({ kind: 'bottles', key: `b:${row[0].id}`, bottles: row, heading });
      row = [];
      heading = null;
    };
    shown.forEach((b, i) => {
      const starts = s.sort === 'style' && (i === 0 || b.kind !== shown[i - 1].kind);
      if (starts || row.length === cols) flush();
      if (starts) heading = b.kind ?? 'Other';
      row.push(b);
    });
    flush();
    rows.push({ kind: 'shelf-foot', key: 'shelf-foot', found: arranged.length });
  }
  rows.push({ kind: 'pantry', key: 'pantry' });
  for (const k of extras) rows.push({ kind: k, key: k });
  const empty = (['lab', 'preps', 'kit'] as const).filter((k) => !more[k]);
  if (empty.length) rows.push({ kind: 'folds', key: 'folds', empty });
  if (s.make) {
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
