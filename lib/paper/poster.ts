/**
 * The share posters, as Bet-poster draws them: a menu's drinks drawn together
 * on a light panel in the bar's colour and face, its name and its drinks
 * under them; and a person's top three of one drink in a row, each with its
 * score, bar and maker. Story (9:16) and square. The app's name sits at the
 * foot, read from constants/brand.ts (a placeholder until it's picked). Pure.
 */

import { BRAND } from '@/constants/brand';
import { backbar, posterPaper, type DisplayFace } from '@/constants/tokens';
import { accentFill, contrast } from '@/lib/color';
import { plural } from '@/lib/ranking';

import { fitSize, POSTER_SIZES, type PaperDrawing, type PaperEl, type PaperPage, type PosterSize } from './page';

type Scheme = 'light' | 'dark';

const GUTTER = 16;
const EYEBROW = 12;
const FOOTER = 11;

/** The app's name at the foot, as drawn: small, spaced, lower case. */
function footer(w: number, h: number, color: string): PaperEl {
  return { k: 'text', x: 0, y: h - 30, w, t: BRAND.productName.toLowerCase(), size: FOOTER, face: 'system', weight: '500', tracking: 0.08, color, align: 'center' };
}

function eyebrow(t: string, y: number, w: number, color: string): PaperEl {
  const caps = t.toUpperCase();
  return { k: 'text', x: 0, y, w, t: caps, size: fitSize(caps, EYEBROW, w - 2 * GUTTER, 'system', 0.12, 9), face: 'system', weight: '600', tracking: 0.12, color, align: 'center' };
}

export interface MenuPosterDrink {
  id: string;
  name: string;
  /** It has a drawing to show. */
  drawn: boolean;
}

export interface MenuPosterInput {
  name: string;
  /** Over the name: the bar's name, or a home menu's night. */
  eyebrow: string | null;
  drinks: MenuPosterDrink[];
  /** The bar's colour; a home menu has none and sits on the app's paper. */
  accent: string | null;
  face: DisplayFace;
  scheme: Scheme;
}

// Where up to three drawings sit on the panel (Bet-poster): the middle one taller and in front of the other two.
const CLUSTERS: { dx: number; dy: number; s: number }[][] = [
  [],
  [{ dx: -90, dy: 10, s: 180 }],
  [{ dx: -155, dy: 30, s: 160 }, { dx: -5, dy: 30, s: 160 }],
  [{ dx: -150, dy: 44, s: 150 }, { dx: 10, dy: 44, s: 150 }, { dx: -75, dy: 14, s: 170 }],
];

/** A menu's poster: its first three drawn drinks together on the panel, then its name, then (on a story) its drinks. */
export function menuPoster(input: MenuPosterInput, size: PosterSize): PaperPage {
  const { w, h } = POSTER_SIZES[size];
  // A story and the printed poster list the drinks; a square has no room.
  const story = size !== 'square';
  // Cream on the bar's colour as drawn, the colour deepened until it reads; a light colour (amber) takes dark ink instead.
  const palette = input.accent
    ? accentFill(input.accent, backbar.light.ink, posterPaper.cream, contrast(input.accent, posterPaper.cream) >= 3 ? 'light' : undefined)
    : { fill: posterPaper[input.scheme === 'dark' ? 'night' : 'day'], text: backbar[input.scheme].ink };
  const ink = palette.text;
  const els: PaperEl[] = [];

  // Letter is shorter than a story for its width: a lower panel, and the drinks in two columns.
  const letter = size === 'letter';
  const panelH = letter ? 196 : story ? 270 : 200;
  const drawn = input.drinks.filter((d) => d.drawn).slice(0, 3);
  // With nothing drawn yet there's no panel: an empty one reads as broken, so the words sit higher up instead.
  if (drawn.length) els.push({ k: 'box', x: GUTTER, y: GUTTER, w: w - 2 * GUTTER, h: panelH, fill: posterPaper.panel, r: 16 });
  // The panel is light in both themes, so the drawings are painted by day.
  // Letter's lower panel (196) takes the cluster a little smaller than its 200, so nothing crosses the panel's edge.
  const k = letter ? 0.95 : story ? 1.05 : 1;
  const lift = GUTTER + (panelH - 200 * k) / 2;
  // In the cluster's order: the last one is drawn on top.
  const order = drawn.length === 3 ? [drawn[0], drawn[2], drawn[1]] : drawn;
  CLUSTERS[drawn.length].forEach((c, i) => {
    els.push({ k: 'drawing', x: w / 2 + c.dx * k, y: lift + c.dy * k, s: c.s * k, itemId: order[i].id, night: false } satisfies PaperDrawing);
  });

  let y = drawn.length ? GUTTER + panelH + 16 : story ? 96 : 120;
  if (input.eyebrow) {
    els.push(eyebrow(input.eyebrow, y, w, ink));
    y += 22;
  }
  const titleSize = fitSize(input.name, 58, w - 2 * GUTTER, 'display', 0, 12);
  els.push({ k: 'text', x: GUTTER, y, w: w - 2 * GUTTER, t: input.name, size: titleSize, face: 'display', color: ink, align: 'center' });
  y += titleSize * 1.15 + 18;

  if (story) {
    const LINE = letter ? 26 : 30;
    const cols = letter ? 2 : 1;
    const colW = (w - 2 * GUTTER) / cols;
    const names = input.drinks.map((d) => d.name);
    const lines = Math.max(0, Math.floor((h - 30 - 24 - y) / LINE));
    // A list too long for the page keeps its last line for "and N more".
    const room = names.length > lines * cols ? Math.max(0, lines - 1) * cols : lines * cols;
    const shown = names.slice(0, room);
    const rows = Math.ceil(shown.length / cols);
    // Down the first column, then the second: the menu's order reads top to bottom.
    shown.forEach((n, i) => {
      const x = GUTTER + Math.floor(i / rows) * colW;
      els.push({ k: 'text', x, y: y + (i % rows) * LINE, w: colW, t: n, size: fitSize(n, letter ? 18 : 21, colW - 8), face: 'display', color: ink, align: 'center' });
    });
    const more = names.length - shown.length;
    if (more > 0 && lines > 0) {
      els.push({ k: 'text', x: GUTTER, y: y + rows * LINE + 4, w: w - 2 * GUTTER, t: `and ${more} more`, size: 15, face: 'system', color: ink, align: 'center' });
    }
  }

  els.push(footer(w, h, ink));
  const who = input.eyebrow ? `${input.eyebrow}’s ` : '';
  return { w, h, ground: palette.fill, displayFace: input.face, els, alt: `${who}${input.name}: ${input.drinks.map((d) => d.name).join(', ') || 'no drinks yet'}` };
}

export interface TopThreeEntry {
  itemId: string;
  /** 0 to 10. */
  score: number;
  bar: string | null;
  maker: string | null;
  drawn: boolean;
}

export interface TopThreeInput {
  /** The person's first name, or null for "My". */
  person: string | null;
  /** The list: "Negroni". */
  listName: string;
  /** Best first; only the first three are drawn. */
  entries: TopThreeEntry[];
  scheme: Scheme;
}

/** A person's top three of one drink in a row: drawing, score, bar and maker in each column. */
export function topThreePoster(input: TopThreeInput, size: PosterSize): PaperPage {
  const { w, h } = POSTER_SIZES[size];
  const ink = backbar[input.scheme].ink;
  const muted = backbar[input.scheme].muted;
  const night = input.scheme === 'dark';
  const entries = input.entries.slice(0, 3);
  const BLOCK = 252;
  const top = size === 'story' ? Math.round((h - BLOCK) / 2) - 10 : 28;
  const owner = input.person ? `${input.person}’s` : 'My';
  const title = `${owner} best ${plural(input.listName)}`;
  const els: PaperEl[] = [eyebrow(title, top, w, muted)];

  const colW = (w - GUTTER) / 3;
  const left = (w - entries.length * colW) / 2;
  entries.forEach((e, i) => {
    const x = left + i * colW;
    const inner = colW - 8;
    if (e.drawn) els.push({ k: 'drawing', x: x + colW / 2 - 50, y: top + 42, s: 100, itemId: e.itemId, night });
    els.push({ k: 'text', x, y: top + 162, w: colW, t: e.score.toFixed(1), size: 40, face: 'display', color: ink, align: 'center' });
    if (e.bar) els.push({ k: 'text', x: x + 4, y: top + 212, w: inner, t: e.bar, size: fitSize(e.bar, 18, inner, 'display', 0, 11), face: 'display', color: ink, align: 'center' });
    if (e.maker) els.push({ k: 'text', x: x + 4, y: top + 236, w: inner, t: e.maker, size: fitSize(e.maker, 12, inner, 'system', 0, 9), face: 'system', color: muted, align: 'center' });
  });

  els.push(footer(w, h, muted));
  const rows = entries.map((e, i) => `${i + 1}, ${[e.bar, e.maker && `by ${e.maker}`].filter(Boolean).join(' ') || 'unnamed'}, ${e.score.toFixed(1)}`);
  return { w, h, ground: posterPaper[night ? 'night' : 'day'], displayFace: 'redaction', els, alt: `${title}: ${rows.join('; ')}` };
}
