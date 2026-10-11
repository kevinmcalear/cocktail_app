// Reading a venue's calendar feed (.ics) into This week's events. Plain
// TypeScript with no Deno APIs, so scripts/icsRead.check.ts runs it under Node.
//
// Covers what bar calendars use: timed events in UTC, a named zone (TZID) or
// floating time, weekly and daily repeats (RRULE with INTERVAL, COUNT, UNTIL
// and BYDAY), skipped dates (EXDATE), and moved or cancelled occurrences
// (RECURRENCE-ID, STATUS:CANCELLED). All-day entries are left out: a bar's
// "closed for Christmas" isn't an event.
//
// ponytail: monthly and yearly repeats are left out too (rare for bar events);
// the upgrade is a full RFC 5545 library once a venue's feed needs one.

export interface CalendarEvent {
  /** UID plus the occurrence start, so each repeat is its own row. */
  uid: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  description: string | null;
  url: string | null;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

const DAY_MS = 24 * 3600 * 1000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
/** A feed can ask for a lot of repeats; this many per event is plenty for a month. */
const MAX_REPEATS = 400;

/** Lines that start with a space or tab continue the line before. */
export function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseProp(line: string): Prop | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

export const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** The UTC instant for a wall-clock time in a time zone (2026-10-10 19:00 in Europe/London). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): number {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return wall; // An unknown zone name: read it as UTC rather than drop the event.
  }
  const offsetAt = (t: number) => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - t;
  };
  // Twice, so a time near a clock change settles on the right side of it.
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t);
  return t;
}

/** A DATE-TIME value as a UTC instant, or null for a DATE (all day) or something unreadable. */
export function parseDateTime(prop: Pick<Prop, 'params' | 'value'>, defaultZone: string | null): number | null {
  if (prop.params.VALUE === 'DATE') return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(prop.value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (m[7] === 'Z') return Date.UTC(y, mo - 1, d, h, mi, s);
  const zone = prop.params.TZID ?? defaultZone;
  return zone ? zonedToUtc(y, mo, d, h, mi, s, zone) : Date.UTC(y, mo - 1, d, h, mi, s);
}

interface RawEvent {
  props: Prop[];
}

function get(e: RawEvent, name: string): Prop | undefined {
  return e.props.find((p) => p.name === name);
}

/** Start times of a repeating event inside [from, to), weekly and daily only. */
export function repeats(start: number, rule: string, from: number, to: number, zone: string | null): number[] {
  const r = Object.fromEntries(rule.split(';').map((kv) => kv.split('=') as [string, string]));
  const freq = r.FREQ;
  if (freq !== 'WEEKLY' && freq !== 'DAILY') return start >= from && start < to ? [start] : [];
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseDateTime({ params: {}, value: r.UNTIL.length === 8 ? `${r.UNTIL}T235959Z` : r.UNTIL }, zone) : null;
  // Step through wall-clock days in the event's zone, so 7pm stays 7pm across a clock change.
  const startDate = new Date(start);
  const wall = zone ? wallParts(start, zone) : { y: startDate.getUTCFullYear(), mo: startDate.getUTCMonth() + 1, d: startDate.getUTCDate(), h: startDate.getUTCHours(), mi: startDate.getUTCMinutes(), s: startDate.getUTCSeconds() };
  const days = freq === 'WEEKLY' && r.BYDAY ? r.BYDAY.split(',').map((d) => WEEKDAYS.indexOf(d.slice(-2))) : null;
  const firstDay = Date.UTC(wall.y, wall.mo - 1, wall.d);
  // Weeks count from Monday (RFC 5545's default WKST), not from the first date.
  const sinceMonday = (new Date(firstDay).getUTCDay() + 6) % 7;
  const out: number[] = [];
  let made = 0;
  for (let i = 0; i < 3660 && made < count && made < MAX_REPEATS; i++) {
    const day = firstDay + i * DAY_MS;
    const dd = new Date(day);
    const weeks = Math.floor((i + sinceMonday) / 7);
    const hit =
      freq === 'DAILY'
        ? i % interval === 0
        : weeks % interval === 0 && (days ? days.includes(dd.getUTCDay()) : dd.getUTCDay() === new Date(firstDay).getUTCDay());
    if (!hit) continue;
    const t = zone ? zonedToUtc(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), wall.h, wall.mi, wall.s, zone) : day + (wall.h * 3600 + wall.mi * 60 + wall.s) * 1000;
    if (t < start) continue;
    if (until !== null && t > until) break;
    made++;
    if (t >= to) break;
    if (t >= from) out.push(t);
  }
  return out;
}

function wallParts(t: number, zone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** The feed's timed events that start in [from, to), repeats expanded, soonest first. */
export function readCalendar(text: string, from: number, to: number): CalendarEvent[] {
  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === 'BEGIN:VCALENDAR')) throw new Error("That link isn't a calendar.");
  const events: RawEvent[] = [];
  let calZone: string | null = null;
  let current: RawEvent | null = null;
  let depth = 0;
  for (const line of lines) {
    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === 'VEVENT') current = { props: [] };
    else if (prop.name === 'BEGIN' && current) depth++;
    else if (prop.name === 'END' && current && depth > 0) depth--;
    else if (prop.name === 'END' && prop.value.toUpperCase() === 'VEVENT' && current) {
      events.push(current);
      current = null;
    } else if (current && depth === 0) current.props.push(prop);
    else if (!current && prop.name === 'X-WR-TIMEZONE') calZone = prop.value.trim();
  }

  // Moved or cancelled occurrences, by UID and original start.
  const overrides = new Map<string, RawEvent>();
  for (const e of events) {
    const rid = get(e, 'RECURRENCE-ID');
    const uid = get(e, 'UID')?.value;
    if (rid && uid) {
      const t = parseDateTime(rid, calZone);
      if (t !== null) overrides.set(`${uid}|${t}`, e);
    }
  }

  const out: CalendarEvent[] = [];
  const emit = (e: RawEvent, uid: string, start: number, length: number | null) => {
    if ((get(e, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') return;
    const name = unescapeText(get(e, 'SUMMARY')?.value ?? '').trim();
    if (!name) return;
    const description = unescapeText(get(e, 'DESCRIPTION')?.value ?? '').trim();
    const url = get(e, 'URL')?.value.trim() ?? '';
    out.push({
      uid: `${uid}|${new Date(start).toISOString()}`,
      name: name.slice(0, 120),
      startsAt: new Date(start).toISOString(),
      endsAt: length && length > 0 ? new Date(start + length).toISOString() : null,
      description: description ? description.slice(0, 500) : null,
      url: /^https:\/\/\S+$/.test(url) ? url.slice(0, 500) : null,
    });
  };

  for (const e of events) {
    if (get(e, 'RECURRENCE-ID')) continue;
    const uid = get(e, 'UID')?.value.trim();
    const dtstart = get(e, 'DTSTART');
    if (!uid || !dtstart) continue;
    const zone = dtstart.params.TZID ?? calZone;
    const start = parseDateTime(dtstart, calZone);
    if (start === null) continue;
    const dtend = get(e, 'DTEND');
    const end = dtend ? parseDateTime(dtend, calZone) : null;
    const length = end !== null ? end - start : null;
    const rule = get(e, 'RRULE')?.value;
    const skipped = new Set(
      e.props
        .filter((p) => p.name === 'EXDATE')
        .flatMap((p) => p.value.split(',').map((v) => parseDateTime({ params: p.params, value: v }, calZone)))
        .filter((t): t is number => t !== null)
    );
    const starts = rule ? repeats(start, rule, from, to, zone) : start >= from && start < to ? [start] : [];
    for (const t of starts) {
      if (skipped.has(t)) continue;
      const moved = overrides.get(`${uid}|${t}`);
      if (moved) {
        const ms = parseDateTime(get(moved, 'DTSTART') ?? dtstart, calZone);
        const me = get(moved, 'DTEND');
        const mEnd = me ? parseDateTime(me, calZone) : null;
        if (ms !== null && ms >= from && ms < to) emit(moved, uid, ms, mEnd !== null ? mEnd - ms : length);
      } else emit(e, uid, t, length);
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** What kind of event a calendar entry probably is, from its name and notes. */
export function guessKind(name: string, description: string | null): 'takeover' | 'guest_shift' | 'tasting' | 'launch' | 'private' | 'other' {
  const t = `${name} ${description ?? ''}`.toLowerCase();
  if (/\b(private|buy-?out|closed for|exclusive hire|private hire)\b/.test(t)) return 'private';
  if (/\btake-?over\b|\s[x×]\s/.test(t)) return 'takeover';
  if (/\bguest (shift|bartender)s?\b/.test(t)) return 'guest_shift';
  if (/\b(tasting|masterclass|class|workshop|seminar)\b/.test(t)) return 'tasting';
  if (/\b(launch|new menu|opening night|release)\b/.test(t)) return 'launch';
  return 'other';
}

/** Words that keep an imported event with the team: a staff training isn't for guests. */
export const TEAM_WORDS = ['staff', 'team', 'training', 'clean', 'deep clean', 'delivery', 'stocktake', 'inventory', 'meeting', 'rota', 'interview'];

export function looksInternal(name: string): boolean {
  const t = name.toLowerCase();
  return TEAM_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(t));
}
