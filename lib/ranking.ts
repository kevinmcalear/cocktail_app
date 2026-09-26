/**
 * Ranking by comparison, like Beli (docs/schema_proposal.md, "Rankings").
 *
 * A person's list for a drink ("my martinis") is split into three bands by
 * their first answer: loved, fine, didn't like. A new entry is placed inside
 * its band by binary insertion, one "which was better?" at a time, and stored
 * with a `rank_key` between its neighbours so no other row moves. Lower keys
 * are better. The score comes from the position in the band.
 */

export type Sentiment = 'loved' | 'fine' | 'disliked';

export const SENTIMENTS: readonly Sentiment[] = ['loved', 'fine', 'disliked'];

/** "Which was better?": the new drink, the one it's compared with, or too close to call. */
export type Answer = 'new' | 'old' | 'tie';

export type Placement =
  | { done: false; /** Index in the band to compare against next. */ against: number; /** Most answers still needed. */ remaining: number }
  | { done: true; /** Where the new entry goes in the band, 0 = best. */ index: number };

/** How many answers a range of `size` insertion points can still need. */
function answersFor(size: number): number {
  return size <= 1 ? 0 : Math.ceil(Math.log2(size));
}

/**
 * Binary insertion into a band of `count` entries (best first), given the
 * answers so far. "Too close to call" places the new entry straight after the
 * one it was compared with and ends the questions.
 */
export function nextPlacement(count: number, answers: readonly Answer[]): Placement {
  let lo = 0;
  let hi = count;
  for (const answer of answers) {
    if (lo >= hi) break;
    const mid = Math.floor((lo + hi) / 2);
    if (answer === 'tie') return { done: true, index: mid + 1 };
    if (answer === 'new') hi = mid;
    else lo = mid + 1;
  }
  if (lo >= hi) return { done: true, index: lo };
  return { done: false, against: Math.floor((lo + hi) / 2), remaining: answersFor(hi - lo + 1) };
}

/** The band index each answer was about, in order: who the new drink was compared with. */
export function comparedWith(count: number, answers: readonly Answer[]): number[] {
  const against: number[] = [];
  for (let i = 0; i < answers.length; i++) {
    const p = nextPlacement(count, answers.slice(0, i));
    if (p.done) break;
    against.push(p.against);
  }
  return against;
}

/**
 * The `rank_key` for a new entry at `index` in a band whose keys are `keys`
 * (sorted ascending, best first): the midpoint of its neighbours, or one past
 * the end.
 *
 * ponytail: doubles allow about 50 halvings of the same gap. Past that the
 * midpoint rounds onto a neighbour, so the entry shares the better
 * neighbour's key and sorts after it by created_at, as the view does.
 * Upgrade path: renumber the band when that happens.
 */
export function rankKeyAt(keys: readonly number[], index: number): number {
  const before = index > 0 ? keys[index - 1] : undefined;
  const after = index < keys.length ? keys[index] : undefined;
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  const mid = (before + after) / 2;
  return mid === after ? before : mid;
}

// Band edges in tenths: loved 10 to 6.7, fine 6.6 to 3.4, didn't like 3.3 to 0.
const BANDS: Record<Sentiment, { hi: number; lo: number }> = {
  loved: { hi: 100, lo: 67 },
  fine: { hi: 66, lo: 34 },
  disliked: { hi: 33, lo: 0 },
};

/**
 * The personal 0 to 10 score for the entry at 0-based `index` of `count` in
 * its band. Must match `private.rank_score` in
 * supabase/migrations/20260926000600_home_bar_and_rankings.sql:
 * round(hi - (hi - lo) * index / count, 1), rounding halves up. Worked in
 * integer tenths so 8.35 rounds to 8.4 as it does in Postgres.
 */
export function rankScore(sentiment: Sentiment, index: number, count: number): number {
  const { hi, lo } = BANDS[sentiment];
  const n = Math.max(count, 1);
  const numerator = hi * n - (hi - lo) * index; // tenths × n
  return Math.floor((2 * numerator + n) / (2 * n)) / 10;
}

/** A score as people read it: one decimal, always. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * The list a drink is ranked in. A bar's version of a classic (origin
 * "Classic" with `riff_of_id` set) is compared with every other martini;
 * originals and riffs are their own list.
 */
export function rankedAs(item: {
  id: string;
  name: string;
  origin?: string | null;
  riff_of_id?: string | null;
  riff_of?: { id: string; name: string } | null;
}): { id: string; name: string } {
  if (item.origin === 'Classic' && item.riff_of_id) return { id: item.riff_of_id, name: item.riff_of?.name ?? item.name };
  return { id: item.id, name: item.name };
}

/** "Martinis" for a list heading. Names already ending in s stay as they are ("Bee's Knees"). */
export function plural(name: string): string {
  return /s$/i.test(name.trim()) ? name.trim() : `${name.trim()}s`;
}

/** A date column ("2026-06-12") as local midnight, not UTC; timestamps as they are. */
export function dayOf(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** Today in the person's own timezone, as a date column wants it. */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
