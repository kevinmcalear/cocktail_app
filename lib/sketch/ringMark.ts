// The ring a glass leaves (app-mark "ring", Kevin 31 Oct 2026): a watercolour
// ring with one pencil stroke, in any colour. A bar with no logo wears it with
// its initials in its face, on its colour (themes-flow "bar presets").

import { handFor } from './bottle';
import { GLASS_SHAPES, type Pt } from './geometry';
import { makePainter } from './painter';
import { hashString, rng } from './random';
import { SceneBuilder, type Scene } from './scene';

const CX = 50;
const CY = 51;

/** An arc of the ring as a closed band: out along the outer edge, back along the inner. */
function arc(a0: number, a1: number, rOut: number, rIn: number): Pt[] {
  const n = 10;
  const at = (a: number, r: number): Pt => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(at(a0 + ((a1 - a0) * i) / n, rOut));
  for (let i = n; i >= 0; i--) out.push(at(a0 + ((a1 - a0) * i) / n, rIn));
  return out;
}

/**
 * The ring in `color`, its pencil in `pencil`, the same for the same `seed`
 * (a bar's id). Glass units, 0 to 100 across, so it fills the frame like a
 * thumb.
 */
export function paintRingMark(color: string, pencil: string, seed: string): Scene {
  const key = `${seed}|ring`;
  const r = rng(hashString(key));
  const b = new SceneBuilder(`r${hashString(key).toString(36)}`);
  const S = { ...handFor('thumb'), ink: pencil };
  const P = makePainter(S, r, rng(hashString(`${key}|hand`)), b, GLASS_SHAPES.rocks);
  // A glass's foot is never quite round: overlapping strokes of wash, darker where they meet.
  const start = r() * Math.PI * 2;
  const parts = 6;
  for (let i = 0; i < parts; i++) {
    const a0 = start + (i * Math.PI * 2) / parts - 0.12;
    const a1 = a0 + (Math.PI * 2) / parts + 0.24;
    P.wash(arc(a0, a1, 41 + r() * 2, 33 - r() * 2), color, 0.85, { spill: 0.3, blooms: 0 });
  }
  // One pencil stroke, most of the way round.
  const p0 = r() * Math.PI * 2;
  const stroke: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = p0 + (i / 40) * Math.PI * 1.7;
    stroke.push([CX + Math.cos(a) * 37.5, CY + Math.sin(a) * 37.5]);
  }
  P.line(stroke, { passes: 1, weight: 1.3 });
  return b.done();
}
