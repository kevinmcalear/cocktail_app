import assert from 'node:assert/strict';

import type { MenuDates } from './menuEditions';
import { averageScore, barMenuPicks, listMenuPicks, barNews, dateTile, daysAway, initials, nightLong, shelfReady, splitHomeMenus } from './collectionMenus';

const now = new Date(2026, 9, 9, 20, 0).getTime(); // Fri 9 Oct 2026, evening

// --- dated menus are finished: coming up or past; only undated ones are still building ---
const menus = [
  { id: 'a', menuDate: '2026-10-24', createdAt: '2026-10-01' },
  { id: 'b', menuDate: '2026-10-17', createdAt: '2026-10-02' },
  { id: 'c', menuDate: null, createdAt: '2026-10-03' },
  { id: 'd', menuDate: '2026-08-02', createdAt: '2026-07-01' },
  { id: 'e', menuDate: '2026-10-09', createdAt: '2026-10-05' },
  { id: 'f', menuDate: null, createdAt: '2026-10-06' },
  { id: 'g', menuDate: '2026-09-01', createdAt: '2026-08-01' },
];
const split = splitHomeMenus(menus, now);
assert.deepEqual(split.coming.map((m) => m.id), ['e', 'b', 'a']);
assert.deepEqual(split.building.map((m) => m.id), ['f', 'c']);
assert.deepEqual(split.past.map((m) => m.id), ['g', 'd']);

// --- the date tile and how far off ---
assert.deepEqual(dateTile('2026-10-17'), { mon: 'OCT', day: '17' });
assert.deepEqual(dateTile('2026-08-02'), { mon: 'AUG', day: '02' });
assert.equal(daysAway('2026-10-17', now), 'In 8 days');
assert.equal(daysAway('2026-10-09', now), 'Tonight');
assert.equal(daysAway('2026-10-10', now), 'Tomorrow');
assert.equal(daysAway('2026-10-08', now), null);
assert.equal(nightLong('2026-10-17', 'en-GB'), 'Saturday · 17 October');

// --- ready from the shelf, and what to buy ---
const canMake = new Set(['sour', 'highball']);
const away = [
  { bottles: [{ name: 'Cynar' }], drinks: [{ id: 'signal' }] },
  { bottles: [{ name: 'Aperol' }], drinks: [{ id: 'spritz' }] },
];
assert.deepEqual(shelfReady(['sour', 'highball', 'signal', 'sour'], canMake, away), { ready: 2, total: 3, shop: 'Need Cynar' });
assert.deepEqual(shelfReady(['sour', 'signal', 'spritz'], canMake, away), { ready: 1, total: 3, shop: 'Need 2 bottles' });
assert.deepEqual(shelfReady(['martini'], canMake, away), { ready: 0, total: 1, shop: null });

// --- your average at a bar, and its mark ---
assert.equal(averageScore([8.4, 8.9, 8.5]), 8.6);
assert.equal(averageScore([]), null);
assert.equal(initials('Little Rye'), 'LR');
assert.equal(initials('Kinsman'), 'K');
assert.equal(initials('The Ninth Glass'), 'NG');
assert.equal(initials('Dean & Nancy on 22'), 'DN');

// --- a loved bar's news: the newer of its release and its menu ---
const autumn = { name: 'Autumn', dates: { startYear: 2026, startMonth: 9, endYear: null, endMonth: null, isCurrent: true } };
assert.deepEqual(barNews(autumn, null), { text: 'Autumn menu is on', when: 'Sep 2026' });
assert.deepEqual(barNews(autumn, { name: 'Moth Hours', date: '2026-10-15' }), { text: 'New release, Moth Hours', when: '15 Oct' });
assert.deepEqual(barNews(autumn, { name: 'Old one', date: '2026-03-01' }), { text: 'Autumn menu is on', when: 'Sep 2026' });
assert.deepEqual(barNews(null, { name: 'Old one', date: '2026-03-01' }), { text: 'New release, Old one', when: '1 Mar' });
assert.equal(barNews({ ...autumn, dates: { ...autumn.dates, isCurrent: false, endYear: 2026 } }, null), null);

// --- bar menus for you: the menu on now you know best, then the rest, then what changed ---
const on = (y: number, m: number): MenuDates => ({ startYear: y, startMonth: m, endYear: null, endMonth: null, isCurrent: true });
const ed = (id: string, barId: string, barName: string, drinkIds: string[], dates = on(2025, 9)) => ({ id, name: id, barId, barName, drinkIds, dates });
const had = [
  { itemId: 'red-cliff', name: 'Red Cliff', score: 8.9, barId: 'kinsman' },
  { itemId: 'joaquim', name: 'Miss Joaquim', score: 8.3, barId: 'kinsman' },
  { itemId: 'julep', name: 'Kalahari Julep', score: 9.1, barId: 'oriole' },
  { itemId: 'old', name: 'Old Drink', score: 7, barId: 'gone' },
];
const editions = [
  ed('Album', 'oriole', 'Oriole', ['julep', 'acadia'], on(2026, 8)),
  ed('Chinatowns', 'kinsman', 'Kinsman', ['red-cliff', 'joaquim', 'raita']),
  ed('Saved one', 'rye', 'Little Rye', ['x']),
  ed('Archive', 'gone', 'Gone Bar', ['old'], { startYear: 2025, startMonth: 1, endYear: 2026, endMonth: 7, isCurrent: false }),
];
const picks = barMenuPicks(had, editions, new Set(['Saved one']), now);
assert.equal(picks.featured?.edition.id, 'Chinatowns');
assert.deepEqual(picks.featured?.ranked.map((h) => h.name), ['Red Cliff', 'Miss Joaquim']);
assert.deepEqual(picks.rail.map((r) => [r.edition.id, r.reason]), [['Album', 'You had the Kalahari Julep']]);
assert.deepEqual(picks.news.map((n) => n.title), ['Oriole put out a new menu', 'Gone Bar’s last menu went to the archive']);
assert.equal(picks.news[0].sub, 'Album · Aug 2026 · 2 drinks');
assert.equal(picks.news[1].sub, 'You had 1 drink from it · keep them as memories');
assert.deepEqual(barMenuPicks([], editions, new Set(), now), { featured: null, rail: [], news: [] });

// Nothing ranked yet: the 50 Best bars' menus on now, best placed first, saved ones left out.
const places = [
  { barId: 'kinsman', position: 7, award: 'The World’s 50 Best Bars', year: 2026 },
  { barId: 'oriole', position: 2, award: 'The World’s 50 Best Bars', year: 2026 },
  { barId: 'gone', position: 1, award: 'The World’s 50 Best Bars', year: 2026 },
  { barId: 'rye', position: 3, award: 'The World’s 50 Best Bars', year: 2026 },
];
assert.deepEqual(
  listMenuPicks(places, editions, new Set(['Saved one'])).map((p) => [p.edition.id, p.reason]),
  [
    ['Album', 'No. 2, The World’s 50 Best Bars 2026'],
    ['Chinatowns', 'No. 7, The World’s 50 Best Bars 2026'],
  ],
);
