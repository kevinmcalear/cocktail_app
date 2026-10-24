/**
 * The history timeline: the family tree's drinks and styles laid out by year
 * in six eras. Pure, so grouping, scales and summaries are checked without a
 * database (lib/timeline.check.ts). The nodes come from hooks/useDrinkTree.ts.
 */
import { pathTo, type TreeNode } from '@/lib/drinkTree';
import { yearLabel } from '@/lib/lineage';

export const ERAS = [
  { key: 'punch', name: 'Punch', start: 1630, blurb: 'Spirit, sugar, citrus and spice, shared from a bowl.' },
  { key: 'early', name: 'Early American', start: 1800, blurb: 'Slings, toddies and juleps, then bitters: the first cocktail.' },
  { key: 'golden', name: 'Golden age', start: 1860, blurb: 'Bar books print the cocktail. Jerry Thomas in 1862, then the Manhattan, the Martinez and the Martini.' },
  { key: 'prohibition', name: 'Prohibition', start: 1920, blurb: "America goes dry. The era's new drinks are poured in London, Paris and Havana." },
  { key: 'tiki', name: 'Tiki and post-war', start: 1934, blurb: 'Donn Beach and Trader Vic build tiki in California. Vodka arrives in the highball.' },
  { key: 'craft', name: 'Craft revival', start: 1987, blurb: 'Fresh juice and the old books again, and a new run of modern classics.' },
] as const;

export type Era = (typeof ERAS)[number];
export type EraKey = Era['key'];

/** The last year the scales reach. */
export const NOW = 2026;
/** Share of an overview's width each era gets: busy eras wide, the long punch-bowl centuries narrow. */
const ERA_WIDTH = [50, 90, 240, 90, 160, 150];
const WIDTH_TOTAL = ERA_WIDTH.reduce((a, b) => a + b, 0);

export function eraOf(year: number): Era {
  return [...ERAS].reverse().find((e) => year >= e.start) ?? ERAS[0];
}

/** Where a year sits on an era-weighted scale, from 0 (1630) to 1 (now). */
export function eraX(year: number): number {
  let left = 0;
  for (let i = 0; i < ERAS.length; i++) {
    const end = ERAS[i + 1]?.start ?? NOW + 1;
    if (year < end || i === ERAS.length - 1) {
      const t = Math.min(1, Math.max(0, (year - ERAS[i].start) / (end - ERAS[i].start)));
      return (left + t * ERA_WIDTH[i]) / WIDTH_TOTAL;
    }
    left += ERA_WIDTH[i];
  }
  return 1;
}

/** The year at a point on the era-weighted scale (the inverse of eraX). */
export function yearAt(x: number): number {
  const target = Math.min(1, Math.max(0, x)) * WIDTH_TOTAL;
  let left = 0;
  for (let i = 0; i < ERAS.length; i++) {
    const end = ERAS[i + 1]?.start ?? NOW + 1;
    if (target <= left + ERA_WIDTH[i] || i === ERAS.length - 1) {
      return Math.min(NOW, Math.round(ERAS[i].start + ((target - left) / ERA_WIDTH[i]) * (end - ERAS[i].start)));
    }
    left += ERA_WIDTH[i];
  }
  return NOW;
}

/** Each era's start and width on the same scale, for drawing its band. */
export function eraBands(): { era: Era; x: number; w: number }[] {
  let left = 0;
  return ERAS.map((era, i) => {
    const band = { era, x: left / WIDTH_TOTAL, w: ERA_WIDTH[i] / WIDTH_TOTAL };
    left += ERA_WIDTH[i];
    return band;
  });
}

export interface TimelineFilter {
  /** A family key, or null for every family. */
  family: string | null;
  /** Show historic styles (Punch, Sling, Sour) as well as drinks. */
  styles: boolean;
  /** A spirit id (lib/drinkStyles SPIRITS), or null for any. */
  spirit?: string | null;
  /** A city or a bar's name, or null for anywhere. */
  place?: string | null;
}

export interface TimelineRow {
  node: TreeNode;
  /** What it came from, in any family, for "Riff of Manhattan, 1882". */
  from: TreeNode | null;
  /** Its printed year ("c.1880", "1930s") differs from the row above's, so it is printed. */
  newYear: boolean;
  /** A fold in a followed thread: this many drinks off the thread, starting at `node`, drawn as one dashed stretch. */
  folded?: number;
}

export interface TimelineSection {
  /** The era's key, so lists can key the section. */
  key: string;
  era: Era;
  /** Drinks (not styles) in this era that pass the filter. */
  drinks: number;
  data: TimelineRow[];
}

const byYear = (a: TreeNode, b: TreeNode) => (a.year ?? 0) - (b.year ?? 0) || (a.kind === b.kind ? 0 : a.kind === 'style' ? -1 : 1) || a.name.localeCompare(b.name);

function passes(n: TreeNode, filter: TimelineFilter): boolean {
  if (n.kind === 'style') return filter.styles && (!filter.family || n.family === filter.family || n.family === 'trunk');
  if (filter.family && n.family !== filter.family) return false;
  if (filter.spirit && !n.spirits.includes(filter.spirit)) return false;
  return !filter.place || n.city === filter.place || n.bar === filter.place;
}

/** Cities, then bars, that first poured a drink, most drinks first: the Bar or city menu. */
export function placeOptions(nodes: readonly TreeNode[]): { kind: 'city' | 'bar'; name: string; count: number }[] {
  const tally = (pick: (n: TreeNode) => string | null) => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
      const v = n.kind === 'drink' ? pick(n) : null;
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  return [
    ...tally((n) => n.city).map(([name, count]) => ({ kind: 'city' as const, name, count })),
    ...tally((n) => n.bar).map(([name, count]) => ({ kind: 'bar' as const, name, count })),
  ];
}

/** Dated nodes, oldest first, one section per era that has any. Undated ones are left out (see undatedCount). */
export function timelineSections(nodes: readonly TreeNode[], filter: TimelineFilter): TimelineSection[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const dated = nodes.filter((n) => n.year != null && passes(n, filter)).sort(byYear);
  const sections: TimelineSection[] = [];
  let lastYear: string | null = null;
  for (const n of dated) {
    const era = eraOf(n.year!);
    let section = sections.at(-1);
    if (section?.era.key !== era.key) {
      section = { key: era.key, era, drinks: 0, data: [] };
      sections.push(section);
      lastYear = null;
    }
    section.data.push({ node: n, from: n.parentKey ? (byKey.get(n.parentKey) ?? null) : null, newYear: shortYear(n) !== lastYear });
    if (n.kind === 'drink') section.drinks++;
    lastYear = shortYear(n);
  }
  return sections;
}

export function undatedCount(nodes: readonly TreeNode[], filter: TimelineFilter): number {
  return nodes.filter((n) => n.year == null && n.kind === 'drink' && passes(n, filter)).length;
}

export const FIRST_DECADE = 1630;
export const DECADES = Math.floor(NOW / 10) - FIRST_DECADE / 10 + 1;

/** Dated drinks per decade, 1630s to now, for the era bar's histogram. */
export function decadeCounts(nodes: readonly TreeNode[], filter: TimelineFilter): number[] {
  const counts = Array.from({ length: DECADES }, () => 0);
  for (const n of nodes) {
    if (n.year == null || n.kind !== 'drink' || !passes(n, filter)) continue;
    const i = Math.floor(n.year / 10) - FIRST_DECADE / 10;
    if (i >= 0 && i < DECADES) counts[i]++;
  }
  return counts;
}

/** The section and row to scroll to for a year: the first row in or after it, else the last row. */
export function locate(sections: readonly TimelineSection[], year: number): { sectionIndex: number; itemIndex: number } | null {
  for (let s = 0; s < sections.length; s++) {
    const i = sections[s].data.findIndex((r) => (r.node.year ?? 0) >= year);
    if (i >= 0) return { sectionIndex: s, itemIndex: i };
  }
  const s = sections.length - 1;
  return s >= 0 ? { sectionIndex: s, itemIndex: sections[s].data.length - 1 } : null;
}

/** Where a node's row is, for focusing it. */
export function locateKey(sections: readonly TimelineSection[], key: string): { sectionIndex: number; itemIndex: number } | null {
  for (let s = 0; s < sections.length; s++) {
    const i = sections[s].data.findIndex((r) => r.node.key === key);
    if (i >= 0) return { sectionIndex: s, itemIndex: i };
  }
  return null;
}

/** Off-thread runs this long or longer fold away while a thread is followed. */
export const FOLD_MIN = 3;

/**
 * Following a thread (board prep-hist-timeline-thread): between the thread's
 * first and last steps, each era's runs of FOLD_MIN or more drinks off the
 * thread fold into one row, so the steps sit close enough to read as a line.
 * Shorter runs stay, dimmed. The row after a fold prints its year.
 */
export function foldThread(sections: readonly TimelineSection[], lit: ReadonlySet<string>): TimelineSection[] {
  const at = sections.flatMap((sec) => sec.data.map((r) => lit.has(r.node.key)));
  const first = at.indexOf(true);
  const last = at.lastIndexOf(true);
  if (first < 0 || first === last) return [...sections];
  let i = 0;
  return sections.map((sec) => {
    const data: TimelineRow[] = [];
    let run: TimelineRow[] = [];
    let afterFold = false;
    const flush = () => {
      if (run.length >= FOLD_MIN) data.push({ node: run[0].node, from: null, newYear: false, folded: run.length });
      else data.push(...run);
      afterFold = run.length >= FOLD_MIN;
      run = [];
    };
    for (const r of sec.data) {
      const n = i++;
      if (n > first && n < last && !at[n]) {
        run.push(r);
        continue;
      }
      flush();
      data.push(afterFold ? { ...r, newYear: true } : r);
      afterFold = false;
    }
    flush();
    return { ...sec, data };
  });
}

/** A drink's line back to the punch bowl, oldest first. */
export function thread(nodes: readonly TreeNode[], key: string): TreeNode[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  return pathTo(nodes, key)
    .map((k) => byKey.get(k))
    .filter((n): n is TreeNode => !!n);
}

/**
 * "143 years back to Whiskey Sour, 1862": from a thread's drink to its
 * nearest classic ancestor (a dated drink that isn't a modern classic), else
 * to the oldest dated step. Null when there's nothing dated to count to.
 */
export function threadBack(line: readonly TreeNode[]): string | null {
  const last = line.at(-1);
  if (!last || last.year == null) return null;
  const before = line.slice(0, -1).filter((n) => n.year != null);
  const to = [...before].reverse().find((n) => n.kind === 'drink' && !n.modern) ?? before[0];
  if (!to || to.year == null) return null;
  const years = last.year - to.year;
  return years > 0 ? `${years} years back to ${to.name}, ${shortYear(to)}` : null;
}

/** "c.1880", "1880", or a best guess's decade ("1930s"), to squeeze into the year column. */
export function shortYear(n: Pick<TreeNode, 'year' | 'approx' | 'guess'>): string {
  if (n.year == null) return '';
  return n.guess ? `${Math.floor(n.year / 10) * 10}s` : `${n.approx ? 'c.' : ''}${n.year}`;
}

/** "Riff of Manhattan, 1882", a style's riffs too ("Riff of Swizzle, 1840", board prep-hist-timeline-phone). */
export function fromLine(row: Pick<TimelineRow, 'from'>): string | null {
  const f = row.from;
  if (!f) return null;
  const year = yearLabel(f.year, f.approx, f.guess);
  return `Riff of ${f.name}${year ? `, ${year}` : ''}`;
}
