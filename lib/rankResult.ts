/**
 * What the rank sheet shows once a drink is placed (Prod-rank-A "Where it
 * landed", Loop-rank "Why, up to two", Kept-score "And the room?"): where it
 * sits in your list with its neighbours, the line under the score, the step
 * counter while comparing, and the optional reasons.
 */

import { dayOf, rankScore, SENTIMENTS, type Sentiment } from './ranking';

const MONTH = new Intl.DateTimeFormat('en', { month: 'long' });
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

/** When you had it, as a row says it: "August", or "August 2025" before this year. */
export function monthHad(entry: { had_on: string | null; created_at: string }, now = new Date()): string {
  const day = dayOf(entry.had_on ?? entry.created_at);
  return (day.getFullYear() === now.getFullYear() ? MONTH : MONTH_YEAR).format(day);
}

/** A ranked row's line under the bar: "Crimson Peel · August", the drink's own name only when it isn't the list's. */
export function entryLine(entry: { had_on: string | null; created_at: string; item: { name: string } | null }, listName: string, now = new Date()): string {
  const other = entry.item?.name && entry.item.name !== listName ? entry.item.name : null;
  return [other, monthHad(entry, now)].filter(Boolean).join(' · ');
}

/** One row of a list as the result draws it: a drink you ranked, or the one just placed (`entry` null). */
export interface PlacedRow<E> {
  entry: E | null;
  /** 1 is your best. */
  position: number;
  score: number;
  sentiment: Sentiment;
}

/**
 * Your whole list with the new drink in it: `others` best first (loved, fine,
 * didn't like, each in rank order), the new one at `index` inside its band.
 * Scores are worked out again for every band, as private.rank_score does once
 * the row is saved, so the neighbours show their new scores straight away.
 */
export function placeInList<E extends { sentiment: Sentiment }>(others: readonly E[], sentiment: Sentiment, index: number): PlacedRow<E>[] {
  const out: PlacedRow<E>[] = [];
  for (const s of SENTIMENTS) {
    const band: (E | null)[] = others.filter((e) => e.sentiment === s);
    if (s === sentiment) band.splice(Math.min(Math.max(index, 0), band.length), 0, null);
    band.forEach((entry, i) => out.push({ entry, position: out.length + 1, score: rankScore(s, i, band.length), sentiment: s }));
  }
  return out;
}

/** The new drink and the rows either side of it: three when the list has them, the new one in the middle unless it's first or last. */
export function neighbours<E>(rows: readonly PlacedRow<E>[]): PlacedRow<E>[] {
  const at = rows.findIndex((r) => r.entry === null);
  if (at < 0) return [];
  const start = Math.max(0, Math.min(at - 1, rows.length - 3));
  return rows.slice(start, start + 3);
}

const ORDINAL_WORDS = ['', 'best', 'second-best', 'third-best', 'fourth-best', 'fifth-best', 'sixth-best', 'seventh-best', 'eighth-best', 'ninth-best', 'tenth-best'];

/** "1st", "2nd", "11th", "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** Under the score: "Your second-best Negroni, out of 7." Your first of a kind says so. */
export function landedLine(position: number, total: number, name: string): string {
  if (total <= 1) return `Your first ${name}.`;
  const best = ORDINAL_WORDS[position] ?? `${ordinal(position)} best`;
  return `Your ${best} ${name}, out of ${total}.`;
}

/** "2 of 3" over the pair: this question, and the most there can be. */
export function stepCount(answered: number, remaining: number): string {
  return `${answered + 1} of ${answered + remaining}`;
}

export interface Reason {
  key: string;
  label: string;
}

/** What stood out about the drink: up to two (reason-chips, 1 Nov). Keys match rank_entries_reasons_known. */
export const DRINK_REASONS: readonly Reason[] = [
  { key: 'too_sweet', label: 'Too sweet' },
  { key: 'too_strong', label: 'Too strong' },
  { key: 'watery', label: 'Watery' },
  { key: 'beautiful', label: 'Beautiful' },
  { key: 'order_again', label: 'Would order again' },
];

export const MAX_DRINK_REASONS = 2;

/** The room, optional, only at a bar (Kept-score). Keys match rank_entries_room_reasons_known. */
export const ROOM_REASONS: readonly Reason[] = [
  { key: 'great_room', label: 'Great room' },
  { key: 'easy_to_talk', label: 'Easy to talk' },
  { key: 'good_music', label: 'Good music' },
  { key: 'loud', label: 'Loud' },
  { key: 'cramped', label: 'Cramped' },
  { key: 'too_dark', label: 'Too dark' },
];

/** A tap on a reason: off if it was on, on if there's room under `max`, otherwise unchanged. */
export function toggleReason(picked: string[], key: string, max = Infinity): string[] {
  if (picked.includes(key)) return picked.filter((k) => k !== key);
  return picked.length < max ? [...picked, key] : picked; // the same list at the cap, so nothing is saved
}
