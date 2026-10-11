/**
 * A bar's day runs past midnight: until 6am local time it's still last
 * night. The Tonight tab's calendar shows this date (hooks/useServiceDay.ts).
 * Checked by lib/serviceDay.check.ts.
 */
export const TURNOVER_HOUR = 6;

/** The service day's date, at local midnight: today from 6am, yesterday before. */
export function serviceDate(now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < TURNOVER_HOUR) day.setDate(day.getDate() - 1);
  return day;
}

/** Milliseconds from `now` to the next 6am, local time (across a clock change too). */
export function msUntilTurnover(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TURNOVER_HOUR);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
