/**
 * A prep label (Bet-labels): white roll label with the day's colour down the
 * side, the house-made's name, who made it and when, the use-by, what's in
 * the batch, and a code that opens its page. Built from a batch of
 * house-made (batch_logs) or from Make mode's last step, and drawn by the
 * same renderer as the print set (lib/paper/page.ts). Pure.
 */

import { dayHues, printPaper as P } from '@/constants/tokens';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { labelDate, useByDate as expiry } from '@/lib/makeSteps';

import { fitSize, type PaperEl, type PaperPage } from './page';

export interface BatchLabel {
  name: string;
  made: Date;
  useBy: Date | null;
  /** Who made it: a first name ("Theo"), or initials. */
  by: string;
  /** "1.2 L". */
  amount: string | null;
  /** "Fridge". */
  storage: string | null;
  /** "No allergens", "Egg, milk", or "" when not checked. */
  allergens: string;
  /** The prep's page, which the label's code opens. */
  url: string;
}

const madeLine = (l: BatchLabel) => `MADE ${labelDate(l.made).toUpperCase()}${l.by ? ` · ${l.by.toUpperCase()}` : ''}`;
const byLine = (l: BatchLabel) => (l.useBy ? `USE BY ${labelDate(l.useBy).toUpperCase()}` : null);
const restLine = (l: BatchLabel) => [l.amount, l.storage?.toLowerCase(), l.allergens.toLowerCase()].filter(Boolean).join(' · ');

/** "Friday": the day a batch was made, which its colour stands for. */
export const dayWord = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' });

/** The label's lines, as printed. */
export function labelText(l: BatchLabel): string {
  return [l.name, madeLine(l), byLine(l), restLine(l)].filter(Boolean).join('\n');
}

/** One line short enough to write on masking tape. */
export function tapeText(l: BatchLabel): string {
  return [l.name, `${labelDate(l.made)}${l.by ? ` ${l.by}` : ''}`, l.useBy ? `use by ${labelDate(l.useBy)}` : null].filter(Boolean).join(' · ');
}

/** What a batch of house-made (a batch_logs row) and its prep say, as a label. */
export function labelFromBatch(input: {
  name: string;
  madeAt: string;
  amount: number;
  unit: string;
  /** How long the prep keeps (prep shelf_life_hours); null prints no use-by. */
  shelfLifeHours: number | null;
  storage: string | null;
  allergens: string;
  /** Who made it, as the team knows them. */
  maker: string | null;
  url: string;
}): BatchLabel {
  const made = new Date(input.madeAt);
  const q = toQuantity(input.amount, input.unit);
  return {
    name: input.name,
    made,
    useBy: expiry(made, input.shelfLifeHours),
    by: input.maker?.trim().split(/\s+/)[0] ?? '',
    amount: q ? formatQuantity(q) : `${input.amount} ${input.unit}`,
    storage: input.storage,
    allergens: input.allergens,
    url: input.url,
  };
}

/** The page a batch's label code opens: its house-made, read as scanned from that batch (Bet-labels "Scanned: its page"). */
export const batchPageUrl = (origin: string, itemId: string, batchId: string) => `${origin}/ingredient/${itemId}?batch=${encodeURIComponent(batchId)}`;

/**
 * Where Made. Label it. opens for a batch just logged: `/label/<batch id>`
 * with the batch's own facts, so it draws before the batch has sent (Log
 * batch works with no signal). Without them it reads the batch.
 */
export function labelHref(b: { id: string; itemId: string; amount: number; unit: string; madeAt: string }): string {
  const q = new URLSearchParams({ item: b.itemId, amount: String(b.amount), unit: b.unit, made: b.madeAt });
  return `/label/${encodeURIComponent(b.id)}?${q}`;
}

/** A batch with its house-made's name and how long it keeps (useFridge). */
export interface FridgeBatch {
  id: string;
  itemId: string;
  amount: number;
  unit: string;
  madeAt: string;
  madeBy: string | null;
  name: string;
  shelfLifeHours: number | null;
}

export interface FridgeRow {
  batch: FridgeBatch;
  made: Date;
  useBy: Date | null;
  /** 'today' on its last day, 'past' after it, else null. */
  use: 'today' | 'past' | null;
}

/**
 * In the fridge (Bet-labels): each house-made's latest batch, newest made
 * first, with its day and whether it's on its last day. Batches come newest
 * first, as useFridge reads them; an older batch of the same thing is left
 * out (the new one replaced it).
 */
export function fridgeRows(batches: FridgeBatch[], now: Date): FridgeRow[] {
  const seen = new Set<string>();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const rows: FridgeRow[] = [];
  for (const batch of [...batches].sort((a, b) => b.madeAt.localeCompare(a.madeAt))) {
    if (seen.has(batch.itemId)) continue;
    seen.add(batch.itemId);
    const made = new Date(batch.madeAt);
    const useBy = expiry(made, batch.shelfLifeHours);
    rows.push({ batch, made, useBy, use: !useBy ? null : useBy < now ? 'past' : useBy <= endOfToday ? 'today' : null });
  }
  return rows;
}

/** The label's size, in page units: about 62 × 32 mm, the common roll. */
export const LABEL = { w: 340, h: 176 } as const;

/** The label as a page, as Bet-labels draws it. */
export function prepLabel(l: BatchLabel): PaperPage {
  const { w, h } = LABEL;
  const x = 30;
  const textW = w - x - 104;
  const line = (t: string, y: number, size: number, color: string = P.ink, weight: '500' | '600' = '500'): PaperEl => ({
    k: 'text',
    x,
    y,
    w: textW,
    t,
    size: fitSize(t, size, textW, 'system', 0.04, size * 0.7),
    face: 'system',
    weight,
    tracking: 0.04,
    color,
    align: 'left',
  });
  const els: PaperEl[] = [
    { k: 'box', x: 0, y: 0, w, h, fill: P.paper, r: 6, stroke: P.rule },
    { k: 'box', x: 0, y: 0, w: 16, h, fill: dayHues[l.made.getDay()] },
    line(l.name, 14, 15, P.ink, '600'),
    line(madeLine(l), 42, 12.5),
  ];
  const use = byLine(l);
  if (use) els.push(line(use, 64, 12.5));
  const rest = restLine(l);
  if (rest) els.push(line(rest, 94, 12, P.muted));
  els.push(line(dayWord(l.made), 140, 11, P.muted));
  els.push({ k: 'code', x: w - 92, y: 26, s: 76, url: l.url, color: P.ink });
  return { w, h, ground: P.paper, displayFace: 'redaction', els, alt: `Label: ${labelText(l).replace(/\n/g, ', ')}. ${dayWord(l.made)}'s colour. A code that opens its page.` };
}
