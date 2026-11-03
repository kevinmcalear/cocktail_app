import { drawing } from '@/constants/tokens';

/** Where three drawings sit, in points from the group's top left: x, y and size of the left, middle and right place. */
export interface TrioLayout {
  x: readonly [number, number, number];
  y: readonly [number, number, number];
  s: readonly [number, number, number];
}

/**
 * The trio the canvas draws (Prod-phone and Menu-page `trio`): the middle
 * larger, higher and in front, at the fourth size. At `scale` 1 it is a menu
 * page's hero (160, 206, 160); staff Tonight draws it at 0.82. The places
 * stay where they are and only the drawings shrink, as the boards draw it.
 */
export function trioLayout(scale = 1): TrioLayout {
  const s = [drawing.tile, drawing.middle, drawing.tile].map((n) => Math.round(n * scale)) as [number, number, number];
  const low = Math.round(s[1] * 0.24);
  return { x: [0, 88, 222], y: [low, 0, low], s };
}

export interface TrioPlace {
  x: number;
  y: number;
  /** Its size on screen. */
  s: number;
  /** The size it's drawn at (then scaled to `s`): the middle place takes the fourth size. */
  drawn: 'tile' | 'middle';
  front: boolean;
}

/** The places for one, two or three drinks: one takes the middle, two the outer places closer together. */
export function trioPlaces(count: number, t: TrioLayout): { places: TrioPlace[]; width: number; height: number } {
  const n = Math.max(0, Math.min(3, count));
  const which = n === 3 ? [0, 1, 2] : n === 2 ? [0, 2] : n === 1 ? [1] : [];
  const places = which.map((p, i): TrioPlace => ({
    x: n === 3 ? t.x[p] : n === 2 ? (i ? Math.round(t.s[0] * 0.55) : 0) : 0,
    y: n === 3 ? t.y[p] : 0,
    s: t.s[p],
    drawn: p === 1 ? 'middle' : 'tile',
    front: p === 1,
  }));
  // Centred on the middle drawing, as the boards place it: a smaller trio's
  // outer two shrink toward the middle by different amounts, so the box widens
  // on the short side.
  const mid = places.find((p) => p.front);
  const right = Math.max(0, ...places.map((p) => p.x + p.s));
  if (mid && n === 3) {
    const centre = mid.x + mid.s / 2;
    const half = Math.max(centre, right - centre);
    for (const p of places) p.x += half - centre;
    return { places, width: Math.round(half * 2), height: Math.max(0, ...places.map((p) => p.y + p.s)) };
  }
  return { places, width: right, height: Math.max(0, ...places.map((p) => p.y + p.s)) };
}
