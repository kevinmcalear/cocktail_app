/**
 * History's Tree view as drawn on the canvas (prep-hist-tree-*): every family
 * on one horizontal time axis, each drink a mark at its year, lines from parent
 * to riff. Pure, so the scale, the order and the parent links are checked
 * without a database (lib/timeTree.check.ts). Nodes come from hooks/useDrinkTree.ts.
 */
import { FAMILIES, familyRows, type TreeNode } from './drinkTree';
import { ERAS, NOW } from './timeline';

export type Tier = 'style' | 'classic' | 'modern';

/** Square for a historic style, a filled dot for a classic, a ring for a modern classic. */
export function tierOf(n: Pick<TreeNode, 'kind' | 'modern'>): Tier {
  return n.kind === 'style' ? 'style' : n.modern ? 'modern' : 'classic';
}

export const TIER_LABEL: Record<Tier, string> = { style: 'Historic style', classic: 'Classic', modern: 'Modern classic' };

/** The board's stops: the long punch-bowl centuries narrow, the busy 1850 to 2000 wide. */
const STOPS: readonly [number, number][] = [
  [1630, 0],
  [1800, 0.09],
  [1850, 0.17],
  [1900, 0.38],
  [1935, 0.53],
  [1980, 0.67],
  [2000, 0.8],
  [NOW, 1],
];
/** A little room at both ends, so the first and last marks aren't cut. */
const PAD = 0.015;
const SPAN = 0.96;

/** Where a year sits across the chart, from 0 to 1. */
export function axisX(year: number): number {
  for (let i = 1; i < STOPS.length; i++) {
    if (year <= STOPS[i][0]) {
      const [y0, p0] = STOPS[i - 1];
      const [y1, p1] = STOPS[i];
      return PAD + (p0 + ((Math.max(year, y0) - y0) / (y1 - y0)) * (p1 - p0)) * SPAN;
    }
  }
  return PAD + SPAN;
}

/** Era bands across the chart. "Dry" is Prohibition: its band is too narrow for the long name. */
export function axisEras(): { key: string; name: string; x: number; w: number }[] {
  return ERAS.map((e, i) => {
    const end = ERAS[i + 1]?.start ?? NOW;
    const x = axisX(e.start);
    return { key: e.key, name: e.key === 'prohibition' ? 'Dry' : e.name, x, w: axisX(end) - x };
  });
}

export const AXIS_TICKS = [1700, 1800, 1850, 1900, 1920, 1940, 1960, 1980, 2000, 2020] as const;

export interface AxisRow {
  node: TreeNode;
  tier: Tier;
  /** 0 to 1 across the chart. */
  x: number;
  /** The row of its parent in this family, for the elbow line; null at a root. */
  parentRow: number | null;
  /** Its parent lives in another family ("from Sour"). */
  from: TreeNode | null;
  /** No year of its own: drawn at its parent's. */
  undated: boolean;
}

export interface AxisFamily {
  key: string;
  name: string;
  blurb: string;
  /** Drinks (not styles) in the family, whatever the filter. */
  drinks: number;
  rows: AxisRow[];
}

const TRUNK = { key: 'trunk', name: 'The trunk', blurb: 'Punch, the shared ancestor.' };

/**
 * Every family's rows, parent first (the family tree's order), each with its
 * place on the axis. `modernOnly` keeps the modern classics; a line is drawn
 * only when the parent is shown too. Families left empty are dropped.
 */
export function axisFamilies(nodes: readonly TreeNode[], { modernOnly = false }: { modernOnly?: boolean } = {}): AxisFamily[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const yearOf = (n: TreeNode | undefined): number | null => {
    for (let i = 0; n && i < 50; i++) {
      if (n.year != null) return n.year;
      n = n.parentKey ? byKey.get(n.parentKey) : undefined;
    }
    return null;
  };
  const groups = [...(nodes.some((n) => n.family === 'trunk') ? [TRUNK] : []), ...FAMILIES];
  return groups
    .map((f) => {
      const all = familyRows(nodes, f.key);
      const shown = modernOnly ? all.filter((r) => r.node.modern) : all;
      const index = new Map(shown.map((r, i) => [r.node.key, i]));
      const rows: AxisRow[] = shown.map((r) => {
        const year = yearOf(r.node) ?? ERAS[0].start;
        const parentRow = r.node.parentKey ? (index.get(r.node.parentKey) ?? null) : null;
        return { node: r.node, tier: tierOf(r.node), x: axisX(year), parentRow, from: r.from, undated: r.node.year == null };
      });
      return { key: f.key, name: f.name, blurb: f.blurb, drinks: all.filter((r) => r.node.kind === 'drink').length, rows };
    })
    .filter((f) => f.rows.length > 0);
}

/** "Punch, 1632, to now · 390 classics · 25 styles": the header's eyebrow. */
export function historyEyebrow(nodes: readonly TreeNode[]): string {
  const drinks = nodes.filter((n) => n.kind === 'drink').length;
  const styles = nodes.length - drinks;
  const first = nodes.reduce<TreeNode | null>((a, n) => (n.year != null && (a == null || n.year < (a.year ?? Infinity)) ? n : a), null);
  return [first ? `${first.name}, ${first.year}, to now` : null, drinks ? `${drinks} classics` : null, styles ? `${styles} styles` : null].filter(Boolean).join(' · ');
}
