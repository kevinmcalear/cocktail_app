// Bring in's own rules: what something given to it is, how clean text is
// read on the phone (no AI), what the Reading view says while it works, and
// the geometry of a source crop. Pure; the screens are
// components/screens/bringin and the reading itself is store/useBringIn.

import { parseBringIn, parseMenuPaste } from '@/lib/paste';
import type { MenuPhoto } from '@/lib/readMenu';
import type { AnythingReading, ReadBox, ReadKind, RecipeReading } from '@/supabase/functions/_shared/anythingRead';
import type { BottleReading } from '@/supabase/functions/_shared/bottleRead';

export type { ReadKind };

/** Something given to Bring in: photos or PDFs, text, or a link. `name` is a dropped file's name. */
export interface ReadSource {
  files: MenuPhoto[];
  text: string | null;
  url: string | null;
  name?: string | null;
}

export const KIND_LABEL: Record<ReadKind, string> = { menu: 'Menu', recipes: 'Recipe', bottles: 'Bottles' };
export const READ_KIND_ORDER: ReadKind[] = ['menu', 'recipes', 'bottles'];

/** A lone web link. */
export const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

// A few words a menu or a list never has: a caption or a recipe written out as prose.
const PROSE = /\b(the|and|then|with|until|into|your|you)\b/i;

/**
 * Text clean enough to read on the phone: spec lines ("30 ml gin"), or a
 * short list (a drink, a bottle or a priced menu line on each). Prose, a
 * caption or a link goes to the reader instead.
 */
export function isCleanText(text: string): boolean {
  const rows = text.split('\n').map((r) => r.trim()).filter(Boolean);
  if (!rows.length || isLink(text)) return false;
  if (parseBringIn(text, 'drinks').some((block) => block.lines.length)) return true;
  return rows.every((row) => row.split(/\s+/).length <= 8 && !(row.length > 30 && PROSE.test(row)));
}

const NOTE_KEYS: [RegExp, 'method' | 'glass' | 'ice' | 'garnish'][] = [
  [/^(shaken|shake|stirred|stir|built|build|blended|blend|thrown|swizzled|churned|churn|whip(?:ped)?)\.?$/i, 'method'],
  [/^ice:\s*/i, 'ice'],
  [/^garnish:\s*/i, 'garnish'],
  [/^glass:\s*/i, 'glass'],
];

/** Clean text read on the phone, as a reading of the kind asked (or the one it looks like). */
export function localReading(text: string, as: ReadKind | null = null): AnythingReading {
  const blocks = parseBringIn(text, 'drinks');
  const specs = blocks.some((block) => block.lines.length);
  const kind: ReadKind = as ?? (specs ? 'recipes' : 'menu');
  const empty = { kind, menu: null, recipes: [], bottles: [], skipped: [], unreadable: [] };
  if (kind === 'bottles') {
    const names = text.split('\n').map((r) => r.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return { ...empty, bottles: names.map((name): BottleReading => ({ brand: null, name, kind: null, abv: null })) };
  }
  if (kind === 'menu') {
    const sections = parseMenuPaste(text, false).map((s) => ({ name: s.name, lines: s.lines.map((l) => ({ name: l.name, price: l.price, ingredients: [] })) }));
    return { ...empty, menu: { title: null, sections } };
  }
  const recipes = blocks
    .filter((block) => block.name.trim())
    .map((block): RecipeReading => {
      const recipe: RecipeReading = { name: block.name.trim(), by: null, lines: [], method: null, glass: null, ice: null, garnish: null, notes: null };
      recipe.lines = block.lines.map((line) => ({ amount: line.amount, unit: line.unit, ingredient: line.name, unsure: false }));
      const rest: string[] = [];
      for (const note of block.notes) {
        // "Top soda water", "Top with ginger beer": a line with no amount.
        const top = note.match(/^top(?:\s+(?:up\s+)?with)?\s+(.+)$/i);
        if (top) {
          recipe.lines.push({ amount: null, unit: 'top', ingredient: top[1].trim(), unsure: false });
          continue;
        }
        const hit = NOTE_KEYS.find(([re]) => re.test(note));
        if (hit && !recipe[hit[1]]) recipe[hit[1]] = hit[1] === 'method' ? note.replace(/\.$/, '') : note.replace(hit[0], '').trim();
        else if (/^by\s+/i.test(note) && !recipe.by) recipe.by = note.replace(/^by\s+/i, '').trim();
        else rest.push(note);
      }
      recipe.notes = rest.join('\n') || null;
      return recipe;
    });
  return { ...empty, recipes };
}

/** How many things a reading found, and of what: "9 drinks in 2 sections". */
export function foundLine(reading: AnythingReading): string {
  const n = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;
  if (reading.kind === 'menu' && reading.menu) {
    const drinks = reading.menu.sections.reduce((sum, s) => sum + s.lines.length, 0);
    return `${n(drinks, 'drink')} in ${n(reading.menu.sections.length, 'section')}`;
  }
  if (reading.kind === 'bottles') return n(reading.bottles.length + (reading.unreadable?.length ?? 0), 'bottle');
  const lines = reading.recipes.reduce((sum, r) => sum + r.lines.length, 0);
  return `${n(reading.recipes.length, 'drink')}, ${n(lines, 'line')}`;
}

/** What it found, as the first step says it: "Found a menu: Little Rye, Spring". */
export function foundTitle(reading: AnythingReading): string {
  if (reading.kind === 'menu') return reading.menu?.title ? `Found a menu: ${reading.menu.title}` : 'Found a menu';
  if (reading.kind === 'bottles') return 'Found bottles on a shelf';
  if (reading.recipes.length === 1) return `Found a recipe: ${reading.recipes[0].name}`;
  return `Found ${reading.recipes.length} recipes`;
}

/** What it is, for the tray and Last time: "the Spring menu", "Orchard Fizz", "8 bottles". */
export function readingName(reading: AnythingReading): string {
  if (reading.kind === 'menu') {
    const title = reading.menu?.title?.trim();
    if (!title) return 'the menu';
    return /menu$/i.test(title) ? `the ${title}` : `the ${title} menu`;
  }
  if (reading.kind === 'bottles') return foundLine(reading);
  return reading.recipes.length === 1 ? reading.recipes[0].name : `${reading.recipes.length} recipes`;
}

export interface ReadingStep {
  label: string;
  /** Muted words after the label: "· 3 of 9". */
  detail?: string;
  state: 'done' | 'now' | 'next';
}

/**
 * The Reading view's checklist. Every step is something that really
 * happens: the reader reads the pages, then the app matches what came back
 * against your bar (once its catalog has loaded), then the ingredients of
 * any new drinks.
 */
export function readingSteps(input: {
  pages: number;
  reading: AnythingReading | null;
  /** Matched against your bar: null while the catalog loads. */
  matched: { have: number; total: number; newDrinks: number } | null;
  /** How much of the catalog has downloaded (0 to 1) while it does, else null. */
  catalog?: number | null;
}): ReadingStep[] {
  const { reading, matched } = input;
  const what = input.pages ? `Reading ${input.pages === 1 ? 'the page' : `${input.pages} pages`}` : 'Reading it';
  if (!reading) return [{ label: what, state: 'now' }, { label: 'Matching to your bar', state: 'next' }];
  const steps: ReadingStep[] = [
    { label: foundTitle(reading), state: 'done' },
    { label: foundLine(reading), state: 'done' },
    matched
      ? { label: 'Matched to your bar', detail: `· ${matched.have} of ${matched.total} already yours`, state: 'done' }
      : { label: 'Matching to your bar', detail: input.catalog != null ? `· getting the catalog, ${Math.round(input.catalog * 100)}%` : undefined, state: 'now' },
  ];
  if (reading.kind === 'menu') steps.push({ label: 'Reading ingredients for new drinks', detail: matched ? `· ${matched.newDrinks} new` : undefined, state: matched ? 'done' : 'next' });
  return steps;
}

/** The share of the steps done, 0 to 100, for the progress bar. */
export function stepsDone(steps: ReadingStep[]): number {
  if (!steps.length) return 0;
  const score = steps.reduce((sum, s) => sum + (s.state === 'done' ? 1 : s.state === 'now' ? 0.4 : 0), 0);
  return Math.round((score / steps.length) * 100);
}

/** "Looks like a menu · 2 pages", for a file in the drop list or the queue. */
export function looksLike(reading: AnythingReading, pages: number): string {
  const tail = pages > 1 ? ` · ${pages} pages` : '';
  if (reading.kind === 'menu') return `Looks like a menu${tail}`;
  if (reading.kind === 'bottles') return `Looks like bottles${tail}`;
  return `Looks like ${reading.recipes.length === 1 ? 'a recipe' : `${reading.recipes.length} recipes`}${tail}`;
}

// Things a bar makes rather than buys.
const PREP = /\b(syrup|cordial|shrub|oleo|infusion|infused|tincture|foam|brine|sherbet|falernum|orgeat|reduction|batch|solution|wash(?:ed)?|grenadine)\b/i;

/** A name that sounds like a house prep ("Fig syrup", "Honey syrup 2:1"). */
export const isPrepName = (name: string) => PREP.test(name);

/** "Honey syrup 2:1" → "2 honey, 1 water". Null when no ratio is written. */
export function prepRatio(name: string): string | null {
  const m = name.match(/^(.+?)\s+syrup\b.*?\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return `${m[2]} ${m[1].trim().toLowerCase()}, ${m[3]} water`;
}

/** One bottle in shelf order: a read bottle, or one it couldn't read. Numbered left to right by where they stand. */
export type ShelfSpot = { kind: 'bottle'; index: number; reading: BottleReading } | { kind: 'unreadable'; index: number; box: ReadBox | null; page: number | null };

export function shelfOrder(reading: AnythingReading): ShelfSpot[] {
  const spots: (ShelfSpot & { x: number })[] = [
    ...reading.bottles.map((b, index) => ({ kind: 'bottle' as const, index, reading: b, x: b.at ? b.at.page * 1000 + b.at.box[1] : Infinity })),
    ...(reading.unreadable ?? []).map((u, index) => ({ kind: 'unreadable' as const, index, box: u.at?.box ?? null, page: u.at?.page ?? null, x: u.at ? u.at.page * 1000 + u.at.box[1] : Infinity })),
  ];
  // Stable: without places, read bottles keep their order and unreadable ones go last.
  return spots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.x - b.s.x || a.i - b.i)
    .map(({ s }) => {
      const { x: _x, ...spot } = s;
      return spot as ShelfSpot;
    });
}

/**
 * Where to draw a photo so the box fills a frame: the image's size and
 * offset inside a frame that clips it (cover, centred on the box).
 */
export function cropLayout(box: ReadBox, image: { width: number; height: number }, frame: { width: number; height: number }) {
  const [ymin, xmin, ymax, xmax] = box;
  const boxW = ((xmax - xmin) / 1000) * image.width;
  const boxH = ((ymax - ymin) / 1000) * image.height;
  const scale = Math.max(frame.width / Math.max(boxW, 1), frame.height / Math.max(boxH, 1));
  const width = image.width * scale;
  const height = image.height * scale;
  const left = -(xmin / 1000) * width + (frame.width - boxW * scale) / 2;
  const top = -(ymin / 1000) * height + (frame.height - boxH * scale) / 2;
  return { width, height, left, top };
}

/** A box on a page drawn at `size`, as a style rect. */
export function boxRect(box: ReadBox, size: { width: number; height: number }) {
  const [ymin, xmin, ymax, xmax] = box;
  return { left: (xmin / 1000) * size.width, top: (ymin / 1000) * size.height, width: ((xmax - xmin) / 1000) * size.width, height: ((ymax - ymin) / 1000) * size.height };
}

/** How many pages the reading strip shows before "+6" (board w2-import-review, E37). */
const STRIP = 6;

/** The pages in the reading strip: a window of six around the page shown, so it's always there. */
export function stripWindow(count: number, page: number): { from: number; to: number } {
  if (count <= STRIP) return { from: 0, to: count };
  const from = Math.min(Math.max(page - 2, 0), count - STRIP);
  return { from, to: from + STRIP };
}

/** A page Reading shows: a file you gave, or one page of a PDF drawn on the phone (`of`: the file it's from). */
export interface ReadingPage {
  file: MenuPhoto;
  of: number;
  /** A PDF's page: the reader says only which file a line is in, not which page, so it gets no boxes. */
  drawn: boolean;
}

/** The files as pages: a PDF drawn on the phone becomes its pages, anything else is itself. */
export function readingPages(files: readonly MenuPhoto[], drawn: Record<string, MenuPhoto[]> | undefined): ReadingPage[] {
  return files.flatMap((file, of): ReadingPage[] => {
    const pages = drawn?.[file.uri];
    return pages?.length ? pages.map((page) => ({ file: page, of, drawn: true })) : [{ file, of, drawn: false }];
  });
}
