import assert from 'node:assert/strict';

import { byDay, cleanTicketUrl, filterWeek, weekRange, detailLine, dotShape, dotTone, itemDay, kindLabel, newDrinks, shortDay, upcoming, weekDays, weekStart, type WeekItem } from './week';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const item = (over: Partial<WeekItem>): WeekItem => ({
  kind: 'event', id: 'x', barId: 'b', barProfileId: null, barName: 'Little Rye', barColor: null,
  startsAt: new Date(local(2026, 10, 10, 19)).toISOString(), endsAt: null, name: 'x', eventKind: 'takeover',
  isPublic: true, houseMenuOn: true, description: null, ticketUrl: null, guestProfileId: null, guestName: null,
  menuId: null, drinkCount: null, imageUrl: null, glassKey: null, guestCount: null, ...over,
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
assert.equal(kindLabel(item({ eventKind: 'tasting', isPublic: false })), 'Tasting, team only');
assert.equal(kindLabel(item({ eventKind: 'private', isPublic: false })), 'Private event');
assert.equal(kindLabel(item({ kind: 'menu' })), 'Menu goes on');
assert.equal(kindLabel(item({ kind: 'home_menu' })), 'Your home menu');
assert.equal(dotShape(item({ isPublic: false })), 'ring');
assert.equal(dotShape(item({ kind: 'menu' })), 'square');
assert.equal(dotTone(item({ eventKind: 'guest_shift' })), 'guest');
assert.equal(dotTone(item({ eventKind: 'tasting' })), 'tasting');
assert.equal(dotTone(item({ kind: 'drink' })), 'muted');

assert.equal(shortDay('2026-10-10', from), 'Today');
assert.equal(shortDay('2026-10-11', from), 'Tomorrow');
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
assert.equal(weekRange(weekStart(local(2026, 10, 28, 12)), 7, 'en-GB'), 'Wed 28 Oct to Tue 3 Nov');
