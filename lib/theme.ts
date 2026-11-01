/**
 * A bar's one colour, made safe for both modes: the colour engine and guard
 * rails from the canvas's Theme-page (GWBCX page "themes", theme()), ported
 * as drawn and decided (Kevin, 31 Oct: guard rails as drawn). In OKLCH, so a
 * colour keeps its hue while its lightness moves; contrast is WCAG 2.2.
 *
 * The rails fix a colour rather than refuse it, and say what moved in one
 * plain line: the button is held 2:1 off the page with a cream or ink label
 * at 4.5:1, text in the colour gets its own shade at 4.5:1 per mode, neon is
 * capped at chroma 0.2 for the button, a grey colour gives ink buttons (cream
 * at night). Grounds stay lib/palette's neutralsFrom, the "quiet grounds" rail.
 */
import { backbar } from '@/constants/tokens';
import { contrast } from '@/lib/color';
import { fromLch, neutralsFor, toLch } from '@/lib/palette';

/** The two labels a button can carry: cream (the night page's ink) and ink (the paper's). */
const CREAM = backbar.dark.ink;
const INK = backbar.light.ink;
/** Below this chroma a colour is a grey (a black and white logo): nothing to tint with. */
const GREY = 0.03;
/** Neon: more chroma than a screen shows well. The button keeps up to this much. */
const MAX_FILL_CHROMA = 0.2;
const MAX_TEXT_CHROMA = 0.16;
const LABEL = 4.5;
const OFF_PAGE = 2;

export interface ThemeColours {
  /** The one main button. */
  fill: string;
  /** Its label: cream or ink. */
  onFill: string;
  /** The colour as text (links, what's selected): 4.5:1 on the ground. */
  text: string;
  /** What the rails moved, in plain words, for the owner. */
  notes: string[];
  fillRatio: number;
  textRatio: number;
  /** The button against the page. */
  offPage: number;
}

/** The lightness nearest `l0` that gives `target`:1 on `bg`: darker on paper, lighter at night. */
function shade(l0: number, c: number, h: number, bg: string, target: number, darker: boolean): number {
  let l = l0;
  for (let i = 0; i < 80 && contrast(fromLch(l, c, h), bg) < target; i++) l += darker ? -0.01 : 0.01;
  return Math.max(0, Math.min(1, l));
}

/** True for a colour with no hue to speak of (black, white, greys). */
export const isGrey = (hex: string) => toLch(hex).c < GREY;

const cache = new Map<string, ThemeColours>();

/**
 * Every colour a page needs from the bar's one colour, for one mode, on that
 * mode's ground (lib/palette neutralsFor). `name` is the colour's plain name
 * for the notes ("Rust"). Remembered, since every themed control asks.
 */
export function themeColours(seed: string, ground: string, dark: boolean, name = 'Your colour'): ThemeColours {
  const key = `${seed}|${ground}|${dark ? 1 : 0}|${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = computeTheme(seed, ground, dark, name);
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

function computeTheme(seed: string, ground: string, dark: boolean, name: string): ThemeColours {
  const s = toLch(seed);
  const grey = s.c < GREY;
  const h = s.h;
  const notes: string[] = [];
  let fl = s.l;
  const fc = Math.min(s.c, MAX_FILL_CHROMA);
  if (s.c > MAX_FILL_CHROMA) notes.push(`Toned down: ${name} is brighter than a screen shows well, so its strongest chroma is kept for the button only.`);
  let fill: string;
  let onFill: string;
  if (grey) {
    // Black and white logos: ink buttons on paper, cream at night.
    fill = dark ? backbar.dark.ink : INK;
    onFill = dark ? backbar.dark.ground : CREAM;
  } else {
    fill = fromLch(fl, fc, h);
    // Lift or deepen the fill until the button stands off the page (2:1).
    let k = 0;
    while (contrast(fill, ground) < OFF_PAGE && k++ < 40) {
      fl += dark ? 0.01 : -0.01;
      fill = fromLch(fl, fc, h);
    }
    if (k > 1) notes.push(dark ? 'Lifted a step in dark mode so the button still shows on the night page.' : 'Deepened a step so the button still shows on the paper.');
    // Then the label: cream if a small nudge makes it 4.5:1, else ink.
    const need = (label: string, darker: boolean) => {
      let l = fl;
      for (let i = 0; contrast(fromLch(l, fc, h), label) < LABEL && i < 60; i++) l += darker ? -0.005 : 0.005;
      return l;
    };
    const lc = need(CREAM, true);
    const li = need(INK, false);
    if (Math.abs(lc - fl) <= 0.09 || Math.abs(lc - fl) <= Math.abs(li - fl)) {
      onFill = CREAM;
      if (lc !== fl) notes.push('Button a touch deeper so its cream label reads at 4.5:1.');
      fl = lc;
    } else {
      onFill = INK;
      if (li !== fl) notes.push('Button a touch lighter so its dark label reads at 4.5:1.');
      fl = li;
    }
    fill = fromLch(fl, fc, h);
  }
  // The colour as text: its own shade, 4.5:1 on the ground.
  const tc = Math.min(s.c, MAX_TEXT_CHROMA);
  const tl = grey ? (dark ? 0.95 : 0.22) : shade(s.l, tc, h, ground, LABEL, !dark);
  const word = name.toLowerCase();
  if (!grey && Math.abs(tl - s.l) > 0.04) notes.push(dark ? `Text in ${word} is a shade lighter in dark mode, so it reads at 4.5:1.` : `Text in ${word} is a shade darker on paper, so it reads at 4.5:1.`);
  const text = fromLch(tl, grey ? 0 : tc, h);
  return { fill, onFill, text, notes, fillRatio: contrast(fill, onFill), textRatio: contrast(text, ground), offPage: contrast(fill, ground) };
}

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
