/**
 * Collection: the drinks a home bartender saved (the bookmark on a drink, or
 * Collect on a bar's), split into the ones they can still open (published,
 * or a drink they can read, like a classic) and past drinks, memories of
 * drinks a bar has since made private or deleted.
 */

export interface Memory {
  id: string;
  collectedAt: string;
  barName: string | null;
  liveMode: string | null;
  /** Not published, but theirs to open anyway: a classic, or their own bar's drink. */
  readable?: boolean;
}

export interface BarMemories<T> {
  bar: string;
  drinks: T[];
}

/** A memory whose bar isn't known any more. */
export const UNKNOWN_BAR = 'Other bars';

/**
 * Drinks that still open as they come (newest first), and past drinks grouped
 * by bar, the bar you collected from most recently first.
 */
export function splitCollection<T extends Memory>(drinks: T[]): { live: T[]; past: BarMemories<T>[] } {
  const opens = (d: T) => d.liveMode !== null || !!d.readable;
  const live = drinks.filter(opens);
  const groups = new Map<string, T[]>();
  const newest = (list: T[]) => Math.max(...list.map((d) => Date.parse(d.collectedAt)));
  for (const d of drinks) {
    if (opens(d)) continue;
    const bar = d.barName?.trim() || UNKNOWN_BAR;
    groups.set(bar, [...(groups.get(bar) ?? []), d]);
  }
  const past = [...groups.entries()]
    .map(([bar, list]) => ({ bar, drinks: list }))
    .sort((a, b) => (a.bar === UNKNOWN_BAR ? 1 : b.bar === UNKNOWN_BAR ? -1 : newest(b.drinks) - newest(a.drinks)));
  return { live, past };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local calendar day as the database stores a date: 2026-09-27. */
export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A typed date (2026-09-27), or null when it isn't a real day. */
export function parseDay(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return toDay(d);
}

/** "Sat 27 Sep", with the year when it isn't this year. Dates are days, not instants: no time zone shift. */
export function dayLabel(day: string, now: number, locale?: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "You had it on Sat 27 Sep", or null when they haven't said. */
export function hadOnLine(hadOn: string | null, now: number, locale?: string): string | null {
  return hadOn ? `You had it on ${dayLabel(hadOn, now, locale)}` : null;
}
