/**
 * The drawn renderer for everything that leaves the app (Bet-poster,
 * Bet-print): a page is a ground colour and a list of placed things (boxes,
 * lines of text, drink drawings) in the page's own units. Layouts
 * (lib/paper/poster.ts; the print set's sheets later) build pages from data
 * and know nothing of the platform. Painters draw a page at any size:
 * components/paper/PaperPage.tsx on screen and into a picture on all four
 * platforms; print adds an HTML painter for expo-print and the web's print
 * page (lib/runSheetHtml.ts is the pattern), so a poster and a spec sheet
 * share one set of layouts, faces and drawings. Pure.
 */

import type { DisplayFace } from '@/constants/tokens';

/**
 * Names in the page's display face (a bar's face, else the app's); `mono`,
 * the typewriter face Bet-labels and Bet-print draw on paper (a label's lines,
 * a sheet's caps and amounts); everything else in the system font.
 */
export type PaperFace = 'display' | 'system' | 'mono';

export interface PaperText {
  k: 'text';
  /** Top left of the line box, and the width it's aligned in. */
  x: number;
  y: number;
  w: number;
  t: string;
  size: number;
  face: PaperFace;
  weight?: '400' | '500' | '600';
  /** Letter spacing as a share of the size (0.12 = 0.12em). */
  tracking?: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface PaperBox {
  k: 'box';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  r?: number;
  /** A hairline round it (a label's edge, a table card's cut line). */
  stroke?: string;
}

/** A QR code, `s` units square with its quiet zone, that opens `url`. */
export interface PaperCode {
  k: 'code';
  x: number;
  y: number;
  s: number;
  url: string;
  color: string;
}

/** A drink's drawing (lib/sketch), `s` units square, painted for night on a dark ground. */
export interface PaperDrawing {
  k: 'drawing';
  x: number;
  y: number;
  s: number;
  itemId: string;
  night: boolean;
}

export type PaperEl = PaperText | PaperBox | PaperDrawing | PaperCode;

export interface PaperPage {
  w: number;
  h: number;
  ground: string;
  /** The face `display` text is set in. */
  displayFace: DisplayFace;
  els: PaperEl[];
  /** What the page shows, read out in place of it. */
  alt: string;
}

/** The share poster's sizes, in page units; a picture is 1080 pixels wide (three pixels a unit). `letter` and `a4` are the printed menu poster, in their paper's shape. */
export const POSTER_SIZES = { story: { w: 360, h: 640 }, square: { w: 360, h: 360 }, letter: { w: 360, h: 466 }, a4: { w: 360, h: 509 } } as const;
export type PosterSize = keyof typeof POSTER_SIZES;
export const POSTER_PIXELS = 1080;

/**
 * What the print set prints on, in inches: Letter or A4 for sheets and
 * posters, a 62 × 32 mm roll label for prep labels. A page is printed to fill
 * its paper whatever its units (lib/paper/printHtml.ts).
 */
export const PAPER = { letter: { w: 8.5, h: 11, name: 'Letter' }, a4: { w: 8.27, h: 11.69, name: 'A4' }, label: { w: 2.44, h: 1.26, name: 'Label' } } as const;
export type Paper = keyof typeof PAPER;
/** The papers a sheet prints on. */
export type SheetPaper = 'letter' | 'a4';

/** A sheet's size in points (72 to the inch). */
export const sheetSize = (paper: SheetPaper) => ({ w: Math.round(PAPER[paper].w * 72), h: Math.round(PAPER[paper].h * 72) });

// Where Letter is the paper: the US, Canada, Mexico, Central America, Colombia, Venezuela, Chile, the Philippines.
// South America's A4 countries are named out of America/*; Brazil's zones all start with these cities.
const A4_AMERICAS = /^America\/(Argentina|Buenos_Aires|Montevideo|Asuncion|La_Paz|Lima|Guayaquil|Cayenne|Paramaribo|Guyana|Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Santarem|Noronha|Eirunepe)/;

/**
 * The paper a bar prints on, from its time zone (its page's, else this
 * device's): Letter in the Americas that use it, A4 everywhere else.
 * ponytail: a zone stands in for the bar's country (bars have no country column); a zone list
 * misses the odd island. A paper setting on the bar is the upgrade if anyone prints on the wrong one.
 */
export function paperFor(timeZone: string | null | undefined): SheetPaper {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (zone === 'Pacific/Honolulu' || zone === 'Asia/Manila') return 'letter';
  return zone.startsWith('America/') && !A4_AMERICAS.test(zone) ? 'letter' : 'a4';
}

// A face's average letter, as a share of its size: enough to keep a long name inside its box
// (display at 0.48 cut "Autumn menu" short in Redaction; 0.62 fits it). Mono letters are all 0.6.
const AVERAGE_LETTER: Record<PaperFace, number> = { display: 0.62, system: 0.56, mono: 0.62 };

/** The size a line of text can be set at to fit `width`: `size`, or smaller for a long line, never under `min`. */
export function fitSize(t: string, size: number, width: number, face: PaperFace = 'display', tracking = 0, min = size * 0.45): number {
  const perSize = Math.max(1, t.length) * (AVERAGE_LETTER[face] + tracking);
  return Math.max(min, Math.min(size, width / perSize));
}
