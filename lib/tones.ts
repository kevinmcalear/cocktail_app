/**
 * Android's tonal colours on a drink or item page (board And-page): the
 * controls, the bar's fill, the FAB, the tiles and the menu, in OKLCH from the
 * drink's own hue, the way lib/sky.ts builds the page's sky. Never the
 * wallpaper (And-colour-own, Kevin's pick). An item with no colour of its own
 * takes the venue's accent. A photo leads its page, so its controls stay
 * neutral (And-photo).
 */
import { withAlpha } from './color';
import { hexToOklch, oklchToHex } from './sky';

export interface Tones {
  /** Quiet buttons: Edit, Makes, the group's unpicked half. */
  tonal: string;
  /** The group's picked half, and Makes while its menu is open. */
  primary: string;
  onPrimary: string;
  /** The bar once the page has scrolled under it. */
  bar: string;
  /** The circle behind the bar's icons over a photo. None on a drawing's sky. */
  circle: string | null;
  menu: string;
  fab: string;
  onFab: string;
  tile: string;
  /** The allergen card. */
  card: string;
  /** The allergy warning, in the error colours. */
  warn: { fill: string; ink: string };
}

const lch = (L: number, C: number, H: number) => oklchToHex({ L, C, H });
const WHITE = lch(1, 0, 0);

/** A warning reads as a warning whatever the drink, so these never take its hue. */
const warning = (dark: boolean) => (dark ? { fill: withAlpha(lch(0.4, 0.09, 35), 0.45), ink: lch(0.85, 0.08, 40) } : { fill: lch(0.93, 0.04, 40), ink: lch(0.42, 0.12, 35) });

/** The hue and strength the page's colours are built from: as the sky's, with its icy blue for a clear drink. */
function seed(liquid: string | null, accent: string) {
  const k = hexToOklch(liquid ?? accent);
  if (liquid && k.C < 0.04) return { H: 235, C: 0.055 };
  return { H: k.H, C: Math.min(0.16, Math.max(0.11, k.C * 1.3)) };
}

export function itemTones(liquid: string | null, accent: string, scheme: 'light' | 'dark'): Tones {
  const { H, C } = seed(liquid, accent);
  const dark = scheme === 'dark';
  const fab = Math.min(0.09, C * 0.6);
  return {
    tonal: dark ? lch(0.31, 0.035, H) : lch(0.895, 0.035, H),
    primary: dark ? lch(0.82, Math.min(0.1, C * 0.7), H) : lch(0.42, Math.min(0.12, C * 0.85), H),
    onPrimary: dark ? lch(0.22, 0.03, H) : lch(0.985, 0.008, H),
    bar: dark ? lch(0.225, 0.014, H) : lch(0.935, 0.016, H),
    circle: null,
    menu: dark ? lch(0.255, 0.014, H) : lch(0.965, 0.012, H),
    fab: dark ? lch(0.38, fab, H) : lch(0.86, fab, H),
    onFab: dark ? lch(0.95, 0.02, H) : lch(0.22, 0.04, H),
    tile: dark ? lch(0.215, 0.012, H) : lch(0.975, 0.008, H),
    card: dark ? withAlpha(WHITE, 0.08) : withAlpha(lch(0.3, 0.03, H), 0.07),
    warn: warning(dark),
  };
}

/** Over a photo: warm neutrals, light or dark as the photo decides (And-photo). */
export function photoTones(scheme: 'light' | 'dark'): Tones {
  const light = scheme === 'light';
  return {
    tonal: light ? lch(0.9, 0.012, 80) : lch(0.32, 0.012, 80),
    primary: light ? lch(0.4, 0.06, 60) : lch(0.82, 0.09, 75),
    onPrimary: light ? lch(0.98, 0.005, 80) : lch(0.24, 0.04, 70),
    bar: light ? lch(0.94, 0.005, 80) : lch(0.21, 0.008, 80),
    circle: light ? withAlpha(WHITE, 0.62) : withAlpha(lch(0.2, 0.006, 90), 0.45),
    menu: light ? lch(0.965, 0.005, 80) : lch(0.255, 0.008, 80),
    fab: light ? lch(0.86, 0.03, 80) : lch(0.38, 0.03, 80),
    onFab: light ? lch(0.22, 0.02, 80) : lch(0.95, 0.01, 80),
    tile: light ? lch(0.975, 0.004, 80) : withAlpha(lch(0.23, 0.01, 80), 0.85),
    card: light ? withAlpha(lch(0.3, 0.012, 80), 0.07) : withAlpha(WHITE, 0.08),
    warn: warning(!light),
  };
}
