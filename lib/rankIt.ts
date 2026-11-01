/**
 * "Had a drink? Rank it" on home Tonight (Loop-rank board): which drink to
 * suggest, which ranking counts as tonight's, and the words on its rows.
 * Queries are in hooks/useRankIt.ts; checked by lib/rankIt.check.ts.
 */
import type { HadDrink } from './hadDrinks';
import { formatScore } from './ranking';

/** A drink on your Want list. */
export interface WantedDrink {
  itemId: string;
  name: string;
  /** The bar the drink is from, as the want remembers it. */
  barName: string | null;
}

/** One menu a drink is on (drink_list_dates). */
export interface DrinkRun {
  item_id: string;
  profile_id: string;
  edition_name: string;
  is_current: boolean;
}

/** The suggested row: a drink you want, on a list on now at a bar (a bar you love first). */
export interface RankSuggestion {
  itemId: string;
  name: string;
  barId: string;
  barName: string;
  menuName: string;
}

/**
 * The drink to suggest: the newest want that's on a list on now at a bar you
 * love, else the newest that's on a list on now anywhere. Null when none is.
 * `wants` newest first; `barNames` by profile id.
 */
export function pickSuggestion(wants: readonly WantedDrink[], runs: readonly DrinkRun[], loved: ReadonlySet<string>, barNames: ReadonlyMap<string, string>): RankSuggestion | null {
  const onNow = runs.filter((r) => r.is_current);
  const find = (atLoved: boolean) => {
    for (const w of wants) {
      const run = onNow.find((r) => r.item_id === w.itemId && (!atLoved || loved.has(r.profile_id)));
      if (run) return { itemId: w.itemId, name: w.name, barId: run.profile_id, barName: barNames.get(run.profile_id) ?? w.barName ?? 'A bar', menuName: run.edition_name };
    }
    return null;
  };
  return find(true) ?? find(false);
}

/** A ranking of yours: hadOn is the day you said you had it, set on every rank. */
type RankedEntry = Pick<HadDrink, 'itemId' | 'hadOn' | 'createdAt'>;

/** How long a ranking stays tonight's when it was made before midnight. */
const TONIGHT_HOURS = 12;

/**
 * Tonight's ranking: the newest one had today (a re-rank keeps its first
 * created_at but takes today's had_on) or made in the last TONIGHT_HOURS,
 * so one ranked at 11pm still shows at 1am. `today` is the local day
 * (lib/ranking localDate). Null when there's none.
 */
export function tonightEntry<T extends RankedEntry>(entries: readonly T[], now: Date, today: string): T | null {
  const since = now.getTime() - TONIGHT_HOURS * 3_600_000;
  const tonight = entries.filter((e) => e.hadOn === today || Date.parse(e.createdAt) >= since);
  return [...tonight].sort((a, b) => Number(b.hadOn === today) - Number(a.hadOn === today) || b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** "Caretaker's · tonight", or "At home · tonight". */
export function tonightLine(e: { venue: { name: string } | null }): string {
  return `${e.venue?.name ?? 'At home'} · tonight`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Your 8.4 in August" on a bar's list, for a drink you ranked before; the
 * year too when it wasn't this year ("Your 8.4 in August 2025").
 */
export function beforeLine(score: number, day: string | null, now: Date): string {
  const formatted = `Your ${formatScore(score)}`;
  const m = day ? /^(\d{4})-(\d{2})/.exec(day) : null;
  if (!m) return formatted;
  const year = Number(m[1]);
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return formatted;
  return year === now.getFullYear() ? `${formatted} in ${month}` : `${formatted} in ${month} ${year}`;
}

/**
 * Your latest score for each drink, by id: the newest ranking of it wins.
 * For "Your 8.4 in August" on a bar's list.
 */
export function latestByDrink<T extends RankedEntry>(entries: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const e of entries) {
    const had = out.get(e.itemId);
    const when = (x: T) => x.hadOn ?? x.createdAt;
    if (!had || when(e) > when(had)) out.set(e.itemId, e);
  }
  return out;
}

/**
 * Anywhere's rows: the classics that match, the best match first as the way
 * to rank it at home or at a bar the app doesn't list, then the rest as
 * classics. `max` rows at most.
 */
export function anywhereRows<T extends { id: string; name: string }>(classics: readonly T[], max = 4): (T & { sub: string })[] {
  return classics.slice(0, max).map((c, i) => ({ ...c, sub: i === 0 ? 'At home, or a bar not listed' : 'A classic' }));
}

/** The menu on now for each drink at its own bar: "on Autumn". Keyed `${itemId}:${profileId}`. */
export function menusOnNow(runs: readonly DrinkRun[]): Map<string, string> {
  return new Map(runs.filter((r) => r.is_current).map((r) => [`${r.item_id}:${r.profile_id}`, r.edition_name]));
}
