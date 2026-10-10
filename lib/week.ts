import { toDay } from './collection';

/**
 * This week: events, menus going on, new drinks and dated home menus, as
 * bar_week / my_week return them (20261012600000_this_week.sql). Plain JSON,
 * so the query cache can keep it.
 */
export type WeekItemKind = 'event' | 'menu' | 'drink' | 'home_menu';
export type EventKind = 'takeover' | 'guest_shift' | 'tasting' | 'launch' | 'private' | 'other';

export interface WeekItem {
  kind: WeekItemKind;
  id: string;
  barId: string | null;
  barProfileId: string | null;
  barName: string | null;
  barColor: string | null;
  startsAt: string;
  endsAt: string | null;
  name: string;
  eventKind: EventKind | null;
  isPublic: boolean;
  houseMenuOn: boolean | null;
  description: string | null;
  ticketUrl: string | null;
  guestProfileId: string | null;
  guestName: string | null;
  menuId: string | null;
  drinkCount: number | null;
  imageUrl: string | null;
  glassKey: string | null;
  guestCount: number | null;
}

export interface WeekRow {
  kind: WeekItemKind;
  id: string;
  bar_id: string | null;
  bar_profile_id: string | null;
  bar_name: string | null;
  bar_color: string | null;
  starts_at: string;
  ends_at: string | null;
  name: string;
  event_kind: EventKind | null;
  is_public: boolean | null;
  house_menu_on: boolean | null;
  description: string | null;
  ticket_url: string | null;
  guest_profile_id: string | null;
  guest_name: string | null;
  menu_id: string | null;
  drink_count: number | null;
  image_url: string | null;
  glass_key: string | null;
  guest_count: number | null;
}

export const toWeekItem = (r: WeekRow): WeekItem => ({
  kind: r.kind,
  id: r.id,
  barId: r.bar_id,
  barProfileId: r.bar_profile_id,
  barName: r.bar_name,
  barColor: r.bar_color,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  name: r.name,
  eventKind: r.event_kind,
  isPublic: !!r.is_public,
  houseMenuOn: r.house_menu_on,
  description: r.description,
  ticketUrl: r.ticket_url,
  guestProfileId: r.guest_profile_id,
  guestName: r.guest_name,
  menuId: r.menu_id,
  drinkCount: r.drink_count,
  imageUrl: r.image_url,
  glassKey: r.glass_key,
  guestCount: r.guest_count,
});

/** How many days "this week" covers, today included. */
export const WEEK_DAYS = 7;

/**
 * The start of the bar's day: midnight, except that until 6 in the morning
 * it's still last night (Tonight's date turns over at 6am too).
 */
export function weekStart(now: number): Date {
  const d = new Date(now);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The local day an item belongs to. A home menu is a date sent as noon UTC: read it back in UTC. */
export function itemDay(item: Pick<WeekItem, 'kind' | 'startsAt'>): string {
  const d = new Date(item.startsAt);
  if (item.kind === 'home_menu') return d.toISOString().slice(0, 10);
  // Something at 1am belongs to the night before, like Tonight.
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return toDay(d);
}

/** The week's days, today first: 2026-10-10, 2026-10-11, ... */
export function weekDays(from: Date, days = WEEK_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => toDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)));
}

/** What's on: events, menus going on and home menus, soonest first. Drinks are "new", not "on". */
export function upcoming(items: WeekItem[], from: Date): WeekItem[] {
  const first = toDay(from);
  return items
    .filter((i) => i.kind !== 'drink' && itemDay(i) >= first)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Drinks added (or published) lately, newest first. */
export function newDrinks(items: WeekItem[]): WeekItem[] {
  return items.filter((i) => i.kind === 'drink').sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Each day of the week with what's on that day. */
export function byDay(items: WeekItem[], from: Date, days = WEEK_DAYS): { day: string; items: WeekItem[] }[] {
  const on = upcoming(items, from);
  return weekDays(from, days).map((day) => ({ day, items: on.filter((i) => itemDay(i) === day) }));
}

const EVENT_LABELS: Record<EventKind, string> = {
  takeover: 'Takeover',
  guest_shift: 'Guest shift',
  tasting: 'Tasting',
  launch: 'Launch',
  private: 'Private event',
  other: 'Event',
};

export const EVENT_KINDS: { kind: EventKind; label: string }[] = [
  { kind: 'takeover', label: 'Takeover' },
  { kind: 'guest_shift', label: 'Guest shift' },
  { kind: 'tasting', label: 'Tasting or class' },
  { kind: 'launch', label: 'Launch' },
  { kind: 'private', label: 'Private' },
  { kind: 'other', label: 'Other' },
];

/** The word that goes with the dot, so the dot is never the only signal. */
export function kindLabel(item: Pick<WeekItem, 'kind' | 'eventKind' | 'isPublic'>): string {
  if (item.kind === 'menu') return 'Menu goes on';
  if (item.kind === 'drink') return 'New drink';
  if (item.kind === 'home_menu') return 'Your home menu';
  const label = EVENT_LABELS[item.eventKind ?? 'other'];
  return item.isPublic || item.eventKind === 'private' ? label : `${label}, team only`;
}

/** The dot's shape: events round (a ring when team only), menus square. */
export type DotShape = 'round' | 'ring' | 'square';
export function dotShape(item: Pick<WeekItem, 'kind' | 'isPublic'>): DotShape {
  if (item.kind === 'menu' || item.kind === 'home_menu') return 'square';
  return item.kind === 'event' && !item.isPublic ? 'ring' : 'round';
}

/** Which colour family the dot takes. The screen maps it to tokens. */
export type DotTone = 'guest' | 'tasting' | 'accent' | 'muted';
export function dotTone(item: Pick<WeekItem, 'kind' | 'eventKind'>): DotTone {
  if (item.kind !== 'event') return item.kind === 'drink' ? 'muted' : 'accent';
  if (item.eventKind === 'takeover' || item.eventKind === 'guest_shift') return 'guest';
  if (item.eventKind === 'tasting') return 'tasting';
  return 'accent';
}

/** "Today", "Tomorrow", or "Sat", for the sidebar's right-hand column. */
export function shortDay(day: string, from: Date, locale?: string): string {
  const days = weekDays(from, 2);
  if (day === days[0]) return 'Today';
  if (day === days[1]) return 'Tomorrow';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short' });
}

/** "Sat 10": the weekday then the date, whatever order the locale would put them in. */
const weekdayDate = (d: Date, locale?: string) => `${d.toLocaleDateString(locale, { weekday: 'short' })} ${d.getDate()}`;

/** A column or group heading: "Today · Sat 10", "Sun 11". */
export function dayHeading(day: string, from: Date, locale?: string): { lead: string | null; date: string } {
  const [y, m, d] = day.split('-').map(Number);
  return { lead: day === toDay(from) ? 'Today' : null, date: weekdayDate(new Date(y, m - 1, d), locale) };
}

/** "7 pm to late", "3 to 5 pm", "8 pm to midnight". Locale times, so 24-hour places get "19:00 to late". */
export function timeLine(item: Pick<WeekItem, 'kind' | 'startsAt' | 'endsAt'>, locale?: string): string | null {
  if (item.kind !== 'event') return null;
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return item.endsAt ? `${fmt(item.startsAt)} to ${fmt(item.endsAt)}` : `${fmt(item.startsAt)} to late`;
}

/** The detail line under an item's name. */
export function detailLine(item: WeekItem, locale?: string): string {
  const parts: string[] = [];
  if (item.kind === 'event') {
    const time = timeLine(item, locale);
    if (time) parts.push(time);
    if (item.guestName) parts.push(item.eventKind === 'guest_shift' ? `with ${item.guestName}` : item.guestName);
    if (item.drinkCount) parts.push(`${item.drinkCount} ${item.drinkCount === 1 ? 'drink' : 'drinks'}`);
    if (item.houseMenuOn === false) parts.push('house menu off');
  } else if (item.kind === 'menu') {
    if (item.drinkCount != null) parts.push(`${item.drinkCount} ${item.drinkCount === 1 ? 'drink' : 'drinks'}`);
  } else if (item.kind === 'home_menu') {
    if (item.guestCount) parts.push(`${item.guestCount} guests`);
    if (item.drinkCount) parts.push(`${item.drinkCount} ${item.drinkCount === 1 ? 'drink' : 'drinks'}`);
  }
  return parts.join(' · ');
}

/** Ticket and booking links, as people paste them: a bare domain gets https. Null when it isn't a web link. */
export function cleanTicketUrl(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const url = /^https?:\/\//i.test(t) ? t.replace(/^http:/i, 'https:') : `https://${t}`;
  try {
    const u = new URL(url);
    return u.hostname.includes('.') && !/\s/.test(url) ? u.toString() : null;
  } catch {
    return null;
  }
}

export type WeekFilter = 'all' | 'events' | 'menus' | 'public';

/** The week page's chips: everything, only events, only menus and drinks, or only what guests see. */
export function filterWeek(items: WeekItem[], filter: WeekFilter): WeekItem[] {
  if (filter === 'events') return items.filter((i) => i.kind === 'event');
  if (filter === 'menus') return items.filter((i) => i.kind !== 'event');
  if (filter === 'public') return items.filter((i) => i.isPublic);
  return items;
}

/** "Fri 10 to Thu 16 Oct". */
export function weekRange(from: Date, days = WEEK_DAYS, locale?: string): string {
  const last = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days - 1);
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'short' });
  const first = `${weekdayDate(from, locale)}${last.getMonth() === from.getMonth() ? '' : ` ${month(from)}`}`;
  return `${first} to ${weekdayDate(last, locale)} ${month(last)}`;
}
