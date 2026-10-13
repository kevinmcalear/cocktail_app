// A glass as a plain line drawing (the canvas's "Which shape?" tiles): the
// bowl or body from its profile, the rim, and a stem and foot when it has
// them. Same 100 by 100 units as geometry.ts, glass centred on x = 50.
import type { GlassShape } from './geometry';

const n = (v: number) => Math.round(v * 10) / 10;
const at = (x: number, y: number) => `${n(x)} ${n(y)}`;

/** The outline as one SVG path: draw it with a stroke, no fill. */
export function glassOutline(g: GlassShape): string {
  const left = g.prof.map(([y, w]) => at(50 - w, y));
  const right = [...g.prof].reverse().map(([y, w]) => at(50 + w, y));
  const [y0, w0] = g.prof[0];
  const parts = [`M ${left.join(' L ')} L ${right.join(' L ')}`, `M ${at(50 - w0, y0)} L ${at(50 + w0, y0)}`];
  if (g.stemmed && g.stem && g.foot) {
    const [footY, footW] = g.foot;
    parts.push(`M ${at(50, g.stem[0])} L ${at(50, g.stem[1])}`, `M ${at(50 - footW, footY)} Q ${at(50, footY - 2.5)} ${at(50 + footW, footY)}`);
  }
  return parts.join(' ');
}
