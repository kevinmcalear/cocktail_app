/**
 * The takeover page's words (board Kept-takeover): when the night is, when a
 * guest bartender's access ends, what is still open on the run sheet, and how
 * much of the house list stays on. Pure; checked by lib/takeover.check.ts.
 */
import { dayMonth } from './dayMonth';

/** "8pm", "8:30pm", "12am". */
export function clock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''}${d.getHours() < 12 ? 'am' : 'pm'}`;
}

const valid = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "Thu 6 Nov, 8pm to 2am"; the day alone with no time; null with no date. */
export function nightWhen(startsAt: string | null | undefined, endsAt: string | null | undefined): string | null {
  const start = valid(startsAt);
  if (!start) return null;
  const day = dayMonth(start, { weekday: 'short', month: 'short' }, 'en-GB');
  const end = valid(endsAt);
  return `${day}, ${clock(start)}${end ? ` to ${clock(end)}` : ''}`;
}

/** "Fri 7 Nov, 4am": when a guest bartender's access ends. */
export function accessEnds(iso: string | null | undefined): string | null {
  const d = valid(iso);
  return d ? `${dayMonth(d, { weekday: 'short', month: 'short' }, 'en-GB')}, ${clock(d)}` : null;
}

/** "Thu 6 Nov". */
export function shortDay(iso: string | null | undefined): string | null {
  const d = valid(iso);
  return d ? dayMonth(d, { weekday: 'short', month: 'short' }, 'en-GB') : null;
}

/** "Tue", or "Tue 4 Nov" more than a week ago: when a party's link was sent. */
export function sentDay(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  return now - d.getTime() < 6 * 86_400_000 ? dayMonth(d, { weekday: 'short', month: 'short' }, 'en-GB').split(' ')[0] : dayMonth(d, { weekday: 'short', month: 'short' }, 'en-GB');
}

/** Access ends two hours after the night does (the board: 8pm to 2am, access to 4am); a day after it starts with no end. */
export function defaultAccessEnd(startsAt: string | null | undefined, endsAt: string | null | undefined, now: number = Date.now()): string {
  const end = valid(endsAt);
  if (end) return new Date(end.getTime() + 2 * 3_600_000).toISOString();
  const start = valid(startsAt);
  return new Date((start ? start.getTime() : now) + 24 * 3_600_000).toISOString();
}

/** "Mika" from "Mika Sato". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A drink on the takeover's list that nobody has counted yet: "Late Shift · No count yet · Ask Mika". */
export interface OpenThing {
  key: string;
  name: string;
  why: string;
  ask: string | null;
}

/** What is still open on the run sheet: the guest bar's drinks with no count. `ask`: who to ask, as they're called (a guest bartender's first name, else the guest bar). */
export function stillOpen(drinks: readonly { id: string; name: string; serves: number | null }[], ask: string | null): OpenThing[] {
  return drinks.filter((d) => !d.serves || d.serves <= 0).map((d) => ({ key: d.id, name: d.name, why: 'No count yet', ask: ask ? `Ask ${ask}` : null }));
}

/** The house list beside the takeover: each drink on, or off tonight; all of it off when the night turns the house menu off. */
export function houseTonight<T extends { id: string }>(drinks: readonly T[], offIds: ReadonlySet<string>, houseMenuOn: boolean | null): { drinks: (T & { on: boolean })[]; on: number } {
  const rows = drinks.map((d) => ({ ...d, on: houseMenuOn !== false && !offIds.has(d.id) }));
  return { drinks: rows, on: rows.filter((r) => r.on).length };
}
