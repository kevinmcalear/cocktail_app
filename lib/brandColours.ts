/**
 * The brand screen's colour words: a plain name for a colour ("Rust",
 * "Cream", "Ink"), and the home-screen icon's background.
 */
import { backbar, DEFAULT_ACCENT } from '@/constants/tokens';
import { parseHex } from '@/lib/color';

/** Cream, the home-screen icon's light background. */
export const ICON_CREAM = backbar.dark.ink;

/** The home-screen icon's background a venue picks on Brand (bars.icon_background). */
export type IconBackground = 'accent' | 'ground' | 'cream';

/** The colour behind the icon for a pick, as venue-app draws it (supabase/functions/_shared/iconBackground.ts). */
export function iconFill(bg: IconBackground, look: { accent: string | null; groundTint: string | null }): string {
  if (bg === 'accent') return look.accent ?? DEFAULT_ACCENT;
  if (bg === 'ground') return look.groundTint ?? backbar.dark.ground;
  return ICON_CREAM;
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const HUES: [number, string][] = [
  [12, 'Red'],
  [28, 'Rust'],
  [45, 'Amber'],
  [68, 'Gold'],
  [165, 'Green'],
  [200, 'Teal'],
  [255, 'Blue'],
  [295, 'Violet'],
  [340, 'Plum'],
  [360, 'Red'],
];

/** A plain name for a colour, for the swatch cards. Close enough, never a brand name. */
export function colourName(hex: string): string {
  const { h, s, l } = hsl(hex);
  if (l >= 0.85) return h < 70 || h > 330 ? 'Cream' : 'Mist';
  if (l <= 0.16) return 'Ink';
  if (s < 0.12) return l > 0.5 ? 'Stone' : 'Charcoal';
  return HUES.find(([upTo]) => h < upTo)?.[1] ?? 'Red';
}
