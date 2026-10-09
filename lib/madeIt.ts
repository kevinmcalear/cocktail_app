/**
 * Made it: a drink someone made at home, logged against the one they had at
 * the bar. Pure helpers (lib/madeIt.check.ts); the table is made_drinks and
 * the score a "made at home" ranking (rank_entries, venue NULL).
 */
import { rankKeyAt } from './ranking';

export type Compared = 'better' | 'same' | 'worse';

/** What the recipe called for, and what was used instead. */
export interface Swap {
  from: string;
  to: string;
}

/** The database's limits (private.valid_swaps). */
export const SWAP_LIMIT = 12;
export const SWAP_NAME_LIMIT = 80;

/**
 * Where the home version lands in the list, beside the one had at the bar:
 * just above it when it was better, just below when it was the same or not
 * as good. `band` is that sentiment's entries, best first, without any
 * earlier home version; `barIndex` is the bar's entry in it.
 */
export function placeBeside(band: readonly number[], barIndex: number, compared: Compared): { index: number; rankKey: number } {
  const index = compared === 'better' ? barIndex : barIndex + 1;
  return { index, rankKey: rankKeyAt(band, index) };
}

/** The swaps worth saving: both names filled in, trimmed to fit, one per ingredient. */
export function cleanSwaps(rows: readonly Swap[]): Swap[] {
  const seen = new Set<string>();
  const out: Swap[] = [];
  for (const r of rows) {
    const from = r.from.trim().slice(0, SWAP_NAME_LIMIT);
    const to = r.to.trim().slice(0, SWAP_NAME_LIMIT);
    if (!from || !to || seen.has(from.toLowerCase())) continue;
    seen.add(from.toLowerCase());
    out.push({ from, to });
  }
  return out.slice(0, SWAP_LIMIT);
}

/** "Amaro Montenegro for Cynar": what was used, for what the spec called for. */
export const swapLine = (s: Swap) => `${s.to} for ${s.from}`;

/** One drink made at home, however many times. */
export interface MadeTally {
  itemId: string;
  name: string;
  imageUrl: string | null;
  times: number;
  /** The latest time, as a day: 2026-10-09. */
  lastOn: string;
}

/** Each drink made at home once, latest made first. `made` comes latest first (useMadeDrinks). */
export function tallyMade(made: readonly { itemId: string; name: string; imageUrl: string | null; madeOn: string }[]): MadeTally[] {
  const byItem = new Map<string, MadeTally>();
  for (const m of made) {
    const t = byItem.get(m.itemId);
    if (t) {
      t.times += 1;
      if (m.madeOn > t.lastOn) t.lastOn = m.madeOn;
    } else {
      byItem.set(m.itemId, { itemId: m.itemId, name: m.name, imageUrl: m.imageUrl, times: 1, lastOn: m.madeOn });
    }
  }
  return [...byItem.values()].sort((a, b) => (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0));
}
