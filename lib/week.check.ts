import assert from 'node:assert/strict';

import { byDay, cleanTicketUrl, dayHeading, filterWeek, weekRange, detailLine, directionsUrl, dotShape, dotTone, itemDay, kindLabel, newDrinks, shortDay, thingsOn, ticketHost, upcoming, weekDays, weekMonday, weekStart, withGuestColors, type WeekItem } from './week';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const item = (over: Partial<WeekItem>): WeekItem => ({
  kind: 'event', id: 'x', barId: 'b', barProfileId: null, barName: 'Little Rye', barColor: null,
  startsAt: new Date(local(2026, 10, 10, 19)).toISOString(), endsAt: null, name: 'x', eventKind: 'takeover',
  isPublic: true, houseMenuOn: true, description: null, ticketUrl: null, guestProfileId: null, guestName: null,
  menuId: null, drinkCount: null, imageUrl: null, glassKey: null, guestCount: null, guestColor: null, ...over,
});

// --- the bar's day turns over at 6am ---
assert.equal(weekStart(local(2026, 10, 10, 18)).getTime(), local(2026, 10, 10));
assert.equal(weekStart(local(2026, 10, 11, 2)).getTime(), local(2026, 10, 10), '2am is still last night');
assert.equal(weekStart(local(2026, 10, 11, 6)).getTime(), local(2026, 10, 11));

const from = weekStart(local(2026, 10, 10, 18));
assert.deepEqual(weekDays(from, 3), ['2026-10-10', '2026-10-11', '2026-10-12']);
// Month ends roll over.
assert.deepEqual(weekDays(weekStart(local(2026, 10, 30, 12)), 3), ['2026-10-30', '2026-10-31', '2026-11-01']);

// --- which day an item is on ---
assert.equal(itemDay(item({ startsAt: new Date(local(2026, 10, 11, 1)).toISOString() })), '2026-10-10', '1am belongs to the night before');
// Home menus are a date sent as noon UTC, whatever the local zone.
assert.equal(itemDay(item({ kind: 'home_menu', startsAt: '2026-10-11T12:00:00.000Z' })), '2026-10-11');

// --- grouping ---
const items = [
  item({ id: 'takeover', startsAt: new Date(local(2026, 10, 10, 19)).toISOString() }),
  item({ id: 'staff', eventKind: 'tasting', isPublic: false, startsAt: new Date(local(2026, 10, 12, 16)).toISOString() }),
  item({ id: 'winter', kind: 'menu', eventKind: null, drinkCount: 8, startsAt: new Date(local(2026, 10, 13, 17)).toISOString() }),
  item({ id: 'old', kind: 'drink', eventKind: null, startsAt: new Date(local(2026, 10, 6, 12)).toISOString() }),
  item({ id: 'new', kind: 'drink', eventKind: null, startsAt: new Date(local(2026, 10, 8, 12)).toISOString() }),
  item({ id: 'lastnight', startsAt: new Date(local(2026, 10, 9, 22)).toISOString() }),
];
assert.deepEqual(upcoming(items, from).map((i) => i.id), ['takeover', 'staff', 'winter'], 'drinks and last night are not "on"');
assert.deepEqual(newDrinks(items).map((i) => i.id), ['new', 'old']);
const days = byDay(items, from);
assert.equal(days.length, 7);
assert.deepEqual(days.map((d) => d.items.map((i) => i.id)), [['takeover'], [], ['staff'], ['winter'], [], [], []]);

// --- labels: the word always goes with the dot ---
assert.equal(kindLabel(item({ eventKind: 'tasting', isPublic: false })), 'Staff tasting, team only');
assert.equal(kindLabel(item({ eventKind: 'tasting' })), 'Tasting');
assert.equal(kindLabel(item({ eventKind: 'launch', isPublic: false })), 'Launch, team only');
assert.equal(kindLabel(item({ eventKind: 'private', isPublic: false })), 'Private event');
assert.equal(kindLabel(item({ kind: 'menu' })), 'Menu goes on');
assert.equal(kindLabel(item({ kind: 'home_menu' })), 'Your home menu');
assert.equal(dotShape(item({ isPublic: false })), 'ring');
assert.equal(dotShape(item({ kind: 'menu' })), 'square');
assert.equal(dotTone(item({ eventKind: 'guest_shift' })), 'guest');
assert.equal(dotTone(item({ eventKind: 'tasting' })), 'tasting');
assert.equal(dotTone(item({ kind: 'drink' })), 'muted');

assert.equal(shortDay('2026-10-10', from), 'Tonight');
assert.equal(shortDay('2026-10-11', from, 'en-GB'), 'Sun', 'no Tomorrow: weekday names after tonight');
assert.equal(shortDay('2026-10-13', from, 'en-GB'), 'Tue');

assert.equal(
  detailLine(item({ startsAt: new Date(local(2026, 10, 10, 19)).toISOString(), guestName: 'Pale Moth', drinkCount: 5 }), 'en-US'),
  '7 PM to late · Pale Moth · 5 drinks'
);
assert.equal(detailLine(item({ eventKind: 'guest_shift', guestName: 'Mara Q.', houseMenuOn: false }), 'en-US'), '7 PM to late · with Mara Q. · house menu off');
assert.equal(detailLine(item({ kind: 'home_menu', guestCount: 6, drinkCount: 4 })), '6 guests · 4 drinks');

// --- ticket links ---
assert.equal(cleanTicketUrl('resy.com/cities/ny/events/1'), 'https://resy.com/cities/ny/events/1');
assert.equal(cleanTicketUrl('http://lu.ma/abc'), 'https://lu.ma/abc');
assert.equal(cleanTicketUrl(''), null);
assert.equal(cleanTicketUrl('not a link'), null);
assert.equal(cleanTicketUrl('localhost'), null);

// --- the week page ---
assert.deepEqual(filterWeek(items, 'events').map((i) => i.id), ['takeover', 'staff', 'lastnight']);
assert.deepEqual(filterWeek(items, 'public').map((i) => i.id).includes('staff'), false);
assert.equal(weekRange(from, 7, 'en-GB'), 'Sat 10 to Fri 16 Oct');
// US English puts the date first on its own; the label doesn't.
assert.equal(weekRange(from, 7, 'en-US'), 'Sat 10 to Fri 16 Oct');
assert.equal(dayHeading('2026-10-11', from, 'en-US').date, 'Sun 11');
assert.equal(weekRange(weekStart(local(2026, 10, 28, 12)), 7, 'en-GB'), 'Wed 28 Oct to Tue 3 Nov');

// --- Kevin's fixes (11 Oct) ---
// Since Monday: from a Saturday, a Monday, and a Sunday (the week's last day).
assert.equal(weekMonday(new Date(2026, 9, 10)).getTime(), local(2026, 10, 5));
assert.equal(weekMonday(new Date(2026, 9, 12)).getTime(), local(2026, 10, 12));
assert.equal(weekMonday(new Date(2026, 9, 11)).getTime(), local(2026, 10, 5));
const drinks = [
  item({ kind: 'drink', id: 'sun', startsAt: new Date(local(2026, 10, 4, 20)).toISOString() }),
  item({ kind: 'drink', id: 'tue', startsAt: new Date(local(2026, 10, 6, 15)).toISOString() }),
];
assert.deepEqual(newDrinks(drinks, weekMonday(from)).map((i) => i.id), ['tue'], 'last Sunday is before Monday');
assert.equal(thingsOn(1), '1 thing on');
assert.equal(thingsOn(5), '5 things on');
assert.equal(ticketHost('https://www.eventbrite.com/e/agave-123'), 'Eventbrite');
assert.equal(ticketHost('https://www.eventbrite.co.uk/e/1'), 'Eventbrite');
assert.equal(ticketHost('https://resy.com/cities/ny'), 'Resy');
assert.equal(ticketHost(null), null);
assert.equal(detailLine(item({ eventKind: 'tasting', ticketUrl: 'https://www.eventbrite.com/e/1' }), 'en-US'), '7 PM to late · tickets on Eventbrite');
assert.equal(detailLine(item({ eventKind: 'tasting', ticketUrl: 'https://www.eventbrite.com/e/1' }), 'en-US', { tickets: false }), '7 PM to late');
// The guest's colour comes from its own bar's rows, when the week has them; never a bad value.
const coloured = withGuestColors([
  item({ id: 'moth-night', barProfileId: 'moth', barColor: '#2F4A5A' }),
  item({ id: 'takeover', guestProfileId: 'moth' }),
  item({ id: 'other', guestProfileId: 'nobody' }),
  item({ id: 'bad', barProfileId: 'odd', barColor: 'red; x' }),
  item({ id: 'odd-guest', guestProfileId: 'odd' }),
]);
assert.deepEqual(coloured.map((i) => i.guestColor), [null, '#2F4A5A', null, null, null]);

// --- Directions: a maps link from the page's address, no API ---
const place = { display_name: 'Little Rye', address_line: '1 Rye St', locality: null, postcode: 'E1 6AN', city: 'London', latitude: 51.5, longitude: -0.07 };
assert.equal(directionsUrl(place, false), 'https://www.google.com/maps/search/?api=1&query=Little%20Rye%2C%201%20Rye%20St%2C%20E1%206AN%2C%20London');
assert.equal(directionsUrl(place, true), 'https://maps.apple.com/?q=Little%20Rye%2C%201%20Rye%20St%2C%20E1%206AN%2C%20London&ll=51.5,-0.07');
assert.equal(directionsUrl({ ...place, address_line: null, postcode: null, city: null }, false), 'https://www.google.com/maps/search/?api=1&query=51.5,-0.07');
assert.equal(directionsUrl({ ...place, address_line: null, postcode: null, city: null, latitude: null, longitude: null }, false), null);
assert.equal(directionsUrl(null, false), null);
