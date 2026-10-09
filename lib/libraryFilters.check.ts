import assert from 'node:assert/strict';

import type { MenuSummary } from '@/types/menus';

import { isGarnishLine, itemIdOf, menuDrinks, menuState, parseShow, venueShelves } from './libraryFilters';

assert.equal(parseShow(undefined, true), 'all');
assert.equal(parseShow('staff', true), 'staff');
assert.equal(parseShow(['past', 'all'], true), 'past');
assert.equal(parseShow('nonsense', true), 'all');
assert.equal(parseShow('staff', false), 'cocktails');
assert.equal(parseShow(undefined, false), 'cocktails');
assert.equal(parseShow('wine', false), 'wine');
assert.equal(parseShow('preps', true), 'preps');
assert.equal(parseShow('ingredients', true), 'bottles');
assert.equal(parseShow('garnishes', false), 'ingredients');
assert.equal(parseShow('batched', false), 'cocktails');

assert.ok(isGarnishLine('garnish, discarded', null) && isGarnishLine(null, 'Twist') && !isGarnishLine('not in batch', 'ml'));
{
  const drinks = [
    { recipes: [{ display_ingredient_id: 'gin', unit: 'ml' }, { display_ingredient_id: 'cordial', unit: 'ml' }, { display_ingredient_id: 'coin', preparation_notes: 'garnish' }] },
    { recipes: [{ display_ingredient_id: 'lemon', preparation_notes: 'garnish' }, { display_ingredient_id: 'lemon', unit: 'ml' }] },
  ];
  const shelves = venueShelves('bar', drinks, [
    { id: 'gin', bar_id: null, ingredient_role: 'product' },
    { id: 'cordial', bar_id: 'bar', ingredient_role: 'prep' },
    { id: 'coin', bar_id: 'bar', ingredient_role: 'prep' },
    { id: 'lemon', bar_id: null, ingredient_role: 'generic' },
    { id: 'unused', bar_id: null, ingredient_role: 'product' },
    { id: 'spare', bar_id: 'bar', ingredient_role: null },
    { id: 'other', bar_id: 'elsewhere', ingredient_role: 'prep' },
  ]);
  // A garnish that's also poured in a spec is a bottle; a shared one nobody uses is on no shelf.
  assert.deepEqual(shelves, { preps: ['cordial'], garnishes: ['coin'], bottles: ['gin', 'lemon', 'spare'] });
}

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
  pictures: [],
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
assert.deepEqual(menuDrinks([], now, null), { onMenus: [], on: [], onNow: [], past: [] });
// Picking a menu narrows the list, not what counts as on now.
assert.deepEqual(menuDrinks(menus, now, 'autumn').onNow.sort(), ['martini', 'negroni', 'spritz']);

const onNow = new Set(all.onNow);
const past = new Set(all.past);
assert.equal(menuState('spritz', onNow, past), 'On menu');
assert.equal(menuState('paloma', onNow, past), 'Past');
assert.equal(menuState('secret', onNow, past), 'Off menu');

assert.equal(itemIdOf('beer-0000-1'), '0000-1');
assert.equal(itemIdOf('wine-0000-2'), '0000-2');
assert.equal(itemIdOf('0000-3'), '0000-3');
