/**
 * A date the way the boards write it, day before month in every locale:
 * "Tuesday 3 November", "Tue 3 Nov", "3 Nov", "Mon 3 Nov 2025", and with a
 * time "Tue 3 Nov, 7:30 pm". toLocaleDateString's own order follows the
 * phone's region, so en-US reads "Tuesday, November 3". One format,
 * reordered, so the month keeps its form beside a day (Russian "3 ноября")
 * and the day keeps its own digits.
 * Checked by lib/dayMonth.check.ts.
 */
export interface DayMonthOptions {
  weekday?: 'long' | 'short';
  month: 'long' | 'short';
  year?: 'numeric';
  /** Add the time of day after the date. */
  time?: boolean;
  timeZone?: string;
}

export function dayMonth(date: Date, o: DayMonthOptions, locale?: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: o.weekday, day: 'numeric', month: o.month, year: o.year, timeZone: o.timeZone };
  if (Number.isNaN(date.getTime())) return date.toLocaleDateString(locale, opts);
  const parts = new Intl.DateTimeFormat(locale, opts).formatToParts(date);
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const day = [of('weekday'), of('day'), of('month'), of('year')].filter(Boolean).join(' ');
  if (!o.time) return day;
  return `${day}, ${date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: o.timeZone })}`;
}
