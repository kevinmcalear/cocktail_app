/**
 * The rota, worked out in the bar's own time: which service night a shift
 * belongs to, the week's days, what a shift says, who closes, and copying a
 * week. Pure, so lib/rota.check.ts runs it without React. Days are strings,
 * 2026-10-31. A night runs to 6am (lib/serviceDay.ts), so a shift that starts
 * at 1am belongs to the night before.
 */

import { clockLabel, WEEK_DAYS, type WeekHours } from '@/lib/barHours';
import { TURNOVER_HOUR } from '@/lib/serviceDay';
import { onShiftLine } from '@/lib/tonight';

/** A row of public.shifts, as useShifts reads it. Plain JSON: it sits in the query cache. */
export interface RotaShift {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  opens: boolean;
  closes: boolean;
  note: string | null;
  created_by: string | null;
}

/** What a shift write sends: rows to add or change, ids to take off. Sending it twice changes nothing. */
export interface RotaChange {
  rows: Omit<RotaShift, 'created_by'>[];
  removed: string[];
}

const HOUR = 3_600_000;
const TURNOVER = `${String(TURNOVER_HOUR).padStart(2, '0')}:00`;

/** The wall clock in `timeZone` (the device's if missing or unknown), as if it were UTC. */
function wall(at: Date, timeZone?: string | null): number {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at);
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const t = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
      if (Number.isFinite(t)) return t;
    } catch {
      // ponytail: an unknown zone falls back to the device's clock, as lib/barHours does; most readers are in the bar's city.
    }
  }
  return Date.UTC(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes());
}

const dayOfUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
const utcOf = (day: string) => Date.parse(`${day}T00:00:00Z`);

export const addDays = (day: string, by: number) => dayOfUtc(utcOf(day) + by * 24 * HOUR);

/** The service night a moment belongs to, in the bar's time. */
export function nightOf(at: string | Date, timeZone?: string | null): string {
  return dayOfUtc(wall(new Date(at), timeZone) - TURNOVER_HOUR * HOUR);
}

/** The Monday of a day's week. The rota always runs Monday to Sunday, as the board draws it. */
export function mondayOf(day: string): string {
  return addDays(day, -((new Date(utcOf(day)).getUTCDay() + 6) % 7));
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** A day and a clock time in the bar's time zone, as a moment. */
export function atWall(day: string, time: string, timeZone?: string | null): string {
  const target = Date.parse(`${day}T${time}:00Z`);
  // The zone's offset on that day: once for a first guess, again in case the guess crossed a clock change.
  let at = target;
  for (let i = 0; i < 2; i++) at = target - (wall(new Date(at), timeZone) - at);
  return new Date(at).toISOString();
}

/** A week's window for useShifts: 6am Monday to 6am the next Monday. */
export function weekWindow(monday: string, timeZone?: string | null) {
  return { from: atWall(monday, TURNOVER, timeZone), to: atWall(addDays(monday, 7), TURNOVER, timeZone) };
}

/** A shift's clock time, 19:00, in the bar's time. */
export function clockOf(at: string, timeZone?: string | null): string {
  return new Date(wall(new Date(at), timeZone)).toISOString().slice(11, 16);
}

/**
 * The moments a shift picked on a night runs: a start before 6am is that
 * night's small hours, and an end at or before the start is the next morning.
 */
export function shiftMoments(night: string, start: string, end: string, timeZone?: string | null) {
  const startDay = start < TURNOVER ? addDays(night, 1) : night;
  const endDay = end <= start ? addDays(startDay, 1) : startDay;
  return { starts_at: atWall(startDay, start, timeZone), ends_at: atWall(endDay, end, timeZone) };
}

/** "4pm", and "Midnight", as the shift sheet says them. */
export function sheetClock(time: string): string {
  const label = clockLabel(time);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const shortClock = (time: string) => clockLabel(time).replace('midnight', '12am').replace('noon', '12pm');

/** "7pm to 2am". */
export function shiftTimes(s: Pick<RotaShift, 'starts_at' | 'ends_at'>, timeZone?: string | null): string {
  return `${shortClock(clockOf(s.starts_at, timeZone))} to ${shortClock(clockOf(s.ends_at, timeZone))}`;
}

const lengthOf = (s: Pick<RotaShift, 'starts_at' | 'ends_at'>) => (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / HOUR;

/** "7.5 h". */
export function hoursLabel(hours: number): string {
  return `${Math.round(hours * 2) / 2} h`;
}

export const shiftLength = (s: Pick<RotaShift, 'starts_at' | 'ends_at'>) => hoursLabel(lengthOf(s));
export const totalHours = (shifts: readonly Pick<RotaShift, 'starts_at' | 'ends_at'>[]) => hoursLabel(shifts.reduce((n, s) => n + lengthOf(s), 0));

// Words for a day. The order is the board's whatever the locale; the names are the locale's.
const onDay = (day: string, options: Intl.DateTimeFormatOptions, locale?: string) => new Date(utcOf(day)).toLocaleDateString(locale, { timeZone: 'UTC', ...options });
const dayNumber = (day: string) => Number(day.slice(8));

/** "Mon", on the week strip and the grid's head. */
export const weekdayShort = (day: string, locale?: string) => onDay(day, { weekday: 'short' }, locale);
/** "Saturday". */
export const weekdayLong = (day: string, locale?: string) => onDay(day, { weekday: 'long' }, locale);
export const dateNumber = dayNumber;
/** "Friday 31". */
export const dayHeading = (day: string, locale?: string) => `${weekdayLong(day, locale)} ${dayNumber(day)}`;
/** "Sat 1 Nov". */
export const dayShort = (day: string, locale?: string) => `${weekdayShort(day, locale)} ${dayNumber(day)} ${onDay(day, { month: 'short' }, locale)}`;
/** "Fri 31". */
const dayTiny = (day: string, locale?: string) => `${weekdayShort(day, locale)} ${dayNumber(day)}`;
/** "27 Oct to 2 Nov". */
export function weekLine(monday: string, locale?: string): string {
  const end = addDays(monday, 6);
  const on = (day: string) => `${dayNumber(day)} ${onDay(day, { month: 'short' }, locale)}`;
  return `${on(monday)} to ${on(end)}`;
}

export interface RotaDay {
  day: string;
  shifts: RotaShift[];
}

/** The week's seven nights, each with its shifts in start order. A shift from the night before the week isn't in it. */
export function daysOfWeek(shifts: readonly RotaShift[], monday: string, timeZone?: string | null): RotaDay[] {
  return weekDays(monday).map((day) => ({ day, shifts: shifts.filter((s) => nightOf(s.starts_at, timeZone) === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }));
}

/** Nights from today on with people on and nobody closing. */
export function noClose(days: readonly RotaDay[], today: string): RotaDay[] {
  return days.filter((d) => d.day >= today && d.shifts.length > 0 && !d.shifts.some((s) => s.closes));
}

/** True when the bar's own hours say it's shut that night. Unknown hours say nothing. */
export function closedOn(hours: WeekHours | null | undefined, day: string): boolean {
  if (!hours) return false;
  return !hours[WEEK_DAYS[(new Date(utcOf(day)).getUTCDay() + 6) % 7]]?.length;
}

/** What a grid column says under its date: Closed, Tonight, or No close. */
export function columnNote(day: string, today: string, closed: boolean, missingClose: boolean): { text: string; warn: boolean } | null {
  if (closed) return { text: 'Closed', warn: false };
  if (day === today) return { text: 'Tonight', warn: false };
  return missingClose ? { text: 'No close', warn: true } : null;
}

/**
 * This week's shifts moved `days` on, ready to save: the same clock times in
 * the bar's zone, so a clock change doesn't move them. Leaves out anyone no
 * longer on the team (the table refuses them, and would refuse the whole
 * write) and a shift the target week already has.
 */
export function copyShifts({ from, days, memberIds, existing, newId, timeZone }: {
  from: readonly RotaShift[];
  days: number;
  memberIds: readonly string[];
  existing: readonly RotaShift[];
  newId: () => string;
  timeZone?: string | null;
}): { rows: RotaChange['rows']; gone: number } {
  const taken = new Set(existing.map((s) => `${s.user_id} ${s.starts_at}`));
  const moved = (at: string) => atWall(addDays(new Date(wall(new Date(at), timeZone)).toISOString().slice(0, 10), days), clockOf(at, timeZone), timeZone);
  const onTeam = from.filter((s) => memberIds.includes(s.user_id));
  const rows = onTeam
    .map((s) => ({ id: newId(), user_id: s.user_id, starts_at: moved(s.starts_at), ends_at: moved(s.ends_at), opens: s.opens, closes: s.closes, note: s.note }))
    .filter((s) => !taken.has(`${s.user_id} ${s.starts_at}`));
  return { rows, gone: from.length - onTeam.length };
}

/** A write's effect on one cached window, so it shows at once: its rows in or out of the window, in start order. */
export function patchShifts(list: readonly RotaShift[], change: RotaChange, from: string, to: string, me: string | null): RotaShift[] {
  const changed = new Map(change.rows.map((r) => [r.id, r]));
  const inWindow = (s: Pick<RotaShift, 'starts_at' | 'ends_at'>) => s.starts_at < to && s.ends_at > from;
  const kept = list.filter((s) => !changed.has(s.id) && !change.removed.includes(s.id));
  const put = change.rows.filter(inWindow).map((r) => ({ ...r, created_by: list.find((s) => s.id === r.id)?.created_by ?? me }));
  return [...kept, ...put].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

const first = (name: string) => name.split(' ')[0];

/** "With Ana and Maya", or "On your own". */
function withLine(others: readonly string[]): string {
  if (!others.length) return 'On your own';
  return `With ${others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`}`;
}

export interface NextShift {
  shift: RotaShift;
  title: string;
  sub: string;
}

/**
 * A bartender's next shifts: "Tonight, Fri 31" with who opens and closes when
 * they do either, and otherwise who they're on with.
 */
export function nextShifts({ shifts, me, today, nameOf, timeZone, limit = 3 }: {
  shifts: readonly RotaShift[];
  me: string | null;
  today: string;
  nameOf: (userId: string) => string;
  timeZone?: string | null;
  limit?: number;
}): NextShift[] {
  const nights = new Map<string, RotaShift[]>();
  for (const s of shifts) {
    const night = nightOf(s.starts_at, timeZone);
    if (night >= today) nights.set(night, [...(nights.get(night) ?? []), s]);
  }
  return shifts
    .filter((s) => s.user_id === me && nightOf(s.starts_at, timeZone) >= today)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, limit)
    .map((shift) => {
      const night = nightOf(shift.starts_at, timeZone);
      const on = nights.get(night) ?? [];
      const others = [...new Set(on.map((s) => s.user_id).filter((id) => id !== me))].map((id) => first(nameOf(id)));
      const line = shift.opens || shift.closes ? onShiftLine(on, nameOf, me)?.sub : null;
      return { shift, title: night === today ? `Tonight, ${dayTiny(night)}` : dayShort(night), sub: line ?? withLine(others) };
    });
}

/** Who to ask about the rota: whoever put up most of its shifts. */
export function rotaMaker(shifts: readonly RotaShift[]): string | null {
  const counts = new Map<string, number>();
  for (const s of shifts) if (s.created_by) counts.set(s.created_by, (counts.get(s.created_by) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * The grid's rows: people on this week in the order they first work (their
 * first shift, then their name), then, for someone who writes the rota, the
 * rest of the team, so anyone can be given a shift from the grid.
 */
export function gridPeople<M extends { user_id: string; name: string }>(members: readonly M[], shifts: readonly RotaShift[], everyone: boolean): M[] {
  const firstAt = new Map<string, string>();
  for (const s of shifts) if (!firstAt.has(s.user_id) || s.starts_at < firstAt.get(s.user_id)!) firstAt.set(s.user_id, s.starts_at);
  const byName = (a: M, b: M) => a.name.localeCompare(b.name);
  const on = members.filter((m) => firstAt.has(m.user_id)).sort((a, b) => firstAt.get(a.user_id)!.localeCompare(firstAt.get(b.user_id)!) || byName(a, b));
  return everyone ? [...on, ...members.filter((m) => !firstAt.has(m.user_id)).sort(byName)] : on;
}
