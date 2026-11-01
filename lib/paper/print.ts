/**
 * The print set (Bet-print, Bet-table): the list on now, the run sheet, spec
 * and study sheets and table cards, as pages for the drawn renderer
 * (lib/paper/page.ts), so they print through the same painter, faces and
 * codes as the share poster. Letter or A4 (the bar's paper, paperFor), in
 * points. Black ink on white paper, with the bar's colour on the band, its
 * name over the page in the typewriter face, and its face on every drink's
 * name. Pure.
 */

import { printPaper as P, type DisplayFace } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import { labelDate } from '@/lib/makeSteps';

import { fitSize, sheetSize, type PaperEl, type PaperPage, type PaperText, type SheetPaper } from './page';

const M = 48;
const BAND = 14;

/** The bar the set prints for: its name, its colour and its face. */
export interface PrintBar {
  name: string;
  /** Its colour; null prints in ink. */
  accent: string | null;
  face: DisplayFace;
}

/** A drink on the list, with its spec for the sheets that need one. */
export interface PrintDrink {
  id: string;
  name: string;
  /** What guests hear: its ingredients as the menu prints them. */
  line: string;
  price: string | null;
  /** The spec per serve: "30 ml" and "Gin". */
  spec: { amount: string; name: string }[];
  /** "Rocks · Large cube · Orange peel". */
  serve: string;
  /** Its page in the app, which the staff sheets' codes open. */
  url: string;
  /** Its public page (who made it, Rank it), which a table card's code opens. */
  publicUrl: string;
}

/** The bar's colour as ink on white paper: deepened until it reads (4.5:1). */
export function barInk(bar: PrintBar): string {
  return bar.accent ? readableAccent(bar.accent, P.paper) : P.ink;
}

const text = (t: string, x: number, y: number, w: number, size: number, o: Partial<PaperText> = {}): PaperText => ({
  k: 'text',
  x,
  y,
  w,
  t,
  size,
  face: 'system',
  color: P.ink,
  align: 'left',
  ...o,
});

/** A line of caps in the typewriter face (Bet-print's "LITTLE RYE", "RUN SHEET · FRI 31 OCT"). */
const mono = (t: string, x: number, y: number, w: number, size: number, o: Partial<PaperText> = {}): PaperText => {
  const c = t.toUpperCase();
  return text(c, x, y, w, fitSize(c, size, w, 'mono', 0.12, 7), { face: 'mono', weight: '600', tracking: 0.12, ...o });
};

const caps = (t: string, y: number, color: string, S: { w: number }, size = 12): PaperText => mono(t, M, y, S.w - 2 * M, size, { color, align: 'center' });

const page = (bar: PrintBar, S: { w: number; h: number }, els: PaperEl[], alt: string): PaperPage => ({ w: S.w, h: S.h, ground: P.paper, displayFace: bar.face, els, alt });

/** "Friday 31 October". */
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * The list on now (Bet-print "The list on now"): the bar's colour across the
 * top, its name, the menu's name, each drink with what's in it and its
 * price, and at the foot the date and who's on tonight. One page while the
 * rows fit at a readable size; a long list carries on over more pages.
 */
export function listOnNow(input: { bar: PrintBar; menuName: string; drinks: PrintDrink[]; date: Date; team: string | null; paper?: SheetPaper }): PaperPage[] {
  const { bar, drinks } = input;
  const S = sheetSize(input.paper ?? 'letter');
  const ink = barInk(bar);
  const foot = [longDate(input.date), input.team ? `tonight ${input.team}` : null].filter(Boolean).join(' · ');
  const MIN_ROW = 54;
  const MAX_ROW = 96;
  const bottom = S.h - 76;
  const pages: PaperPage[] = [];
  let at = 0;
  do {
    const first = at === 0;
    const els: PaperEl[] = [];
    if (bar.accent) els.push({ k: 'box', x: 0, y: 0, w: S.w, h: BAND, fill: bar.accent });
    els.push(caps(bar.name, 40, ink, S));
    const titleSize = fitSize(input.menuName, first ? 60 : 30, S.w - 2 * M, 'display', 0, 18);
    els.push(text(input.menuName, M, 62, S.w - 2 * M, titleSize, { face: 'display', align: 'center' }));
    const top = 62 + titleSize * 1.25 + (first ? 30 : 18);
    const fits = Math.max(1, Math.floor((bottom - top) / MIN_ROW));
    const rows = drinks.slice(at, at + fits);
    const row = Math.min(MAX_ROW, (bottom - top) / Math.max(rows.length, 1));
    const k = row / MAX_ROW;
    rows.forEach((d, i) => {
      const y = top + i * row;
      const name = Math.max(18, 34 * k);
      const price = d.price ?? '';
      const priceW = price ? 70 : 0;
      els.push(text(d.name, M, y, S.w - 2 * M - priceW, fitSize(d.name, name, S.w - 2 * M - priceW, 'display', 0, 14), { face: 'display' }));
      if (price) els.push(text(price, S.w - M - priceW, y, priceW, name, { face: 'display', align: 'right' }));
      if (d.line) els.push(text(d.line, M, y + name * 1.25, S.w - 2 * M, Math.max(11, 17 * k), { color: P.muted }));
    });
    if (!drinks.length) els.push(text('No drinks on this menu yet.', M, top, S.w - 2 * M, 16, { color: P.muted, align: 'center' }));
    els.push(text(foot, M, S.h - 52, S.w - 2 * M, 12, { color: P.muted, align: 'center' }));
    at += rows.length;
    pages.push(page(bar, S, els, `${bar.name}, ${input.menuName}: ${rows.map((d) => d.name).join(', ')}. ${foot}`));
  } while (at < drinks.length);
  return pages;
}

const specLines = (els: PaperEl[], spec: PrintDrink['spec'], x: number, y: number, w: number, size: number, blank = false): number => {
  const amountW = size * 6;
  spec.forEach((l, i) => {
    const ly = y + i * size * 1.6;
    if (blank) els.push({ k: 'box', x, y: ly + size * 1.15, w: amountW - size, h: 1, fill: P.rule });
    else els.push(text(l.amount, x, ly, amountW - size, fitSize(l.amount, size, amountW - size, 'mono', 0, size * 0.7), { face: 'mono', weight: '600' }));
    els.push(text(l.name, x + amountW, ly, w - amountW, size));
  });
  return y + spec.length * size * 1.6;
};

/**
 * One drink a page (Bet-print "Spec sheets"): the bar's colour and name, the
 * drink's name in its face, the spec per serve, how it goes out, and a code
 * to its page in the corner.
 */
export function specSheet(bar: PrintBar, d: PrintDrink, date: Date, paper: SheetPaper = 'letter'): PaperPage {
  const S = sheetSize(paper);
  const ink = barInk(bar);
  const els: PaperEl[] = [];
  if (bar.accent) els.push({ k: 'box', x: 0, y: 0, w: S.w, h: BAND, fill: bar.accent });
  els.push(caps(`${bar.name} · spec · ${labelDate(date)}`, 40, ink, S));
  const size = fitSize(d.name, 56, S.w - 2 * M, 'display', 0, 24);
  els.push(text(d.name, M, 70, S.w - 2 * M, size, { face: 'display' }));
  let y = 70 + size * 1.25 + 8;
  if (d.serve) {
    els.push(text(d.serve, M, y, S.w - 2 * M, 16, { color: P.muted }));
    y += 40;
  }
  y = specLines(els, d.spec, M, y, S.w - 2 * M, 20);
  if (d.line) els.push(text(`On the menu: ${d.line}`, M, y + 24, S.w - 2 * M - 150, 13, { color: P.muted }));
  els.push({ k: 'code', x: S.w - M - 120, y: S.h - M - 140, s: 120, url: d.url, color: P.ink });
  els.push(text('Scan for its page', S.w - M - 140, S.h - M - 14, 140, 11, { color: P.muted, align: 'center' }));
  return page(bar, S, els, `${d.name} spec: ${d.spec.map((l) => `${l.amount} ${l.name}`).join(', ')}`);
}

/** Drinks one after another down the pages, each block `height(d)` tall, under a heading the first page carries. */
function flow(bar: PrintBar, S: { w: number; h: number }, drinks: PrintDrink[], head: (els: PaperEl[]) => number, height: (d: PrintDrink) => number, draw: (els: PaperEl[], d: PrintDrink, y: number) => void, alt: string): PaperPage[] {
  const pages: PaperPage[] = [];
  let els: PaperEl[] = [];
  let y = head(els);
  for (const d of drinks) {
    const h = height(d);
    if (y + h > S.h - M && y > 120) {
      pages.push(page(bar, S, els, alt));
      els = [];
      y = M;
    }
    draw(els, d, y);
    y += h;
  }
  pages.push(page(bar, S, els, alt));
  return pages;
}

const RUN_LINE = 14;

/**
 * Tonight's drinks for the well (Bet-print "Run sheet"): the date over the
 * page, then each drink with its spec, how it goes out, and a code to its page.
 */
export function runSheet(bar: PrintBar, drinks: PrintDrink[], date: Date, paper: SheetPaper = 'letter'): PaperPage[] {
  const S = sheetSize(paper);
  const blockH = (d: PrintDrink) => Math.max(36 + d.spec.length * RUN_LINE * 1.6 + 22, 96) + 16;
  return flow(
    bar,
    S,
    drinks,
    (els) => {
      els.push(mono(`Run sheet · ${labelDate(date)}`, M, M, (S.w - 2 * M) / 2, 11, { color: P.muted }));
      els.push(mono(bar.name, S.w / 2, M, S.w / 2 - M, 11, { color: barInk(bar), align: 'right' }));
      return M + 30;
    },
    blockH,
    (els, d, y) => {
      els.push({ k: 'box', x: M, y, w: S.w - 2 * M, h: 1, fill: P.hairline });
      els.push(text(d.name, M, y + 8, S.w - 2 * M - 100, fitSize(d.name, 26, S.w - 2 * M - 100, 'display', 0, 16), { face: 'display' }));
      const end = specLines(els, d.spec, M, y + 44, S.w - 2 * M - 100, RUN_LINE);
      if (d.serve) els.push(text(d.serve, M, end + 2, S.w - 2 * M - 100, 12, { color: P.muted }));
      els.push({ k: 'code', x: S.w - M - 76, y: y + 10, s: 76, url: d.url, color: P.ink });
    },
    `${bar.name} run sheet, ${labelDate(date)}: ${drinks.map((d) => d.name).join(', ')}`,
  );
}

/**
 * The menu to learn (Bet-print "Study sheets", for Learn): each drink with
 * what guests hear, then its spec with the amounts left blank to fill in,
 * and how it goes out.
 */
export function studySheets(bar: PrintBar, menuName: string, drinks: PrintDrink[], paper: SheetPaper = 'letter'): PaperPage[] {
  const S = sheetSize(paper);
  const LINE = 14;
  return flow(
    bar,
    S,
    drinks,
    (els) => {
      if (bar.accent) els.push({ k: 'box', x: 0, y: 0, w: S.w, h: BAND, fill: bar.accent });
      els.push(caps(`${bar.name} · study`, 40, barInk(bar), S));
      const size = fitSize(menuName, 40, S.w - 2 * M, 'display', 0, 18);
      els.push(text(menuName, M, 62, S.w - 2 * M, size, { face: 'display', align: 'center' }));
      els.push(text('Fill in each amount, then check it against the spec.', M, 62 + size * 1.25 + 4, S.w - 2 * M, 12, { color: P.muted, align: 'center' }));
      return 62 + size * 1.25 + 40;
    },
    (d) => 34 + (d.line ? 20 : 0) + d.spec.length * LINE * 1.6 + (d.serve ? 20 : 0) + 18,
    (els, d, y) => {
      els.push({ k: 'box', x: M, y, w: S.w - 2 * M, h: 1, fill: P.hairline });
      els.push(text(d.name, M, y + 8, S.w - 2 * M, fitSize(d.name, 22, S.w - 2 * M, 'display', 0, 14), { face: 'display' }));
      let at = y + 38;
      if (d.line) {
        els.push(text(d.line, M, at, S.w - 2 * M, 12, { color: P.muted }));
        at += 20;
      }
      at = specLines(els, d.spec, M, at, S.w - 2 * M, LINE, true);
      if (d.serve) els.push(text(d.serve, M, at + 2, S.w - 2 * M, 12, { color: P.muted }));
    },
    `${bar.name} study sheet, ${menuName}: ${drinks.map((d) => d.name).join(', ')}`,
  );
}

/** A table card's size: four to a sheet, a quarter of the paper (4¼ × 5½ in on Letter), with a hairline to cut along. */
export const cardSize = (paper: SheetPaper) => {
  const S = sheetSize(paper);
  return { w: S.w / 2, h: S.h / 2 };
};

/** A table the cards print for: its number, and the page its code opens. */
export interface PrintTable {
  n: number;
  url: string;
}

/**
 * Table cards (Bet-table "The table card"): the bar's colour and name, What
 * did you think?, a code that opens the table's page to see who made each
 * drink and rank it, and the table's number at the foot. One card a table,
 * four to a sheet.
 */
export function tableCards(bar: PrintBar, tables: PrintTable[], paper: SheetPaper = 'letter'): PaperPage[] {
  const S = sheetSize(paper);
  const CARD = cardSize(paper);
  const ink = barInk(bar);
  const pages: PaperPage[] = [];
  for (let i = 0; i < tables.length; i += 4) {
    const els: PaperEl[] = [];
    const four = tables.slice(i, i + 4);
    four.forEach((t, j) => {
      const x = (j % 2) * CARD.w;
      const y = Math.floor(j / 2) * CARD.h;
      const w = CARD.w;
      // The card's lines sit as Bet-table draws them, in the middle of a taller A4 card.
      const top = y + (CARD.h - 396) / 2;
      const mid = (s: string, ty: number, size: number, o: Partial<PaperText> = {}) => text(s, x + 16, top + ty, w - 32, size, { align: 'center', ...o });
      els.push({ k: 'box', x, y, w, h: CARD.h, fill: P.paper, stroke: P.hairline });
      if (bar.accent) els.push({ k: 'box', x: x + 1, y: y + 1, w: w - 2, h: 8, fill: bar.accent });
      els.push(mono(bar.name, x + 16, top + 32, w - 32, 12, { color: ink, align: 'center' }));
      els.push(mid('What did you think?', 54, fitSize('What did you think?', 30, w - 32, 'display', 0, 18), { face: 'display' }));
      els.push(mid('Point your camera here', 98, 13, { color: P.muted }));
      els.push({ k: 'code', x: x + w / 2 - 72, y: top + 124, s: 144, url: t.url, color: P.ink });
      els.push(mid('See who made your drink,', 286, 14));
      els.push(mid('and rank it. No app needed.', 304, 14));
      els.push(text(`Table ${t.n}`, x + 16, top + 344, w - 32, 11, { face: 'mono', weight: '500', tracking: 0.02, color: P.muted, align: 'center' }));
    });
    pages.push(page(bar, S, els, `Table cards for tables ${four.map((t) => t.n).join(', ')}: scan to see who made your drink and rank it`));
  }
  return pages;
}

/** The tables to print cards for, in order, at most 200: "12" is tables 1 to 12; "5-8" and "1, 3, 5-8" are those tables. */
export function parseTables(input: string): number[] {
  const parts = input.split(/[,\s]+/).filter(Boolean);
  const out: number[] = [];
  for (const part of parts) {
    const m = /^(\d{1,3})(?:[-–](\d{1,3}))?$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? null : Number(m[2]);
    const [from, to] = b !== null ? [Math.min(a, b), Math.max(a, b)] : parts.length === 1 ? [1, a] : [a, a];
    for (let n = Math.max(1, from); n <= to && out.length < 200; n++) if (!out.includes(n)) out.push(n);
  }
  return out;
}
