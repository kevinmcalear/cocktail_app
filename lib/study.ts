/**
 * Study: which cards come first, streaks, and the glass question. Pure; the
 * progress lives in store/useStudyProgress and the cards in hooks/useStudyDecks.
 */

export type Rating = 'again' | 'close' | 'nailed';

export interface CardProgress {
  rating: Rating;
  /** ISO time of the last rating. */
  seenAt: string;
}

const WEIGHT: Record<Rating, number> = { again: 0, close: 1, nailed: 2 };

/**
 * Weakest first: never-seen cards, then "again", then "close", then
 * "nailed". Within a group, the one seen longest ago comes first.
 */
export function orderDeck(ids: string[], progress: Record<string, CardProgress | undefined>): string[] {
  const rank = (id: string) => {
    const p = progress[id];
    return p ? WEIGHT[p.rating] : -1;
  };
  const seen = (id: string) => progress[id]?.seenAt ?? '';
  return [...ids].sort((a, b) => rank(a) - rank(b) || seen(a).localeCompare(seen(b)) || a.localeCompare(b));
}

/** How many cards in a deck are "nailed". */
export function knownCount(ids: string[], progress: Record<string, CardProgress | undefined>): number {
  return ids.filter((id) => progress[id]?.rating === 'nailed').length;
}

/** Local calendar day, as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Consecutive days studied, ending today or yesterday (so the streak survives
 * until the end of today). `days` are dayKey strings, any order, duplicates ok.
 */
export function streak(days: string[], today: Date): number {
  const set = new Set(days);
  const cursor = new Date(today);
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (set.has(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export interface GlassOption {
  id: string;
  name: string;
  icon: string;
}

/**
 * The right glass plus up to two others, in a stable shuffled order (seeded by
 * the drink id, so options don't jump around on re-render).
 */
export function glassOptions(correct: GlassOption, all: GlassOption[], seed: string): GlassOption[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h / 2 ** 32;
  };
  const others = all.filter((g) => g.id !== correct.id && g.name !== correct.name);
  const picked: GlassOption[] = [];
  const pool = [...others];
  while (picked.length < 2 && pool.length) picked.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  const options = [correct, ...picked];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
