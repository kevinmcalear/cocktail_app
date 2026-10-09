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
}

export interface TimelineRow {
  node: TreeNode;
  /** What it came from, in any family, for "Riff of Manhattan, 1882". */
  from: TreeNode | null;
  /** Its year differs from the row above, so the year is printed. */
  newYear: boolean;
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
  if (n.kind === 'style' && !filter.styles) return false;
  return !filter.family || n.family === filter.family || (n.kind === 'style' && n.family === 'trunk');
}

/** Dated nodes, oldest first, one section per era that has any. Undated ones are left out (see undatedCount). */
export function timelineSections(nodes: readonly TreeNode[], filter: TimelineFilter): TimelineSection[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const dated = nodes.filter((n) => n.year != null && passes(n, filter)).sort(byYear);
  const sections: TimelineSection[] = [];
  let lastYear: number | null = null;
  for (const n of dated) {
    const era = eraOf(n.year!);
    let section = sections.at(-1);
    if (section?.era.key !== era.key) {
      section = { key: era.key, era, drinks: 0, data: [] };
      sections.push(section);
      lastYear = null;
    }
    section.data.push({ node: n, from: n.parentKey ? (byKey.get(n.parentKey) ?? null) : null, newYear: n.year !== lastYear });
    if (n.kind === 'drink') section.drinks++;
    lastYear = n.year;
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

/** A drink's line back to the punch bowl, oldest first. */
export function thread(nodes: readonly TreeNode[], key: string): TreeNode[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  return pathTo(nodes, key)
    .map((k) => byKey.get(k))
    .filter((n): n is TreeNode => !!n);
}

/** "c. 1880" or "1880" for a row; "c.1880" squeezes into the year column. */
export function shortYear(n: Pick<TreeNode, 'year' | 'approx'>): string {
  return n.year == null ? '' : `${n.approx ? 'c.' : ''}${n.year}`;
}

/** "Riff of Manhattan, 1882", or "From Sour" for a style. */
export function fromLine(row: Pick<TimelineRow, 'from'>): string | null {
  const f = row.from;
  if (!f) return null;
  const year = yearLabel(f.year, f.approx);
  return `${f.kind === 'style' ? 'From' : 'Riff of'} ${f.name}${year ? `, ${year}` : ''}`;
}
