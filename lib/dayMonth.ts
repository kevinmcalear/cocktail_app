/**
 * A date the way the boards write it, day before month in every locale:
 * "Tuesday 3 November", "Tue 3 Nov", "3 Nov". toLocaleDateString's own order
 * follows the phone's region, so en-US reads "Tuesday, November 3".
 * Checked by lib/dayMonth.check.ts.
 */
export function dayMonth(date: Date, o: { weekday?: 'long' | 'short'; month: 'long' | 'short'; timeZone?: string }, locale?: string): string {
  const part = (opts: Intl.DateTimeFormatOptions) => date.toLocaleDateString(locale, { ...opts, timeZone: o.timeZone });
  const day = part({ day: 'numeric' }).replace(/\D/g, '');
  return [o.weekday ? part({ weekday: o.weekday }) : null, day, part({ month: o.month })].filter(Boolean).join(' ');
}
