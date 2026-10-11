/**
 * A bar's opening hours (profiles.hours, typed by the venue) and what they
 * mean right now: "Open now · until 1am", "Closed · opens 5pm Thu".
 *
 * Shape: { mon: [["17:00", "01:00"]], fri: [["12:00", "15:00"], ["17:00", "02:00"]] }.
 * Monday first, at most two ranges a day; a close at or before the open is
 * past midnight; a missing or empty day is closed. Times are worked out in
 * the bar's own time zone, so a reader in another city still sees the bar's
 * clock. See supabase/migrations/20261013100000_bar_facts.sql.
 */

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export type HoursRange = [open: string, close: string];
export type WeekHours = Partial<Record<WeekDay, HoursRange[]>>;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY = 1440;
const WEEK = 7 * DAY;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(t: string): number | null {
  const m = TIME.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "5pm", "5:30pm", "midnight", "noon". */
export function clockLabel(t: string): string {
  const m = minutes(t);
  if (m == null) return t;
  if (m === 0) return 'midnight';
  if (m === 720) return 'noon';
  const h = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min ? `:${String(min).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** The bar's weekday (0 = Monday) and minutes past midnight at `now`, in `timeZone` (the device's if missing or unknown). */
export function barClock(now: Date, timeZone?: string | null): { day: number; minute: number } {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      const day = SHORT_NAMES.indexOf(get('weekday'));
      const hour = Number(get('hour')) % 24;
      const minute = Number(get('minute'));
      if (day >= 0 && Number.isFinite(hour) && Number.isFinite(minute)) return { day, minute: hour * 60 + minute };
    } catch {
      // ponytail: an unknown zone falls back to the device's clock; most readers are in the bar's city.
    }
  }
  return { day: (now.getDay() + 6) % 7, minute: now.getHours() * 60 + now.getMinutes() };
}

interface Span { start: number; end: number; open: string; close: string }

/** Every open range as minutes from Monday 00:00; ends past Sunday midnight run over WEEK. */
function spans(hours: WeekHours): Span[] {
  const out: Span[] = [];
  WEEK_DAYS.forEach((key, day) => {
    for (const range of hours[key] ?? []) {
      const open = minutes(range[0]);
      const close = minutes(range[1]);
      if (open == null || close == null || open === close) continue;
      const start = day * DAY + open;
      out.push({ start, end: day * DAY + close + (close < open ? DAY : 0), open: range[0], close: range[1] });
    }
  });
  return out.sort((a, b) => a.start - b.start);
}

export interface HoursStatus {
  open: boolean;
  /** "Open now" or "Closed". */
  state: string;
  /** "until 1am", "opens 5pm", "opens 5pm Thu"; null when it never opens. */
  detail: string | null;
}

/** Whether the bar is open at `now`, and until or from when. Null when the hours aren't known. */
export function hoursStatus(hours: WeekHours | null | undefined, now: Date, timeZone?: string | null): HoursStatus | null {
  if (!hours) return null;
  const all = spans(hours);
  const { day, minute } = barClock(now, timeZone);
  const t = day * DAY + minute;
  // A Sunday range past midnight covers the start of Monday, so look a week back too.
  const current = all.find((s) => (t >= s.start && t < s.end) || (t + WEEK >= s.start && t + WEEK < s.end));
  if (current) {
    // A range that runs straight into the next one (to midnight, then from midnight) reads as one.
    let end = current.end % WEEK;
    let close = current.close;
    for (let guard = 0; guard < 14; guard++) {
      const next = all.find((s) => s.start === end);
      if (!next || next === current) break;
      end = next.end % WEEK;
      close = next.close;
    }
    return { open: true, state: 'Open now', detail: `until ${clockLabel(close)}` };
  }
  if (all.length === 0) return { open: false, state: 'Closed', detail: null };
  const next = all.find((s) => s.start > t) ?? all[0];
  const nextDay = Math.floor(next.start / DAY);
  const when = nextDay === day && next.start > t ? '' : ` ${SHORT_NAMES[nextDay]}`;
  return { open: false, state: 'Closed', detail: `opens ${clockLabel(next.open)}${when}` };
}

/** "Open now · until 1am" in one line. */
export function hoursLine(hours: WeekHours | null | undefined, now: Date, timeZone?: string | null): string | null {
  const s = hoursStatus(hours, now, timeZone);
  return s ? [s.state, s.detail].filter(Boolean).join(' · ') : null;
}

export interface HoursRow { day: string; text: string; closed: boolean; today: boolean }

/** The week for the Hours sheet: "Friday", "4pm to 1am" (or "Closed"), today marked. */
export function weekRows(hours: WeekHours, now: Date, timeZone?: string | null): HoursRow[] {
  const today = barClock(now, timeZone).day;
  return WEEK_DAYS.map((key, i) => {
    const ranges = (hours[key] ?? []).filter((r) => minutes(r[0]) != null && minutes(r[1]) != null);
    return {
      day: DAY_NAMES[i],
      text: ranges.length ? ranges.map((r) => `${clockLabel(r[0])} to ${clockLabel(r[1])}`).join(', ') : 'Closed',
      closed: ranges.length === 0,
      today: i === today,
    };
  });
}

/** Typed hours as they come from the database: anything off-shape is dropped, not trusted. */
export function parseHours(value: unknown): WeekHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: WeekHours = {};
  for (const key of WEEK_DAYS) {
    const ranges = (value as Record<string, unknown>)[key];
    if (!Array.isArray(ranges)) continue;
    out[key] = ranges
      .filter((r): r is HoursRange => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'string' && TIME.test(r[0]) && TIME.test(r[1]) && r[0] !== r[1])
      .slice(0, 2);
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Where the hours come from, under them: "From the bar · updated 3 Oct" when
 * the bar keeps its own page, else "Hours checked 3 Oct · may have changed".
 */
export function hoursSource(isClaimed: boolean, updatedAt: string | null | undefined, now: Date = new Date()): string {
  const d = updatedAt ? new Date(updatedAt) : null;
  const when = d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}` : null;
  if (isClaimed) return when ? `From the bar · updated ${when}` : 'From the bar';
  return when ? `Hours checked ${when} · may have changed` : 'These hours may have changed';
}
