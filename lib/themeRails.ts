import { contrast } from '@/lib/color';
import { fromLch, neutralsFor, toLch } from '@/lib/palette';
import { GREY_CHROMA as GREY, themeColours, type Moved, type ThemeColours } from '@/lib/theme';

/** True for a colour with no hue to speak of (black, white, greys). */
export const isGrey = (hex: string) => toLch(hex).c < GREY;

/** What the rails moved, in plain words for the owner; `name` is the colour's ("Rust"). */
function noteFor(m: Moved, name: string, dark: boolean): string {
  const word = name.toLowerCase();
  switch (m) {
    case 'bright': return `Toned down: ${name} is brighter than a screen shows well, so its strongest chroma is kept for the button only.`;
    case 'lift': return 'Lifted a step in dark mode so the button still shows on the night page.';
    case 'deepen': return 'Deepened a step so the button still shows on the paper.';
    case 'cream': return 'Button a touch deeper so its cream label reads at 4.5:1.';
    case 'ink': return 'Button a touch lighter so its dark label reads at 4.5:1.';
    case 'text': return dark ? `Text in ${word} is a shade lighter in dark mode, so it reads at 4.5:1.` : `Text in ${word} is a shade darker on paper, so it reads at 4.5:1.`;
  }
}

/** A mode's colours with how they read (contrast ratios, for the picker; not worked out on every page). */
export type ThemeLook = ThemeColours & {
  /** The label on the button. */
  fillRatio: number;
  /** The colour as text on the ground. */
  textRatio: number;
  /** The button against the page. */
  offPage: number;
};

function look(t: ThemeColours, ground: string): ThemeLook {
  return { ...t, fillRatio: contrast(t.fill, t.onFill), textRatio: contrast(t.text, ground), offPage: contrast(t.fill, ground) };
}

/**
 * A colour and its saved ground tint in both modes, and what the rails moved
 * in either, once each (the drawn line when nothing had to move).
 */
export function themeFor(accent: string, tint: string | null, name: string): { light: ThemeLook; dark: ThemeLook; notes: string[] } {
  const lightGround = neutralsFor('light', tint).ground;
  const darkGround = neutralsFor('dark', tint).ground;
  const light = themeColours(accent, lightGround, false);
  const dark = themeColours(accent, darkGround, true);
  const all = [...new Set([...light.moved.map((m) => noteFor(m, name, false)), ...dark.moved.map((m) => noteFor(m, name, true))])];
  return { light: look(light, lightGround), dark: look(dark, darkGround), notes: all.length ? all : ['Reads at 4.5:1 or better in both modes, as picked.'] };
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
