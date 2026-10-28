/**
 * A venue's whole palette from two choices: its colour and a background
 * (Neutral, A hint, Rich). The background is stored as one hex, the dark
 * ground (bars.ground_tint); every other neutral, in dark and light mode, is
 * built from that hex's hue and strength in OKLCH, so cards, lines and text
 * all follow it. No tint keeps the app's own Back Bar colours.
 */
import { backbar, BRAND_PALETTES, type BackbarColors, type BackbarScheme } from '@/constants/tokens';
import { parseHex, readableAccent, toHex, withAlpha } from '@/lib/color';

export type Ground = 'neutral' | 'hint' | 'rich';

interface Lch {
  l: number;
  c: number;
  h: number;
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toGamma = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** '#RRGGBB' as OKLCH: lightness 0 to 1, chroma, hue in degrees. */
export function toLch(hex: string): Lch {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function linearRgb(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH as '#RRGGBB', keeping lightness and hue and giving up chroma until it fits on screen. */
export function fromLch(l: number, c: number, h: number): string {
  let lo = 0;
  let hi = c;
  if (!inGamut(linearRgb(l, c, h))) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(linearRgb(l, mid, h))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  return toHex(linearRgb(l, c, h).map((v) => Math.min(255, Math.max(0, toGamma(Math.min(1, Math.max(0, v)))))) as [number, number, number]);
}

/** How much of the colour each background takes; Neutral is no tint at all. */
const STRENGTH: Record<Exclude<Ground, 'neutral'>, number> = { hint: 0.02, rich: 0.04 };
/** The dark ground's lightness, the same as Back Bar's own. */
const GROUND_L = 0.165;
/** Below this a colour is a grey, and tinting with it would only add noise. */
const GREY = 0.02;

/** The bars.ground_tint to save for a colour and a background: null for Neutral (or a grey colour). */
export function groundTintFor(accent: string, ground: Ground): string | null {
  if (ground === 'neutral') return null;
  const { c, h } = toLch(accent);
  if (c < GREY) return null;
  return fromLch(GROUND_L, Math.min(c, STRENGTH[ground]), h);
}

/** Which background a saved tint is for this colour; null for an older tint made some other way. */
export function groundOf(accent: string, tint: string | null): Ground | null {
  if (!tint) return 'neutral';
  const t = tint.toUpperCase();
  return (['hint', 'rich'] as const).find((g) => groundTintFor(accent, g) === t) ?? null;
}

/**
 * Every neutral for both schemes from a dark ground tint. The dark ground is
 * the tint itself; the rest keep Back Bar's lightness steps and take the
 * tint's hue at a share of its strength (light mode a little less).
 */
export function neutralsFrom(tint: string): Record<BackbarScheme, BackbarColors> {
  const { l, c, h } = toLch(tint);
  const n = (L: number, share: number) => fromLch(L, c * share, h);
  const darkInk = n(0.95, 0.25);
  const lightInk = n(0.21, 0.6);
  const darkGround = toHex(parseHex(tint));
  const lightGround = n(0.968, 0.55);
  return {
    dark: {
      ...backbar.dark,
      ground: darkGround,
      surface: n(l + 0.05, 0.9),
      raised: n(l + 0.09, 0.85),
      ink: darkInk,
      muted: n(0.72, 0.5),
      faint: n(0.55, 0.5),
      line: withAlpha(darkInk, 0.1),
      lineStrong: withAlpha(darkInk, 0.2),
      glass: withAlpha(n(l + 0.07, 0.9), 0.55),
      scrim: withAlpha(darkGround, 0.62),
    },
    light: {
      ...backbar.light,
      ground: lightGround,
      surface: n(0.995, 0.15),
      raised: n(0.93, 0.7),
      ink: lightInk,
      muted: n(0.5, 0.6),
      faint: n(0.7, 0.5),
      line: withAlpha(lightInk, 0.08),
      lineStrong: withAlpha(lightInk, 0.16),
      scrim: withAlpha(lightGround, 0.72),
    },
  };
}

/** The colours for a scheme: Back Bar's own, or built from the venue's tint. */
export function neutralsFor(scheme: BackbarScheme, tint: string | null | undefined): BackbarColors {
  return tint ? neutralsFrom(tint)[scheme] : backbar[scheme];
}

export interface Palette {
  name: string;
  accent: string;
  ground: Ground;
}

/** The six palettes a venue starts from when it has no logo. */
export const PALETTES: Palette[] = [...BRAND_PALETTES];

/**
 * The palettes to offer: the logo's colours first, each with A hint, then
 * the standard ones until there are six. `name` names a colour (lib/brandColours).
 */
export function palettesFor(logoColours: string[], name: (hex: string) => string): Palette[] {
  const seen = new Set<string>();
  const out: Palette[] = [];
  for (const p of [...logoColours.map((hex) => ({ name: name(hex), accent: hex.toUpperCase(), ground: 'hint' as const })), ...PALETTES]) {
    if (seen.has(p.accent) || out.length === 6) continue;
    seen.add(p.accent);
    out.push(p);
  }
  return out;
}

/** The plain notes under the colours: only when a mode shifts the colour so text stays readable. */
export function shadeNotes(accent: string, tint: string | null, name: string): string[] {
  const out: string[] = [];
  const word = name.toLowerCase();
  if (readableAccent(accent, neutralsFor('light', tint).ground) !== toHex(parseHex(accent))) out.push(`Light mode uses a deeper ${word} for text, so it stays readable.`);
  if (readableAccent(accent, neutralsFor('dark', tint).ground) !== toHex(parseHex(accent))) out.push(`Dark mode uses a lighter ${word} for text, so it stays readable.`);
  return out;
}
