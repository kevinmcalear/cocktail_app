// Garnishes: a small wash of colour with a pencil outline, placed by the rim,
// in the drink, or on top of the ice.

import { SKETCH } from '../../constants/sketch';
import { ell, hw, type Pt } from './geometry';
import type { Painter } from './painter';
import { gauss } from './random';
import type { SketchGarnish } from './types';

const PEEL: Partial<Record<SketchGarnish, string>> = { orange_peel: SKETCH.orangePeel, lemon_peel: SKETCH.lemonPeel, grapefruit_peel: SKETCH.grapefruitPeel };
const WHEEL: Partial<Record<SketchGarnish, string>> = { lime_wheel: SKETCH.limeWheel, lemon_wheel: SKETCH.lemonWheel, orange_wheel: SKETCH.orangeWheel, cucumber: SKETCH.cucumber };

/** Paints the garnish's colour and returns its outlines, drawn later over the glass. */
export function paintGarnish(P: Painter, garnish: SketchGarnish | null, crown: number, surface: number): Pt[][] {
  if (!garnish) return [];
  const { g, r, e, Rr } = P;
  const gx = 50 + Rr;
  const gy = g.rim;
  const lines: Pt[][] = [];
  const blob = (poly: Pt[], color: string, str = 1) => {
    P.wash(poly, color, str, { layers: 0.55, n: 12, spill: 0.2, misreg: 0.3, v1: 0.1, v2: 0.08, blooms: 0, fadeTo: 0.6 });
    lines.push([...poly, poly[0]]);
  };
  const floor = (g.stemmed ? P.bot : g.base ?? P.bot) - 4;

  if (PEEL[garnish]) {
    const pts: Pt[] = [];
    for (let t = 0; t <= 1; t += 0.08) pts.push([gx - 11 + t * 13 + Math.sin(t * 3.2) * 2, gy - 3 + t * t * 14 - Math.sin(t * Math.PI) * 4]);
    const nrm = (i: number): Pt => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / m, (b[0] - a[0]) / m];
    };
    const wdt = (t: number) => 0.8 + Math.sin(t * Math.PI) * 1.1;
    const side = (sgn: number) => pts.map((p, i) => { const n = nrm(i); const w = wdt(i / (pts.length - 1)) * sgn; return [p[0] + n[0] * w, p[1] + n[1] * w] as Pt; });
    const up = side(1);
    const dn = side(-1).reverse();
    P.wash([...up, ...dn], PEEL[garnish]!, 1.25, { layers: 0.55, n: 12, spill: 0.2, misreg: 0.3, v1: 0.1, v2: 0.08, blooms: 0, fadeTo: 0.6 });
    lines.push(up.slice(1, -1), dn.slice(1, -1));
    return lines;
  }
  if (WHEEL[garnish]) {
    blob(ell(gx - 2, gy + 1, 8, 8, 0, Math.PI * 2, 16), WHEEL[garnish]!, 1.1);
    lines.push(ell(gx - 2, gy + 1, 5.6, 5.6, 0, Math.PI * 2, 14));
    if (garnish !== 'cucumber') for (const a of [0, 1.05, 2.1]) lines.push([[gx - 2 - Math.cos(a) * 5.6, gy + 1 - Math.sin(a) * 5.6], [gx - 2 + Math.cos(a) * 5.6, gy + 1 + Math.sin(a) * 5.6]]);
    return lines;
  }
  switch (garnish) {
    case 'cherry':
      blob(ell(50, floor - 1, 4, 4, 0, Math.PI * 2, 14), SKETCH.cherry, 1.2);
      lines.push([[50, floor - 5], [51.2, floor - 9], [53.5, floor - 12.5]]);
      break;
    case 'olive':
    case 'onion': {
      lines.push([[gx - 2, g.rim - 9], [50, floor + 2]]);
      for (const t of [0.62, 0.8]) {
        const ox = gx - 2 + (50 - gx + 2) * t;
        const oy = g.rim - 9 + (floor + 2 - g.rim + 9) * t;
        blob(ell(ox, oy, garnish === 'olive' ? 3.2 : 2.6, garnish === 'olive' ? 2.4 : 2.6, 0, Math.PI * 2, 12, 0.6), garnish === 'olive' ? SKETCH.olive : SKETCH.onion, garnish === 'olive' ? 1.2 : 0.6);
      }
      break;
    }
    case 'lime_wedge':
      blob([[gx - 9, gy - 1], [gx + 3, gy - 3], [gx - 1, gy + 6]], SKETCH.limeWedge, 1.2);
      break;
    case 'mint':
      blob(ell(gx - 6, gy - 4, 5.5, 2.7, 0, Math.PI * 2, 14, -0.5), SKETCH.mint, 1.2);
      blob(ell(gx - 0.5, gy - 6.5, 4.8, 2.4, 0, Math.PI * 2, 14, 0.45), SKETCH.mintLight, 1.1);
      lines.push([[gx - 11, gy - 1], [gx - 1, gy - 7]]);
      break;
    case 'herb':
      blob(ell(gx - 5, gy - 6, 1.6, 6, 0, Math.PI * 2, 12, 0.5), SKETCH.herb, 1.2);
      blob(ell(gx - 1, gy - 8, 1.4, 5, 0, Math.PI * 2, 12, -0.2), SKETCH.herbLight, 1.1);
      lines.push([[gx - 8, gy + 2], [gx - 2, gy - 12]]);
      break;
    case 'berries':
      lines.push([[gx - 23, gy - 10], [gx + 3, gy + 3]]);
      for (const t of [0.25, 0.45, 0.65]) blob(ell(gx - 23 + 26 * t, gy - 10 + 13 * t - 2.6, 3, 3, 0, Math.PI * 2, 12), SKETCH.berry, 1.2);
      break;
    case 'strawberry':
      blob([[gx - 3, gy - 10], [gx + 3, gy - 9], [gx + 5, gy - 4], [gx, gy + 2], [gx - 5, gy - 4]], SKETCH.strawberry, 1.3);
      blob(ell(gx, gy - 10.5, 3.5, 1.2, 0, Math.PI * 2, 10), SKETCH.leaf, 1);
      break;
    case 'pineapple': {
      const py = Math.min(gy, crown + 2);
      blob([[gx - 13, py + 1], [gx + 5, py + 1], [gx - 3, py + 9]], SKETCH.pineapple, 1.2);
      blob([[gx - 5, py], [gx - 10, py - 15], [gx - 2, py - 3], [gx + 1, py - 17], [gx + 2, py]], SKETCH.leaf, 1.1);
      break;
    }
    case 'coffee_beans':
      for (const x of [44, 50, 56]) {
        blob(ell(x, surface + 1.4, 2.6, 1.6, 0, Math.PI * 2, 10), SKETCH.coffeeBean, 1.5);
        lines.push([[x - 1.6, surface + 1.4], [x + 1.6, surface + 1.4]]);
      }
      break;
    case 'grated_spice': {
      const w0 = hw(g, surface) * 0.85;
      P.dots(Array.from({ length: 46 }, () => [50 + (r() * 2 - 1) * w0, surface + (r() * 2 - 1) * w0 * e * 0.7, 0.15 + r() * 0.3] as [number, number, number]), SKETCH.spice, 0.55);
      break;
    }
    case 'flower': {
      const fx = 50 + hw(g, surface) * 0.35;
      const fy = surface - 0.5;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        blob(ell(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 1.3, 2.2, 1.3, 0, Math.PI * 2, 10, a), SKETCH.petal, 0.9);
      }
      blob(ell(fx, fy, 1, 0.7, 0, Math.PI * 2, 8), SKETCH.pollen, 1.2);
      break;
    }
    case 'salt_rim':
    case 'sugar_rim': {
      const dots: [number, number, number][] = [];
      for (const [x, y] of ell(50, g.rim + 1.2, Rr - 0.3, (Rr - 0.3) * e, 0.05, Math.PI - 0.05, 40)) {
        for (let j = 0; j < 3; j++) dots.push([x + gauss(r) * 0.5, y + gauss(r) * 0.8, 0.18 + r() * 0.25]);
      }
      P.dots(dots, garnish === 'salt_rim' ? SKETCH.salt : SKETCH.sugar, 0.6);
      break;
    }
    case 'ginger':
      blob([[gx - 10, gy - 5], [gx - 1, gy - 8], [gx + 1, gy - 2], [gx - 8, gy + 1]], SKETCH.ginger, 1.1);
      break;
    case 'chili':
      blob(ell(gx - 3, gy - 4, 5.5, 1.5, 0, Math.PI * 2, 12, -0.6), SKETCH.chili, 1.3);
      lines.push([[gx + 1, gy - 8], [gx + 3, gy - 10]]);
      break;
    case 'apple':
      for (const a of [-0.5, 0, 0.5]) blob(ell(gx - 3 + a * 4, gy - 3, 5, 1.3, 0, Math.PI * 2, 10, a - 0.3), SKETCH.apple, 1);
      break;
  }
  return lines;
}
