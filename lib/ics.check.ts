import assert from 'node:assert/strict';

import { calendarIcs, fold, icsText } from './ics';

const now = '2026-10-10T12:00:00.000Z';
const event = {
  id: 'e1',
  name: 'Pale Moth × Little Rye; guest drinks, all night',
  startsAt: '2026-10-10T23:00:00.000Z',
  endsAt: null,
  description: 'Five drinks.\nWalk-ins only.',
  location: 'Little Rye',
  url: 'https://babyvom.it/e/e1',
};

const ics = calendarIcs([event], 'Little Rye this week', now);
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
assert.ok(ics.includes('DTSTART:20261010T230000Z'));
// No end: four hours, "to late".
assert.ok(ics.includes('DTEND:20261011T030000Z'));
assert.ok(ics.includes('UID:e1@babyvom.it'));
assert.ok(ics.includes('X-WR-CALNAME:Little Rye this week'));
assert.ok(ics.includes('SUMMARY:Pale Moth × Little Rye\\; guest drinks\\, all night'));
assert.ok(ics.includes('DESCRIPTION:Five drinks.\\nWalk-ins only.'));
// One event to add: no calendar name, so it isn't a subscription.
assert.ok(!calendarIcs([event], null, now).includes('X-WR-CALNAME'));

assert.equal(icsText('a\\b'), 'a\\\\b');

// Folding keeps every physical line within 75 octets and never splits a character.
const long = `DESCRIPTION:${'é'.repeat(80)}`;
const folded = fold(long);
for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
assert.equal(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), long);
assert.equal(fold('SHORT:1'), 'SHORT:1');
