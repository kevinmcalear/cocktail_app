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
