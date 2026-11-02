// Where the night is at a bar: before doors, during service or after close.
// Tonight orders its sections by it (Loop-tonight, decided 1 Nov 2026:
// "Tonight ordered by the hour"). Plain functions so nightPhase.check.ts can
// hold them.

import { barClock, hoursStatus, WEEK_DAYS, type WeekHours } from './barHours';

export type NightPhase = 'before' | 'service' | 'after';

const HOUR = 60;
/** The service day turns over at 6am (lib/serviceDay.ts). */
const TURNOVER = 6 * HOUR;
/** With no hours on the bar's page: doors at 5pm, last call by 2am. */
const DOORS = 17 * HOUR;
const CLOSE = 2 * HOUR;

const minuteOf = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * HOUR + m;
};

/**
 * Before doors until the bar opens, during service while it's open, after
 * close once its last range today has ended (until 6am, when the next day's
 * before doors starts). Between a lunch and a dinner it's before doors again.
 * A day the bar is shut is before doors all day, and so is the small hours
 * after it.
 * ponytail: with no hours on the bar's page it guesses doors at 5pm and a
 * 2am close; a bar with other hours sets them on its page.
 */
export function nightPhase(hours: WeekHours | null | undefined, now: Date, timeZone?: string | null): NightPhase {
  const { day, minute } = barClock(now, timeZone);
  if (!hours || !Object.values(hours).some((ranges) => ranges?.length)) {
    if (minute >= DOORS || minute < CLOSE) return 'service';
    return minute < TURNOVER ? 'after' : 'before';
  }
  if (hoursStatus(hours, now, timeZone)?.open) return 'service';
  // Before 6am it's still last night: after close if the bar opened then, else before doors.
  if (minute < TURNOVER) return hours[WEEK_DAYS[(day + 6) % 7]]?.length ? 'after' : 'before';
  const today = (hours[WEEK_DAYS[day]] ?? []).map(([open]) => minuteOf(open));
  if (today.some((open) => open > minute)) return 'before';
  return today.length ? 'after' : 'before';
}

/** The next service day's name, from the service day's date: "Saturday" for a Friday night. */
export function nextNight(serviceDate: Date, locale?: string): string {
  const next = new Date(serviceDate);
  next.setDate(next.getDate() + 1);
  return next.toLocaleDateString(locale, { weekday: 'long' });
}
