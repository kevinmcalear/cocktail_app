import assert from 'node:assert/strict';

import type { MenuSummary } from '@/types/menus';

import { menuDrinks, parseShow } from './libraryFilters';

assert.equal(parseShow(undefined, true), 'all');
assert.equal(parseShow('staff', true), 'staff');
assert.equal(parseShow(['past', 'all'], true), 'past');
assert.equal(parseShow('nonsense', true), 'all');
assert.equal(parseShow('staff', false), 'cocktails');
assert.equal(parseShow(undefined, false), 'cocktails');
assert.equal(parseShow('wine', false), 'wine');

const now = Date.parse('2026-10-07T12:00:00Z');
const menu = (id: string, startsAt: string | null, endsAt: string | null, itemIds: string[]): MenuSummary => ({
  id,
  name: id,
  barId: 'bar',
  createdBy: null,
  coverUrl: null,
  coverPosition: 50,
  startsAt,
  endsAt,
  createdAt: '2026-01-01T00:00:00Z',
  menuDate: null,
  guestCount: null,
  sharedAt: null,
  itemIds,
  event: null,
});

const menus = [
  menu('autumn', '2026-09-01T00:00:00Z', null, ['martini', 'negroni', 'martini']),
  menu('bar-snacks', '2026-10-01T00:00:00Z', null, ['spritz']),
  menu('summer', '2026-06-01T00:00:00Z', '2026-08-31T00:00:00Z', ['spritz', 'paloma', 'daiquiri']),
  menu('draft', null, null, ['secret']),
  menu('winter', '2026-12-01T00:00:00Z', null, ['toddy']),
];

const all = menuDrinks(menus, now, null);
assert.deepEqual(all.onMenus.map((m) => m.id), ['bar-snacks', 'autumn']);
assert.deepEqual(all.on.sort(), ['martini', 'negroni', 'spritz']);
// Spritz is on now, so it isn't past; drafts and upcoming menus aren't either.
assert.deepEqual(all.past.sort(), ['daiquiri', 'paloma']);

assert.deepEqual(menuDrinks(menus, now, 'autumn').on, ['martini', 'negroni']);
assert.deepEqual(menuDrinks(menus, now, 'summer').on.sort(), ['martini', 'negroni', 'spritz'], 'a menu that isn’t on is no pick');
assert.deepEqual(menuDrinks([], now, null), { onMenus: [], on: [], past: [] });
