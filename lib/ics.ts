/**
 * Calendar files (RFC 5545) for This week: one event to add to a calendar, or
 * a bar's public week to subscribe to. Plain text, no dependencies, so the
 * Vercel edge functions in api/ and the app can both use it.
 */

export interface IcsEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  description: string | null;
  location: string | null;
  url: string;
}

/** A takeover with no end runs "to late": calendars get four hours. */
const LATE_HOURS = 4;

/** 20261010T190000Z */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Text values escape backslashes, commas, semicolons and newlines. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets fold onto the next line, which starts with a space. */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

function vevent(e: IcsEvent, now: string): string[] {
  const end = e.endsAt ?? new Date(new Date(e.startsAt).getTime() + LATE_HOURS * 3600 * 1000).toISOString();
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}@babyvom.it`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsText(e.name)}`,
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    `URL:${e.url}`,
    'END:VEVENT',
  ];
}

/** A calendar of events. `name` titles a subscribed calendar ("Little Rye this week"). */
export function calendarIcs(events: IcsEvent[], name: string | null, now = new Date().toISOString()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cocktail//This week//EN',
    'CALSCALE:GREGORIAN',
    ...(name ? [`X-WR-CALNAME:${icsText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'] : []),
    ...events.flatMap((e) => vevent(e, now)),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
