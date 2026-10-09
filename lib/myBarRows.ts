// My Bar as one virtualized list: the screen's sections flattened into
// typed rows, so a big shelf or hundreds of drinks you can make only mount
// what's on screen (components/screens/home/MyBarScreen.tsx).

import { arrangeShelf, type ShelfBottle, type ShelfSort } from './pantry';

export type MakeTab = 'ready' | 'one' | 'two';
/** Drinks and bottle groups listed before "Show more"; a big shelf can make hundreds. */
export const MAKE_PAGE = 25;
/** Bottles shown before "Show all", so the shelf never pushes the drinks off the first screen. */
export const SHELF_FOLDED = 5;

interface Group {
  bottles: { id: string }[];
}

export interface MyBarState<B extends ShelfBottle, D extends { id: string }, G extends Group> {
  /** The shelf's bottles, without the pantry staples. */
  bottles: B[];
  sort: ShelfSort;
  query: string;
  shelfOpen: boolean;
  /** How much is in the sections past the fridge; an empty one folds to a line. */
  more?: { lab: number; preps: number; kit: number };
  /** What the shelf makes, or null before there's anything on it. */
  make: { canMake: D[]; oneAway: G[]; twoAway: G[]; tab: MakeTab; shown: number } | null;
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
  | { kind: 'make-head'; key: string }
  | { kind: 'drink'; key: string; drink: D }
  | { kind: 'group'; key: string; group: G }
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
  if (s.make) {
    const { tab, shown } = s.make;
    rows.push({ kind: 'make-head', key: 'make-head' });
    if (tab === 'ready') {
      for (const d of s.make.canMake.slice(0, shown)) rows.push({ kind: 'drink', key: `d:${d.id}`, drink: d });
    } else {
      for (const g of (tab === 'one' ? s.make.oneAway : s.make.twoAway).slice(0, shown)) rows.push({ kind: 'group', key: groupKey(g), group: g });
    }
    const total = tab === 'ready' ? s.make.canMake.length : (tab === 'one' ? s.make.oneAway : s.make.twoAway).length;
    if (!total) rows.push({ kind: 'make-empty', key: 'make-empty' });
    rows.push({ kind: 'make-foot', key: 'make-foot', more: Math.max(0, total - shown) });
  }
  return rows;
}
