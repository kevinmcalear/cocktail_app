/**
 * The palate: how your taste learns from the drinks you rank, and the flower
 * that draws a taste (components/ds/PalateFlower.tsx). The design is the
 * "Palate system" canvas: https://claude.ai/artifact/ATQdyopUYK62YHbQbYYDkb
 *
 * Learning: every ranked drink pulls your taste towards it if you loved it
 * and pushes it away if you didn't (pull: loved +0.5 to +1, didn't like -0.5
 * to -1, fine barely either way), and only where it differs from the average
 * drink. A loved smoky drink pulls smoky up; a disliked creamy one
 * pushes creamy down; disliking a strong drink says little, since nearly every
 * cocktail is strong. Checked by lib/palate.check.ts.
 */
import { DIMENSIONS, blendTaste, level, LABEL, meanProfile, type Dimension, type Profile, type Taste } from './flavor';
import type { Sentiment } from './ranking';

/** A drink you ranked, with its flavor profile. Plain JSON. */
export interface RankedFlavor {
  itemId: string;
  name: string;
  /** Your 0 to 10 score. */
  score: number;
  /** The band you put it in. A lone disliked drink scores 3.3, so the band, not the score, says which way it moves you. */
  sentiment: Sentiment;
  createdAt: string;
  profile: Profile;
}

/**
 * How hard a ranked drink pulls your taste towards it (positive) or pushes it
 * away (negative). Loved: +0.5 at the bottom of the band to +1 at 10. Didn't
 * like: -0.5 at the top of its band to -1 at 0. Fine: at most 0.3 either way.
 * Band edges as lib/ranking.ts (loved 6.7 up, didn't like 3.3 down).
 */
export function pull(e: Pick<RankedFlavor, 'score' | 'sentiment'>): number {
  const s = Math.max(0, Math.min(10, e.score));
  if (e.sentiment === 'loved') return 0.5 + (0.5 * Math.max(0, s - 6.7)) / 3.3;
  if (e.sentiment === 'disliked') return -(0.5 + (0.5 * Math.max(0, 3.3 - s)) / 3.3);
  return Math.max(-0.3, Math.min(0.3, (0.3 * (s - 5)) / 1.6));
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** One entry per drink, at your best score for it (as get_my_taste did). */
function perDrink(entries: readonly RankedFlavor[]): RankedFlavor[] {
  const best = new Map<string, RankedFlavor>();
  for (const e of entries) {
    const had = best.get(e.itemId);
    if (!had || e.score > had.score) best.set(e.itemId, e);
  }
  return [...best.values()];
}

/**
 * Your taste from your rankings alone: the average drink, moved towards what
 * you loved and away from what you didn't. Without a baseline, the average of
 * your own drinks stands in. Null with nothing ranked.
 */
export function tasteFromRankings(entries: readonly RankedFlavor[], baseline: Profile | null): { taste: Profile; drinks: number } | null {
  const drinks = perDrink(entries);
  if (!drinks.length) return null;
  const base = baseline ?? meanProfile(drinks.map((e) => e.profile))!;
  const total = drinks.reduce((sum, e) => sum + Math.abs(pull(e)), 0);
  const taste = Object.fromEntries(
    DIMENSIONS.map((d) => {
      if (!total) return [d, base[d]];
      const moved = drinks.reduce((sum, e) => sum + pull(e) * (e.profile[d] - base[d]), 0) / total;
      return [d, clamp01(base[d] + moved)];
    })
  ) as Profile;
  return { taste, drinks: drinks.length };
}

/** A drink that shaped your taste, and which way. */
export interface Shaper extends RankedFlavor {
  /** 'pull' (loved), 'push' (disliked) or 'none' (in the middle). */
  way: 'pull' | 'push' | 'none';
  /** The tastes it stands out on, most first: what it moved. */
  moved: Dimension[];
}

/** How far from the average a drink must be on a taste before it counts as moving it. */
const STANDS_OUT = 0.15;

/**
 * The drinks that moved your taste most: the strongest pulls first, then up to
 * two pushes (a lone disliked drink pushes half as hard as a 10 pulls, so it
 * would never make the list on strength alone), then any room left for drinks
 * that barely moved it.
 */
export function shapedBy(entries: readonly RankedFlavor[], baseline: Profile | null, limit = 5): Shaper[] {
  const drinks = perDrink(entries);
  if (!drinks.length) return [];
  const base = baseline ?? meanProfile(drinks.map((e) => e.profile))!;
  const all = drinks
    .map((e): Shaper => {
      const p = pull(e);
      const moved = DIMENSIONS.filter((d) => e.profile[d] - base[d] >= STANDS_OUT)
        .sort((a, b) => e.profile[b] - base[b] - (e.profile[a] - base[a]))
        .slice(0, 2);
      const way: Shaper['way'] = Math.abs(p) < 0.35 || !moved.length ? 'none' : p > 0 ? 'pull' : 'push';
      return { ...e, way, moved: way === 'none' ? [] : moved };
    })
    .sort((a, b) => Math.abs(pull(b)) - Math.abs(pull(a)) || b.createdAt.localeCompare(a.createdAt));
  const pushes = all.filter((s) => s.way === 'push').slice(0, 2);
  const pulls = all.filter((s) => s.way === 'pull').slice(0, limit - pushes.length);
  const rest = all.filter((s) => s.way === 'none').slice(0, Math.max(0, limit - pulls.length - pushes.length));
  return [...pulls, ...pushes, ...rest];
}

/** Your palate at the end of a month. */
export interface PalateMonth {
  /** "2026-07" */
  key: string;
  taste: Taste;
}

/**
 * Your palate at the end of each of the last few months you ranked in,
 * oldest first, with your answers blended in as they would have been then.
 * Empty until there are two months to compare.
 */
export function palateByMonth(entries: readonly RankedFlavor[], baseline: Profile | null, answers: Taste | null, months = 4): PalateMonth[] {
  const keys = [...new Set(entries.map((e) => e.createdAt.slice(0, 7)))].sort().slice(-months);
  if (keys.length < 2) return [];
  return keys.map((key) => {
    const upTo = entries.filter((e) => e.createdAt.slice(0, 7) <= key);
    const ranked = tasteFromRankings(upTo, baseline);
    return { key, taste: blendTaste(ranked?.taste ?? null, ranked?.drinks ?? 0, answers).taste };
  });
}

const list = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]);

/** "more bitter and smoky, less sour": the biggest moves from one taste to another, or null when nothing moved much. */
export function changeBetween(from: Taste, to: Taste): string | null {
  const gap = (d: Dimension) => (to[d] ?? 0) - (from[d] ?? 0);
  const dims = DIMENSIONS.filter((d) => typeof from[d] === 'number' && typeof to[d] === 'number' && Math.abs(gap(d)) >= 0.12);
  const more = dims.filter((d) => gap(d) > 0).sort((a, b) => gap(b) - gap(a)).slice(0, 2);
  const less = dims.filter((d) => gap(d) < 0).sort((a, b) => gap(a) - gap(b)).slice(0, 1);
  const parts = [more.length ? `more ${list(more.map((d) => LABEL[d]))}` : null, less.length ? `less ${LABEL[less[0]]}` : null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Where a drink meets your taste: what you share, and where it goes past or falls short. */
export interface Meeting {
  shared: Dimension[];
  more: Dimension | null;
  less: Dimension | null;
}

/** Same thresholds as matchReasons, as tags: "bitter, like you", "more sweet than usual". */
export function meet(taste: Taste, profile: Profile, baseline: Profile | null): Meeting {
  const has = DIMENSIONS.filter((d) => typeof taste[d] === 'number');
  const lift = (d: Dimension) => Math.min(taste[d]!, profile[d]) - (baseline?.[d] ?? 0);
  const shared = has
    .filter((d) => taste[d]! >= 0.4 && profile[d] >= 0.4 && lift(d) > 0)
    .sort((a, b) => lift(b) - lift(a))
    .slice(0, 2);
  const gap = (d: Dimension) => profile[d] - taste[d]!;
  const rest = has.filter((d) => !shared.includes(d));
  const more = rest.filter((d) => gap(d) >= 0.3).sort((a, b) => gap(b) - gap(a))[0] ?? null;
  const less = rest.filter((d) => gap(d) <= -0.3).sort((a, b) => gap(a) - gap(b))[0] ?? null;
  return { shared, more, less };
}

/** A spring: the springs tokens' shape. */
export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

/**
 * One step of a damped spring towards `target`: the petal motion. Returns the
 * new position and velocity, and whether it has come to rest (snapped to the
 * target). `dt` in seconds.
 */
export function springStep(x: number, v: number, target: number, cfg: SpringConfig, dt: number): { x: number; v: number; resting: boolean } {
  const a = (-cfg.stiffness * (x - target) - cfg.damping * v) / cfg.mass;
  const nv = v + a * dt;
  const nx = x + nv * dt;
  if (Math.abs(nx - target) < 0.001 && Math.abs(nv) < 0.01) return { x: target, v: 0, resting: true };
  return { x: nx, v: nv, resting: false };
}

// --- The flower ---

/** The wheel: sweet at twelve o'clock, then clockwise. Neighbours taste alike. */
export const WHEEL: readonly Dimension[] = ['sweet', 'fruity', 'sour', 'botanical', 'herbal', 'bitter', 'spiced', 'spicy', 'smoky', 'savory', 'creamy', 'strong'];

export type PalateFamily = 'bright' | 'green' | 'fire' | 'body';

/** Three tastes to a family, a quarter of the wheel each. */
export const FAMILY: Record<Dimension, PalateFamily> = {
  sweet: 'bright',
  fruity: 'bright',
  sour: 'bright',
  botanical: 'green',
  herbal: 'green',
  bitter: 'green',
  spiced: 'fire',
  spicy: 'fire',
  smoky: 'fire',
  savory: 'body',
  creamy: 'body',
  strong: 'body',
};

/** The flower is drawn in a 200 x 200 box around (100, 100). */
const R = 86;
const R0 = 9;

/** How far a petal reaches for a value. Even 0 leaves a nub, so every taste has its place. */
export const reach = (v: number) => R0 + clamp01(v) * (R - R0);

/** The faint rings: the thresholds between level words, then the edge. */
export const RINGS = [0.15, 0.35, 0.6, 0.8, 1].map(reach);

const angle = (i: number) => ((-90 + i * 30) * Math.PI) / 180;

/** One petal as an SVG path: a rounded teardrop from the centre. */
export function petalPath(i: number, v: number): string {
  const a = angle(i);
  const r = reach(v);
  const w = Math.max(4.2, r * 0.28);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const pt = (k: number, s: number) => `${(100 + dx * k - dy * s).toFixed(1)} ${(100 + dy * k + dx * s).toFixed(1)}`;
  return `M100 100 C${pt(r * 0.42, w)} ${pt(r * 1.04, w * 0.6)} ${pt(r, 0)} C${pt(r * 1.04, -w * 0.6)} ${pt(r * 0.42, -w)} 100 100 Z`;
}

/** Every petal a taste has, as one outline (what you said, or a drink over your palate). */
export function outlinePath(values: Taste): string {
  return WHEEL.map((d, i) => (typeof values[d] === 'number' ? petalPath(i, values[d]!) : '')).join(' ');
}

/** Where each taste's name sits around a labelled flower. */
export function labelSpot(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const a = angle(i);
  const c = Math.cos(a);
  return { x: 100 + c * 100, y: 100 + Math.sin(a) * 100 + 4, anchor: Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end' };
}

/** View boxes: just the flower, or with room for the names around it. */
export const VIEW = { plain: { box: '10 10 180 180', ratio: 1 }, labelled: { box: '-58 -14 316 228', ratio: 228 / 316 } } as const;

/** What the flower says, for screen readers: strongest first, in words. */
export function palateLabel(values: Taste): string {
  const shown = WHEEL.filter((d) => typeof values[d] === 'number').sort((a, b) => values[b]! - values[a]!);
  return shown.length ? `Palate: ${shown.map((d) => `${LABEL[d]} ${level(values[d]!)}`).join(', ')}` : 'Palate: nothing yet';
}
