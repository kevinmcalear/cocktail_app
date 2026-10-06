// Seeded randomness, so the same drink always draws the same way.

export type Rng = () => number;

export function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32. */
export function rng(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: Rng): number {
  let u = 0;
  while (!u) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Smooth 1D noise in -1..1, for a hand's slow wobble. */
export function noise1(r: Rng): (t: number) => number {
  const v = Array.from({ length: 65 }, () => r() * 2 - 1);
  return (t: number) => {
    const x = Math.abs(t) % 64;
    const i = Math.floor(x);
    const f = x - i;
    const s = (1 - Math.cos(f * Math.PI)) / 2;
    return v[i] * (1 - s) + v[i + 1] * s;
  };
}

export const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mixHex = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(Math.max(0, Math.min(255, v + (B[i] - v) * t))).toString(16).padStart(2, '0')).join('');
};
