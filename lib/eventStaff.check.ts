import assert from 'node:assert/strict';

import { guestShiftIds, shortName, staffChips, withGuestStaff, type EventStaffRow } from './eventStaff';
import type { WeekItem } from './week';

const row = (over: Partial<EventStaffRow>): EventStaffRow => ({ id: 'r', eventId: 'e', userId: null, name: null, isGuest: false, profileId: null, sortOrder: 0, ...over });
const item = (over: Partial<WeekItem>): WeekItem => ({
  kind: 'event', id: 'e', barId: 'b', barProfileId: null, barName: 'Little Rye', barColor: null,
  startsAt: '2026-10-15T19:00:00Z', endsAt: null, name: 'Guest shift: Mara Q.', eventKind: 'guest_shift',
  isPublic: true, houseMenuOn: true, description: null, ticketUrl: null, guestProfileId: null, guestName: null,
  menuId: null, drinkCount: null, imageUrl: null, glassKey: null, guestCount: null, guestColor: null, ...over,
});

// --- names as the boards write them ---
assert.equal(shortName('Sam Ortiz'), 'Sam O.');
assert.equal(shortName('Jun van Akker'), 'Jun A.');
assert.equal(shortName('Mara Q.'), 'Mara Q.', 'a typed initial stays');
assert.equal(shortName('Mara Q'), 'Mara Q');
assert.equal(shortName('  Cher '), 'Cher');
assert.equal(shortName('Élodie Ébert'), 'Élodie É.');

// --- chips: named people, then the unnamed by side only ---
const chips = staffChips(
  [
    row({ id: '1', name: 'Jun Akiyama', isGuest: true, profileId: 'p1' }),
    row({ id: '2', name: 'Sam Ortiz' }),
    row({ id: '3' }),
    row({ id: '4' }),
    row({ id: '5', isGuest: true }),
  ],
  { barName: 'Little Rye', guestBar: 'Pale Moth' },
);
assert.deepEqual(
  chips.map((c) => c.label),
  ['Jun A., Pale Moth', 'Sam O., Little Rye', '2 from Little Rye', 'Guest bartender'],
);
assert.equal(chips[0].spoken, 'Jun Akiyama, Pale Moth', 'read aloud in full');
assert.equal(chips[0].profileId, 'p1');
assert.equal(chips[2].person, null, 'no initials for someone not shown');
assert.deepEqual(staffChips([row({})], { barName: 'Little Rye', guestBar: null }).map((c) => c.label), ['Little Rye team']);
assert.deepEqual(staffChips([row({ name: 'Mara Q.', isGuest: true })], { barName: 'Little Rye', guestBar: null }).map((c) => c.label), ['Mara Q.'], 'a guest with no guest bar');
assert.deepEqual(staffChips([], { barName: 'Little Rye', guestBar: null }), []);

// --- the week's guest shift line ---
const lantern = item({ guestProfileId: 'lantern', guestName: 'The Lantern Room' });
const mara = row({ name: 'Mara Quinn', isGuest: true });
assert.equal(withGuestStaff([lantern], [mara])[0].guestName, 'Mara Q. from The Lantern Room');
assert.equal(withGuestStaff([item({})], [mara])[0].guestName, 'Mara Q.', 'no guest bar: just the bartender');
assert.equal(withGuestStaff([item({ guestName: 'Mara Q. from The Lantern Room' })], [mara])[0].guestName, 'Mara Q. from The Lantern Room', 'typed guest stays');
assert.equal(withGuestStaff([lantern], [row({ isGuest: true })])[0].guestName, 'The Lantern Room', 'an unnamed guest adds nothing');
assert.equal(withGuestStaff([lantern], [row({ name: 'Sam Ortiz' })])[0].guestName, 'The Lantern Room', 'teammates are not the guest');
assert.equal(withGuestStaff([item({ eventKind: 'takeover', guestName: 'Pale Moth', guestProfileId: 'pm' })], [mara])[0].guestName, 'Pale Moth', 'takeovers keep the bar');
assert.equal(
  withGuestStaff([lantern], [mara, row({ id: '2', name: 'Ada Lee', isGuest: true }), row({ id: '3', name: 'Bo', isGuest: true })])[0].guestName,
  'Mara Q., Ada L. and Bo from The Lantern Room',
);
assert.equal(withGuestStaff([lantern], [{ ...mara, eventId: 'other' }])[0].guestName, 'The Lantern Room', 'only its own event');

assert.deepEqual(guestShiftIds([lantern, item({ id: 'typed', guestName: 'Mara Q.' }), item({ id: 'bare' }), item({ id: 't', eventKind: 'takeover' })]), ['e', 'bare']);

console.log('eventStaff checks passed');
