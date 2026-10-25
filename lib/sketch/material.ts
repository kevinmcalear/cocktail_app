// What a vessel is made of, when it isn't clear glass, and what's wrapped
// around it: steel and copper catch a bright streak and a dark edge, beaten
// metal throws little facets, glaze is its own colour, tinted glass stays see
// through, and a sleeve (rattan, leather) is its own band over the glass.
// Colours come from the maker's photo (lib/sketch/geometry.ts GlassShape).

import { SKETCH } from '../../constants/sketch';
import { hw, type GlassShape, type Pt } from './geometry';
import type { Painter } from './painter';
import { mixHex } from './random';

/** A strip down the body between two fractions of its half-width (-1 left edge, 1 right). */
function stripe(g: GlassShape, f0: number, f1: number, y0: number, y1: number): Pt[] {
  const a: Pt[] = [];
  const b: Pt[] = [];
  for (let y = y0; y <= y1; y += 1.5) {
    a.push([50 + f0 * hw(g, y), y]);
    b.push([50 + f1 * hw(g, y), y]);
  }
  return [...a, ...b.reverse()];
}

/** The body of an opaque or tinted vessel, under the pencil. True when it painted the body. */
export function paintBody(P: Painter, g: GlassShape): boolean {
  const m = g.material;
  if (!m) return false;
  const { r, bot } = P;
  if (m.kind === 'tinted') {
    P.wash(P.silhouette, m.color, 0.45, { spill: 0.08, fadeTo: 0.75, blooms: 0 });
    return true;
  }
  // A tight wash: an opaque vessel should read as a crisp shape, not a puddle.
  P.wash(P.silhouette, m.color, 1.05, { spill: 0.08, fadeTo: 0.9, blooms: 0 });
  const y0 = g.rim + 1.5;
  const y1 = bot - 1;
  if (m.kind === 'metal') {
    // A cylinder of metal: a bright streak left of centre, a darker edge on the right.
    P.wash(stripe(g, -0.62, -0.28, y0, y1), mixHex(m.color, SKETCH.white, 0.7), 0.8, { spill: 0.05, n: 10, blooms: 0 });
    P.wash(stripe(g, 0.55, 0.97, y0, y1), mixHex(m.color, SKETCH.charcoal, 0.35), 0.55, { spill: 0.05, n: 10, blooms: 0 });
    if (m.hammered) {
      const facets = (n: number, tone: string, alpha: number) =>
        P.dots(Array.from({ length: n }, () => {
          const y = y0 + r() * (y1 - y0);
          return [50 + (r() * 2 - 1) * (hw(g, y) - 1.2), y, 0.5 + r() * 0.9] as [number, number, number];
        }), tone, alpha);
      facets(110, mixHex(m.color, SKETCH.white, 0.6), 0.55);
      facets(80, mixHex(m.color, SKETCH.charcoal, 0.4), 0.4);
    }
  } else {
    // Glaze: a soft shine on the left and a shadow round the right, so the body reads as round.
    P.wash(stripe(g, -0.6, -0.3, y0, y1), mixHex(m.color, SKETCH.white, 0.5), 0.5, { spill: 0.05, n: 10, blooms: 0 });
    P.wash(stripe(g, 0.5, 0.97, y0, y1), mixHex(m.color, SKETCH.charcoal, 0.3), 0.45, { spill: 0.05, n: 10, blooms: 0 });
  }
  return true;
}

/** A wrap around part of the body, painted over the glass and the drink. */
export function paintSleeve(P: Painter, g: GlassShape) {
  const s = g.sleeve;
  if (!s) return;
  const poly = stripe(g, -1.03, 1.03, s.from, s.to);
  P.wash(poly, s.color, 0.85, { spill: 0.06, fadeTo: 0.75, blooms: 0 });
  P.line([...stripe(g, -1.03, -1.03, s.from, s.to).slice(0, 1), ...stripe(g, 1.03, 1.03, s.from, s.to).slice(0, 1)], { weight: 0.6, alpha: 0.7 });
  if (!s.weave) return;
  // Rattan: a lattice of crossing strands.
  const dark = mixHex(s.color, SKETCH.charcoal, 0.45);
  for (let y = s.from; y < s.to; y += 2.4) {
    const w0 = hw(g, y) + 0.4;
    const w1 = hw(g, Math.min(s.to, y + 2.4)) + 0.4;
    for (let k = -1; k <= 1; k += 0.25) {
      P.line([[50 + k * w0, y], [50 + Math.min(1, k + 0.18) * w1, Math.min(s.to, y + 2.4)]], { weight: 0.35, alpha: 0.55, passes: 1, gaps: 0, over: 0 });
    }
  }
  P.dots(Array.from({ length: 50 }, () => {
    const y = s.from + P.r() * (s.to - s.from);
    return [50 + (P.r() * 2 - 1) * hw(g, y), y, 0.5 + P.r() * 0.6] as [number, number, number];
  }), dark, 0.35);
}

/** A handle traced from the photo, on the right: where it joins the body and how far out it reaches. */
export function paintHandle(P: Painter, g: GlassShape): boolean {
  const h = g.handleAt;
  if (!h) return false;
  const x0 = 50 + hw(g, h.from);
  const x1 = 50 + hw(g, h.to);
  const out = 50 + Math.max(hw(g, h.from), hw(g, h.to)) + h.reach;
  const mid = (h.from + h.to) / 2;
  const span = h.to - h.from;
  const thick = Math.max(1.6, span * 0.12);
  const outer: Pt[] = [[x0, h.from], [out - thick * 0.4, h.from + span * 0.08], [out, mid], [out - thick * 0.4, h.to - span * 0.08], [x1, h.to]];
  const inner: Pt[] = [[x1, h.to - thick], [out - thick * 1.3, h.to - span * 0.16], [out - thick, mid], [out - thick * 1.3, h.from + span * 0.16], [x0, h.from + thick]];
  if (g.material && g.material.kind !== 'tinted') P.wash([...outer, ...inner], g.material.color, 0.8, { spill: 0.1, n: 10, blooms: 0 });
  P.line(outer, { weight: 1, wob: 1 });
  P.line(inner, { weight: 0.6, alpha: 0.75 });
  return true;
}
