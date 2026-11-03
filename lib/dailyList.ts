// The daily list (decision daily-list: one list changed each morning;
// Menu-l-tonight-*): which drinks are on tonight and which were on lately,
// each with its days on this list, read from its runs (the rows on it now and
// menu_drinks_removed). Days are the bar's calendar days in its time zone, as
// list_on_day and menu_days date them.
// ponytail: a night that runs past midnight changes day at midnight, as the
// database does; a list written at 1am belongs to the new day.

const DAY_MS = 86_400_000;

/** The bar's date at `at` ("2026-11-01"), in its time zone (the device's when missing or unknown). */
export function barDay(at: Date | number, timeZone?: string | null): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  if (timeZone) {
    try {
      // en-CA prints dates as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch {
      // An unknown zone falls through to the device's own day.
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The day `n` days after `day` (negative: before). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/** "Sun 1 Nov" (weekday) or "1 Nov", in the reader's locale; the date is the bar's, so it's printed in UTC. */
export function dayText(day: string, { weekday = true, locale }: { weekday?: boolean; locale?: string } = {}): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(weekday ? { weekday: 'short' } : {}) });
}

/** A drink's time on the list: from when it went on to when it came off (null: still on). */
export interface DailyRun {
  itemId: string;
  wentOn: string;
  cameOff: string | null;
}

/** The bar days a run covers. A run that came off as a day began doesn't count that day; one that never lasted covers none. */
function runDays(run: DailyRun, now: number, timeZone?: string | null): string[] {
  const start = Date.parse(run.wentOn);
  const end = run.cameOff ? Date.parse(run.cameOff) : now;
  if (!(end > start)) return [];
  const first = barDay(start, timeZone);
  const last = barDay(end - 1, timeZone);
  const out: string[] = [];
  for (let d = first; d <= last && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface DailyLine {
  itemId: string;
  /** "New today", "On every day since 1 Apr", "On 41 days, since 21 Sep"; "Last on Fri 30 Oct", "Taken off today". */
  line: string;
  /** On tonight for the first time on this list (guests read "New"). */
  isNew: boolean;
}

export interface DailyLines {
  /** In the order given (the list's own order). */
  on: DailyLine[];
  /** Drinks on lately and not tonight, the latest first. */
  off: DailyLine[];
}

/**
 * Each drink on tonight with its days on this list, and the drinks that were
 * on in the last `lately` days but aren't tonight, with the last day they
 * were. A drink taken off today before service wasn't on tonight: its last
 * day is the one before.
 */
export function dailyLines(
  onIds: readonly string[],
  runs: readonly DailyRun[],
  { now, timeZone, lately = 14, locale }: { now: number; timeZone?: string | null; lately?: number; locale?: string },
): DailyLines {
  const today = barDay(now, timeZone);
  const days = new Map<string, Set<string>>();
  for (const r of runs) {
    const set = days.get(r.itemId) ?? new Set<string>();
    for (const d of runDays(r, now, timeZone)) set.add(d);
    days.set(r.itemId, set);
  }
  const on = new Set(onIds);
  const onLines = onIds.map((itemId): DailyLine => {
    const covered = [...(days.get(itemId) ?? [])].filter((d) => d <= today).sort();
    const first = covered[0] ?? today;
    if (first === today) return { itemId, line: 'New today', isNew: true };
    // Tonight counts, whether or not the run reached it yet.
    const count = new Set([...covered, today]).size;
    const since = dayText(first, { weekday: false, locale });
    return { itemId, line: count === daysBetween(first, today) + 1 ? `On every day since ${since}` : `On ${count} days, since ${since}`, isNew: false };
  });
  const cutoff = addDays(today, -lately);
  const offLines = [...days]
    .filter(([itemId]) => !on.has(itemId))
    .map(([itemId, set]) => {
      const before = [...set].filter((d) => d < today).sort();
      return { itemId, last: before.at(-1) ?? null, today: set.has(today) };
    })
    .filter((x) => (x.last ? x.last >= cutoff : x.today))
    .sort((a, b) => (b.last ?? today).localeCompare(a.last ?? today))
    .map((x): DailyLine => ({ itemId: x.itemId, line: x.last ? `Last on ${dayText(x.last, { locale })}` : 'Taken off today', isNew: false }));
  return { on: onLines, off: offLines };
}

/** Under a guest's daily list (Menu-l-tonight). */
export const DAILY_AFTER = 'A new list every day. Open a drink to see the days it has been on.';

/** "Today’s list, written at 4:10pm"; before anyone writes today's, the list carries yesterday's. */
export function dailyLead(writtenAt: string | null, time: (iso: string) => string): string {
  return writtenAt ? `Today’s list, written at ${time(writtenAt)}` : 'Yesterday’s list, until someone changes it';
}

/** "4:10pm", in the bar's time zone. */
export function clockAt(iso: string, timeZone?: string | null, locale?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  let text: string;
  try {
    text = new Date(iso).toLocaleTimeString(locale, timeZone ? { ...opts, timeZone } : opts);
  } catch {
    text = new Date(iso).toLocaleTimeString(locale, opts);
  }
  // "4:10 PM" to "4:10pm", as the app writes times.
  return text.replace(/\s?([AP])\.?M\.?$/i, (_, m: string) => `${m.toLowerCase()}m`);
}
