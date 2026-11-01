/**
 * Stock counts: the unit and step a spot is counted in, what's on hand from
 * the latest counts, par per item, and which spots in a zone are short.
 * Pure; the Count screen and the prep list render it.
 */

import { formatQuantity, sameKind, toQuantity, type Quantity } from '@/lib/quantity';

/** Bottles are counted in tenths; litres and kilos too; anything else whole. */
export function countStep(unit: string | null | undefined): number {
  const u = (unit ?? '').trim().toLowerCase();
  if (['btl', 'bottle', 'bottles', 'l', 'litre', 'liter', 'kg'].includes(u)) return 0.1;
  if (['ml', 'g'].includes(u)) return 50;
  return 1;
}

/** The unit a spot is counted in: its par's unit, else each. */
export function countUnit(parUnit: string | null | undefined): string {
  return (parUnit ?? '').trim() || 'each';
}

/** "1.4 btl", "0.8 L", "3 each". */
export function formatCount(amount: number, unit: string): string {
  const q = toQuantity(amount, unit);
  if (q && q.kind !== 'count') return formatQuantity(q);
  return `${Number(amount.toFixed(1))} ${unit}`;
}

export interface OnHandRow {
  item_id: string;
  location_id: string | null;
  amount: number | string;
  unit: string;
  counted_at: string;
}

/** What's on hand per item, adding spots up when they share a kind of unit. */
export function onHandByItem(rows: OnHandRow[]): Record<string, Quantity> {
  const out: Record<string, Quantity> = {};
  for (const r of rows) {
    const q = toQuantity(r.amount, r.unit);
    if (!q) {
      // A zero count still counts as "we looked": keep the kind from the unit.
      const zero = toQuantity(1, r.unit)!;
      if (!out[r.item_id]) out[r.item_id] = { ...zero, value: 0 };
      continue;
    }
    const have = out[r.item_id];
    if (!have) out[r.item_id] = { ...q };
    else if (sameKind(have, q)) have.value += q.value;
  }
  return out;
}

/** A batch of house-made someone logged (batch_logs, hooks/useBatches.ts). */
export interface Batch {
  id: string;
  itemId: string;
  amount: number;
  unit: string;
  madeAt: string;
  madeBy: string | null;
}

/**
 * What's on hand per item: the last count, plus the batches made since it
 * (every batch, for an item never counted). A batch in another kind of unit
 * than the count is left out rather than guessed.
 */
export function withBatches(rows: OnHandRow[], batches: readonly Batch[]): Record<string, Quantity> {
  const out = onHandByItem(rows);
  const countedAt: Record<string, number> = {};
  for (const r of rows) countedAt[r.item_id] = Math.max(countedAt[r.item_id] ?? 0, Date.parse(r.counted_at));
  for (const b of batches) {
    if (b.itemId in countedAt && Date.parse(b.madeAt) <= countedAt[b.itemId]) continue;
    const q = toQuantity(b.amount, b.unit);
    if (!q) continue;
    const have = out[b.itemId];
    if (!have) out[b.itemId] = { ...q };
    else if (sameKind(have, q)) have.value += q.value;
  }
  return out;
}

/**
 * A house-made row in Behind the bar (boards Draw-scroll, Desk-page): when it
 * was last made and what's on hand, "Made 30 Oct · 800 ml left". Either half
 * alone when that's all there is; null with neither.
 */
export function madeLine(last: Pick<Batch, 'madeAt'> | undefined, onHand: Quantity | undefined): string | null {
  const made = last ? `Made ${new Date(last.madeAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : null;
  const left = onHand ? (onHand.value > 0 ? `${formatQuantity(onHand)} left` : 'None left') : null;
  return [made, left].filter(Boolean).join(' · ') || null;
}

export type ParQuantity = Quantity & { name: string };

/** Par per item (with its name), adding every spot's par up when they share a kind of unit. */
export function parByItem(locations: { item_id: string; par_amount: number | string | null; par_unit: string | null; item?: { name: string } | null }[]): Record<string, ParQuantity> {
  const out: Record<string, ParQuantity> = {};
  for (const l of locations) {
    const q = toQuantity(l.par_amount, l.par_unit);
    if (!q) continue;
    const have = out[l.item_id];
    if (!have) out[l.item_id] = { ...q, name: l.item?.name ?? 'Hidden item' };
    else if (sameKind(have, q)) have.value += q.value;
  }
  return out;
}

export interface CountedSpot {
  name: string;
  amount: number | null;
  par: number | null;
  unit: string;
  houseMade: boolean;
}

export interface ZoneSummary {
  short: CountedSpot[];
  /** "2 short in this zone. Honey-ginger syrup goes on today's prep list; Dolin Dry on the order." */
  sentence: string;
}

const list = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Which spots in a zone are under par, and where that sends them. */
export function zoneSummary(spots: CountedSpot[]): ZoneSummary {
  const short = spots.filter((s) => s.amount !== null && s.par !== null && s.amount < s.par);
  if (!short.length) return { short, sentence: spots.some((s) => s.amount !== null) ? 'Nothing short in this zone.' : 'Count each spot to see what is short.' };
  const make = short.filter((s) => s.houseMade).map((s) => s.name);
  const order = short.filter((s) => !s.houseMade).map((s) => s.name);
  const parts = [make.length ? `${list(make)} ${make.length === 1 ? 'goes' : 'go'} on today’s prep list` : null, order.length ? `${list(order)} ${order.length === 1 ? 'goes' : 'go'} on the order list` : null].filter(Boolean);
  return { short, sentence: `${short.length} short in this zone. ${parts.join('; ')}.` };
}
