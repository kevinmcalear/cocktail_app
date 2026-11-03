/**
 * A bar's one colour, made safe for both modes: the colour engine and guard
 * rails from the canvas's Theme-page (GWBCX page "themes", theme()), ported
 * as drawn and decided (Kevin, 31 Oct: guard rails as drawn). In OKLCH, so a
 * colour keeps its hue while its lightness moves; contrast is WCAG 2.2.
 *
 * The rails fix a colour rather than refuse it, and say what moved (`moved`;
 * lib/themeRails words it for the owner, so the words load with the Theme
 * screens, not with every page): the button is held 2:1 off the page with a cream or ink label
 * at 4.5:1, text in the colour gets its own shade at 4.5:1 per mode, neon is
 * capped at chroma 0.2 for the button, a grey colour gives ink buttons (cream
 * at night). Grounds stay lib/palette's neutralsFrom, the "quiet grounds" rail.
 */
import { backbar } from '@/constants/tokens';
import { contrast } from '@/lib/color';
import { fromLch, toLch } from '@/lib/palette';

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

export const GREY_CHROMA = GREY;

export type Moved = 'bright' | 'lift' | 'deepen' | 'cream' | 'ink' | 'text';

export interface ThemeColours {
  /** The one main button. */
  fill: string;
  /** Its label: cream or ink. */
  onFill: string;
  /** The colour as text (links, what's selected): 4.5:1 on the ground. */
  text: string;
  /** What the rails moved (lib/themeRails words each). */
  moved: Moved[];
}

/** The lightness nearest `l0` that gives `target`:1 on `bg`: darker on paper, lighter at night. */
function shade(l0: number, c: number, h: number, bg: string, target: number, darker: boolean): number {
  let l = l0;
  for (let i = 0; i < 80 && contrast(fromLch(l, c, h), bg) < target; i++) l += darker ? -0.01 : 0.01;
  return Math.max(0, Math.min(1, l));
}

const cache = new Map<string, ThemeColours>();

/**
 * Every colour a page needs from the bar's one colour, for one mode, on that
 * mode's ground (lib/palette neutralsFor). Remembered, since every themed
 * control asks.
 */
export function themeColours(seed: string, ground: string, dark: boolean): ThemeColours {
  const key = `${seed}|${ground}|${dark ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = computeTheme(seed, ground, dark);
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

function computeTheme(seed: string, ground: string, dark: boolean): ThemeColours {
  const s = toLch(seed);
  const grey = s.c < GREY;
  const h = s.h;
  const moved: Moved[] = [];
  let fl = s.l;
  const fc = Math.min(s.c, MAX_FILL_CHROMA);
  if (s.c > MAX_FILL_CHROMA) moved.push('bright');
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
    if (k > 1) moved.push(dark ? 'lift' : 'deepen');
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
      if (lc !== fl) moved.push('cream');
      fl = lc;
    } else {
      onFill = INK;
      if (li !== fl) moved.push('ink');
      fl = li;
    }
    fill = fromLch(fl, fc, h);
  }
  // The colour as text: its own shade, 4.5:1 on the ground.
  const tc = Math.min(s.c, MAX_TEXT_CHROMA);
  const tl = grey ? (dark ? 0.95 : 0.22) : shade(s.l, tc, h, ground, LABEL, !dark);
  if (!grey && Math.abs(tl - s.l) > 0.04) moved.push('text');
  const text = fromLch(tl, grey ? 0 : tc, h);
  return { fill, onFill, text, moved };
}
