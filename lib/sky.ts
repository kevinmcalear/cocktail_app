/**
 * The drawing page's soft sky (canvas GWBCX, Decided "Drinks with a
 * drawing", 29 Oct): a breath of the drink's own colour at the top of the
 * page, gone by the title. Built in OKLCH from the drink's hue, never mixed
 * into the paper, then written out as plain hex stops (React Native has no
 * oklch(), and Chrome's `in oklch` never settles on its last stop anyway).
 * A near-clear drink reads as cold glass: an icy blue.
 */
import { parseHex, toHex } from './color';

interface Lch {
  L: number;
  C: number;
  H: number;
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toByte = (c: number) => 255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

export function hexToOklch(hex: string): Lch {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

export function oklchToHex({ L, C, H }: Lch): string {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex([
    toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

export interface Sky {
  colors: [string, string, string];
  /** Points from the top of the page. */
  stops: [number, number, number];
}

/**
 * The sky behind a drawing, ending on the page's ground. `tall`: the desktop
 * page's taller hero stretches it (0, 230, 460 instead of 0, 170, 330).
 */
export function drinkSky(liquid: string | null | undefined, scheme: 'light' | 'dark', ground: string, tall = false): Sky {
  const k = liquid ? hexToOklch(liquid) : { L: 0.8, C: 0, H: 235 };
  const pale = k.C < 0.04;
  const h = pale ? 235 : k.H;
  // The drawing's watercolour is muted on purpose; the page gets a confident version of the same hue.
  const C = pale ? 0.055 : Math.min(0.16, Math.max(0.11, k.C * 1.3));
  // Yellows and limes only look clean when light (lower down they go olive), so lift them.
  const lift = 0.07 * Math.max(0, Math.cos(((h - 105) * Math.PI) / 90));
  // Lighter stops lean warmer (toward yellow, hue about 90), the way light does.
  const warm = h + Math.sign(((90 - h + 540) % 360) - 180) * 12;
  const stretch = tall ? 460 / 330 : 1;
  if (scheme === 'dark') {
    return {
      colors: [oklchToHex({ L: 0.255, C: C * 0.32, H: h }), oklchToHex({ L: 0.215, C: C * 0.16, H: h }), ground],
      stops: [0, Math.round(190 * stretch), Math.round(400 * stretch)],
    };
  }
  return {
    colors: [oklchToHex({ L: 0.952 + lift / 4, C: C * 0.2, H: h }), oklchToHex({ L: 0.958, C: C * 0.08, H: warm }), ground],
    stops: [0, Math.round(170 * stretch), Math.round(330 * stretch)],
  };
}
