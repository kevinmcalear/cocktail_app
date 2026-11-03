import { fromLch, neutralsFor, toLch } from '@/lib/palette';
import { GREY_CHROMA as GREY, themeColours, type ThemeColours } from '@/lib/theme';

/** True for a colour with no hue to speak of (black, white, greys). */
export const isGrey = (hex: string) => toLch(hex).c < GREY;


/**
 * A colour and its saved ground tint in both modes, and what the rails moved
 * in either, once each (the drawn line when nothing had to move).
 */
export function themeFor(accent: string, tint: string | null, name: string): { light: ThemeColours; dark: ThemeColours; notes: string[] } {
  const light = themeColours(accent, neutralsFor('light', tint).ground, false, name);
  const dark = themeColours(accent, neutralsFor('dark', tint).ground, true, name);
  const all = [...new Set([...light.notes, ...dark.notes])];
  return { light, dark, notes: all.length ? all : ['Reads at 4.5:1 or better in both modes, as picked.'] };
}

/**
 * Material 3's tonal fill in the bar's hue (its secondary container), for a
 * selected filter chip on Android (canvas Theme-type, Android): a pale tint on
 * paper, a deep one at night, each with its own ink. The tonal colours come
 * from the bar's colour, not the phone's wallpaper (th-n-plat).
 */
export function tonalFor(accent: string, dark: boolean): { fill: string; ink: string } {
  const { h } = toLch(accent);
  return dark ? { fill: fromLch(0.32, 0.05, h), ink: fromLch(0.92, 0.03, h) } : { fill: fromLch(0.9, 0.045, h), ink: fromLch(0.28, 0.06, h) };
}

/**
 * Why a logo colour can't be the button (canvas "From your logo" tiles): too
 * pale or too dark to stand off one of the pages. Null when it can. Greys
 * (black and white logos) can: they give ink buttons.
 */
export function notForButton(hex: string): string | null {
  const { l, c } = toLch(hex);
  if (c < GREY) return l > 0.88 ? 'Too pale for a button' : null;
  if (l < 0.18) return 'Too dark for a button';
  return l > 0.88 && c < 0.06 ? 'Too pale for a button' : null;
}
