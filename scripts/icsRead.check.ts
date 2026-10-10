import assert from 'node:assert/strict';

import { guessKind, looksInternal, readCalendar, repeats, unfold, zonedToUtc } from '../supabase/functions/_shared/icsRead';

// sync-calendar reads a venue's .ics feed into events. Times must land on the
// right instant whatever zone the feed uses, repeats must expand, and moved,
// skipped and cancelled dates must follow the feed.

const from = Date.parse('2026-10-10T00:00:00Z');
const to = Date.parse('2026-11-10T00:00:00Z');
const cal = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-TIMEZONE:Europe/London', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

// --- unfolding and text ---
assert.deepEqual(unfold('SUMMARY:Pale Moth\r\n  takeover\r\nX:1'), ['SUMMARY:Pale Moth takeover', 'X:1']);

// --- zones ---
// London is on BST (UTC+1) until 25 Oct 2026, then GMT.
assert.equal(new Date(zonedToUtc(2026, 10, 10, 19, 0, 0, 'Europe/London')).toISOString(), '2026-10-10T18:00:00.000Z');
assert.equal(new Date(zonedToUtc(2026, 10, 31, 19, 0, 0, 'Europe/London')).toISOString(), '2026-10-31T19:00:00.000Z');
assert.equal(new Date(zonedToUtc(2026, 10, 10, 19, 0, 0, 'America/New_York')).toISOString(), '2026-10-10T23:00:00.000Z');
// An unknown zone reads as UTC rather than dropping the event.
assert.equal(new Date(zonedToUtc(2026, 10, 10, 19, 0, 0, 'Mars/Olympus')).toISOString(), '2026-10-10T19:00:00.000Z');

// --- one event, three ways of writing the time ---
const one = readCalendar(
  cal(
    ev('UID:a', 'DTSTART:20261010T230000Z', 'DTEND:20261011T030000Z', 'SUMMARY:Pale Moth × Little Rye\\, all night', 'DESCRIPTION:Five drinks.\\nWalk-ins.', 'URL:https://lu.ma/x'),
    ev('UID:b', 'DTSTART;TZID=America/New_York:20261014T150000', 'DTEND;TZID=America/New_York:20261014T170000', 'SUMMARY:Agave masterclass'),
    ev('UID:c', 'DTSTART:20261016T200000', 'SUMMARY:Floating in the calendar zone'),
    ev('UID:d', 'DTSTART;VALUE=DATE:20261025', 'SUMMARY:Closed all day'),
    ev('UID:e', 'DTSTART:20250101T190000Z', 'SUMMARY:Long ago')
  ),
  from,
  to
);
assert.deepEqual(one.map((e) => e.name), ['Pale Moth × Little Rye, all night', 'Agave masterclass', 'Floating in the calendar zone']);
assert.equal(one[0].description, 'Five drinks.\nWalk-ins.');
assert.equal(one[0].url, 'https://lu.ma/x');
assert.equal(one[0].endsAt, '2026-10-11T03:00:00.000Z');
assert.equal(one[1].startsAt, '2026-10-14T19:00:00.000Z');
assert.equal(one[2].startsAt, '2026-10-16T19:00:00.000Z', 'floating time reads in X-WR-TIMEZONE');
assert.equal(one[2].endsAt, null);

// --- repeats: weekly Sundays at 1pm London, across the clock change, one skipped, one moved, one cancelled ---
const weekly = readCalendar(
  cal(
    ev('UID:roast', 'DTSTART;TZID=Europe/London:20261004T130000', 'DTEND;TZID=Europe/London:20261004T160000', 'RRULE:FREQ=WEEKLY;BYDAY=SU', 'EXDATE;TZID=Europe/London:20261018T130000', 'SUMMARY:Sunday roast'),
    ev('UID:roast', 'RECURRENCE-ID;TZID=Europe/London:20261025T130000', 'DTSTART;TZID=Europe/London:20261025T140000', 'DTEND;TZID=Europe/London:20261025T170000', 'SUMMARY:Sunday roast (late)'),
    ev('UID:roast', 'RECURRENCE-ID;TZID=Europe/London:20261101T130000', 'DTSTART;TZID=Europe/London:20261101T130000', 'STATUS:CANCELLED', 'SUMMARY:Sunday roast')
  ),
  from,
  to
);
assert.deepEqual(
  weekly.map((e) => [e.name, e.startsAt]),
  [
    ['Sunday roast', '2026-10-11T12:00:00.000Z'],
    ['Sunday roast (late)', '2026-10-25T14:00:00.000Z'],
    ['Sunday roast', '2026-11-08T13:00:00.000Z'],
  ]
);
// Each occurrence has its own id, stable across syncs.
assert.equal(new Set(weekly.map((e) => e.uid)).size, weekly.length);

// --- rule details ---
const start = Date.parse('2026-10-01T19:00:00Z');
assert.equal(repeats(start, 'FREQ=DAILY;COUNT=3', from, to, null).length, 0, 'three days from 1 Oct end before the window');
assert.equal(repeats(start, 'FREQ=DAILY;INTERVAL=2;UNTIL=20261016T235959Z', from, to, null).length, 3);
assert.deepEqual(
  repeats(start, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH', from, Date.parse('2026-10-31T00:00:00Z'), null).map((t) => new Date(t).toISOString().slice(0, 10)),
  ['2026-10-13', '2026-10-15', '2026-10-27', '2026-10-29']
);
assert.equal(repeats(start, 'FREQ=MONTHLY', from, to, null).length, 0, 'monthly repeats are left out');

// --- not a calendar ---
assert.throws(() => readCalendar('<html>Sign in</html>', from, to), /isn't a calendar/);

// --- guessing ---
assert.equal(guessKind('Pale Moth takeover', null), 'takeover');
assert.equal(guessKind('Pale Moth x Little Rye', null), 'takeover');
assert.equal(guessKind('Guest shift: Mara Q.', null), 'guest_shift');
assert.equal(guessKind('Agave masterclass', null), 'tasting');
assert.equal(guessKind('Winter menu launch', null), 'launch');
assert.equal(guessKind('Smith wedding', 'Private hire, whole venue'), 'private');
assert.equal(guessKind('Quiz night', null), 'other');
assert.ok(looksInternal('Staff training: allergens'));
assert.ok(looksInternal('Deep clean'));
assert.ok(!looksInternal('Agave masterclass'));
