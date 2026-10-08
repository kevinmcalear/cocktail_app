/**
 * Month grids for the date picker (components/ds/DateField). Days are local
 * calendar days as the database stores a date (2026-10-04), never instants,
 * so there is no time zone shift.
 */
import { toDay } from './collection';

export interface Month {
  year: number;
  /** 0 is January. */
  month: number;
}

/** The month a day falls in. */
export function monthOf(day: string): Month {
  const [y, m] = day.split('-').map(Number);
  return { year: y, month: m - 1 };
}

/** The month `by` months on (or back, when negative). */
export function shiftMonth({ year, month }: Month, by: number): Month {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * The weeks of a month, each seven days long, starting on `firstDay`
 * (0 Sunday, 1 Monday). Days outside the month are null.
 */
export function monthWeeks({ year, month }: Month, firstDay: number): (string | null)[][] {
  const lead = (new Date(year, month, 1).getDay() - firstDay + 7) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= length; d++) cells.push(toDay(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

// Regions whose calendars start on Sunday. ponytail: a short list, used only
// where the platform has no Intl week info (Hermes); the rest start on Monday.
const SUNDAY_REGIONS = new Set(['US', 'CA', 'MX', 'BR', 'JP', 'KR', 'TW', 'HK', 'IL', 'PH', 'IN', 'ZA', 'AU', 'SA']);

/** The weekday a calendar starts on in this locale: 0 Sunday, 1 Monday. */
export function weekStart(locale?: string): number {
  try {
    const tag = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale;
    // Hermes has no Intl.Locale; browsers and Node have week info on it.
    type WithWeek = Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const loc = typeof Intl.Locale === 'function' ? (new Intl.Locale(tag) as WithWeek) : null;
    const info = loc?.getWeekInfo?.() ?? loc?.weekInfo;
    if (info) return info.firstDay % 7;
    const region = /[-_]([A-Z]{2})\b/.exec(tag)?.[1] ?? (tag.startsWith('en') ? 'US' : '');
    return SUNDAY_REGIONS.has(region) ? 0 : 1;
  } catch {
    return 1;
  }
}

/** True when `day` is outside min..max (either end optional). */
export function outside(day: string, min?: string, max?: string): boolean {
  return Boolean((min && day < min) || (max && day > max));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A time as stored and sent: 19:05. */
export const toTime = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

/** "19:00" as hours and minutes, or null when it isn't a real time. */
export function parseTime(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** True where clocks read 1 PM rather than 13:00. Formats a time rather than asking Intl, which Hermes answers poorly. */
export function uses12Hour(locale?: string): boolean {
  return !new Date(2026, 0, 1, 13).toLocaleTimeString(locale, { hour: 'numeric' }).includes('13');
}

/** "7:00 PM" or "19:00", as this locale writes it. */
export function timeLabel(time: string, locale?: string): string {
  const t = parseTime(time);
  return t ? new Date(2026, 0, 1, t.hour, t.minute).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) : time;
}
