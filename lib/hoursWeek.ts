/**
 * The Hours sheet in venue setup (board w2-venue-setup, E35): a week as
 * blocks of days that share one range, so it can be set as Same every day,
 * Weekdays and weekend, or Each day. Hours still save as profiles.hours, one
 * range a day (lib/barHours); a day in no block is closed.
 */
import { clockLabel, WEEK_DAYS, type HoursRange, type WeekDay, type WeekHours } from './barHours';

export type HoursMode = 'same' | 'split' | 'each';
export interface HoursBlock { days: WeekDay[]; range: HoursRange }

export const DEFAULT_RANGE: HoursRange = ['17:00', '00:00'];
// ponytail: Mon to Fri and Sat to Sun, as drawn; the board asks Kevin whether bars want Sun to Thu and Fri to Sat.
const WEEKDAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const SHORT: Record<WeekDay, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

const inWeekOrder = (days: WeekDay[]) => WEEK_DAYS.filter((d) => days.includes(d));
const same = (a: HoursRange, b: HoursRange) => a[0] === b[0] && a[1] === b[1];

/** Each open day's first range, grouped: days that share a range share a block. */
export function blocksOf(hours: WeekHours | null | undefined): HoursBlock[] {
  const blocks: HoursBlock[] = [];
  for (const day of WEEK_DAYS) {
    const range = hours?.[day]?.[0];
    if (!range) continue;
    const block = blocks.find((b) => same(b.range, range));
    if (block) block.days.push(day);
    else blocks.push({ days: [day], range: [range[0], range[1]] });
  }
  return blocks;
}

/** The way of setting the week that fits these hours, for opening the sheet. */
export function modeFor(blocks: HoursBlock[]): HoursMode {
  return blocks.length <= 1 ? 'same' : blocks.length === 2 ? 'split' : 'each';
}

/** The range most of these days share, else the first one's. */
function commonRange(blocks: HoursBlock[], days: WeekDay[]): HoursRange | null {
  let best: HoursBlock | null = null;
  let most = 0;
  for (const b of blocks) {
    const n = b.days.filter((d) => days.includes(d)).length;
    if (n > most) [best, most] = [b, n];
  }
  return best?.range ?? null;
}

/**
 * The same days and times in another mode. Switching keeps what is set: Same
 * every day keeps every open day at the commonest range; Weekdays and weekend
 * keeps which days are open, with each half's commonest range; Each day keeps
 * every day exactly.
 */
export function switchMode(blocks: HoursBlock[], to: HoursMode): HoursBlock[] {
  const open = inWeekOrder(blocks.flatMap((b) => b.days));
  if (to === 'each') return open.map((day) => ({ days: [day], range: blocks.find((b) => b.days.includes(day))!.range }));
  const fallback = commonRange(blocks, open) ?? DEFAULT_RANGE;
  if (to === 'same') return [{ days: open, range: fallback }];
  const weekend = WEEK_DAYS.filter((d) => !WEEKDAYS.includes(d));
  // Already two blocks: keep them as they are.
  if (blocks.length === 2) return blocks.map((b) => ({ days: inWeekOrder(b.days), range: b.range }));
  return [
    { days: open.filter((d) => WEEKDAYS.includes(d)), range: commonRange(blocks, WEEKDAYS) ?? fallback },
    { days: open.filter((d) => weekend.includes(d)), range: commonRange(blocks, weekend) ?? fallback },
  ];
}

/** Tap a day in block `at`: off if it's there (closed), else moved there from wherever it was. */
export function tapDay(blocks: HoursBlock[], at: number, day: WeekDay): HoursBlock[] {
  const had = blocks[at]?.days.includes(day);
  return blocks.map((b, i) => ({
    ...b,
    days: i === at ? (had ? b.days.filter((d) => d !== day) : inWeekOrder([...b.days, day])) : b.days.filter((d) => d !== day),
  }));
}

/** Each day: a day on its own, open at `range` or closed (null). */
export function setDay(blocks: HoursBlock[], day: WeekDay, range: HoursRange | null): HoursBlock[] {
  const rest = blocks.map((b) => ({ ...b, days: b.days.filter((d) => d !== day) })).filter((b) => b.days.length);
  return range ? [...rest, { days: [day], range }] : rest;
}

/**
 * The hours to save. A day whose first range didn't change keeps a second one
 * (lunch and dinner, set in Venue settings), so the sheet never drops it.
 */
export function weekFrom(blocks: HoursBlock[], before: WeekHours | null | undefined): WeekHours {
  const out: WeekHours = {};
  for (const day of WEEK_DAYS) {
    const range = blocks.find((b) => b.days.includes(day))?.range;
    const was = before?.[day];
    out[day] = !range ? [] : was?.length === 2 && same(was[0], range) ? was : [range];
  }
  return out;
}

/** Closes at or before it opens: past midnight. */
export const closesNextDay = ([open, close]: HoursRange) => close <= open;

/** "Mon", "Fri and Sat", "Tue to Thu", or "Mon, Wed and Fri" for days that don't run on. */
export function daysLabel(days: WeekDay[]): string {
  const sorted = inWeekOrder(days);
  const idx = sorted.map((d) => WEEK_DAYS.indexOf(d));
  const run = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
  if (sorted.length >= 3 && run) return `${SHORT[sorted[0]]} to ${SHORT[sorted[sorted.length - 1]]}`;
  const names = sorted.map((d) => SHORT[d]);
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Closed on Mon.", "Closed on Mon and Tue.", or null when open every day. */
export function closedLine(blocks: HoursBlock[]): string | null {
  const open = blocks.flatMap((b) => b.days);
  const closed = WEEK_DAYS.filter((d) => !open.includes(d));
  return closed.length ? `Closed on ${daysLabel(closed)}.` : null;
}

export interface WeekGroup { days: string; text: string; closed: boolean }

/**
 * The week as Where and when lists it: runs of days with the same hours
 * ("Tue to Thu", "5pm to midnight"), open runs first, closed days last.
 */
export function weekGroups(hours: WeekHours): WeekGroup[] {
  const text = (day: WeekDay) => (hours[day] ?? []).map((r) => `${clockLabel(r[0])} to ${clockLabel(r[1])}`).join(', ');
  const runs: { days: WeekDay[]; text: string }[] = [];
  for (const day of WEEK_DAYS) {
    const t = text(day);
    const last = runs[runs.length - 1];
    if (last && last.text === t) last.days.push(day);
    else runs.push({ days: [day], text: t });
  }
  const groups = runs.map((r) => ({ days: daysLabel(r.days), text: r.text || 'Closed', closed: !r.text }));
  return [...groups.filter((g) => !g.closed), ...groups.filter((g) => g.closed)];
}
