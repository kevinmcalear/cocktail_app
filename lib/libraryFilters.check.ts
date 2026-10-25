import assert from 'node:assert/strict';

import type { MenuSummary } from '@/types/menus';

import { filterGroups, splitFilters, methodWord, isGarnishLine, itemIdOf, menuDrinks, menuState, parseShow, prepGroup, tileLine, venueShelves, yieldText } from './libraryFilters';

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
// A venue without More library filters: the extras fall back to All; the rest stay.
assert.equal(parseShow('bottles', true, false), 'all');
assert.equal(parseShow('rnd', true, false), 'all');
assert.equal(parseShow('ingredients', true, false), 'all');
assert.equal(parseShow('staff', true, false), 'staff');
assert.equal(parseShow('wine', true, false), 'wine');
assert.equal(parseShow('wine', false, false), 'wine', 'extras only apply at a venue');

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
  kind: 'menu',
  sharedAt: null,
  updatedAt: '2026-01-01T00:00:00Z',
  description: null,
  plannedStartsAt: null,
  plannedEndsAt: null,
  itemIds,
  shortSections: 0,
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
assert.deepEqual(menuDrinks([], now, null), { onMenus: [], on: [], onNow: [], past: [], rndMenus: [], rnd: [] });
{
  // R&D: a flight's drinks that aren't on any menu; picking the flight shows all of it.
  const flight = { ...menu('flight', null, null, ['control', 'tea martini', 'negroni']), kind: 'rnd' as const };
  const withFlight = menuDrinks([...menus, flight], now, null);
  assert.deepEqual(withFlight.rnd, ['control', 'tea martini']);
  assert.deepEqual(menuDrinks([...menus, flight], now, 'flight').rnd, ['control', 'tea martini', 'negroni']);
  assert.deepEqual(withFlight.on.sort(), all.on.sort(), 'R&D is never on');
}
assert.equal(parseShow('rnd', false), 'cocktails');
// Picking a menu narrows the list, not what counts as on now.
assert.deepEqual(menuDrinks(menus, now, 'autumn').onNow.sort(), ['martini', 'negroni', 'spritz']);

const onNow = new Set(all.onNow);
const past = new Set(all.past);
assert.equal(menuState('spritz', onNow, past), 'On menu');
assert.equal(menuState('paloma', onNow, past), 'Old drink');
assert.equal(menuState('secret', onNow, past), 'Off menu');

assert.equal(itemIdOf('beer-0000-1'), '0000-1');
assert.equal(itemIdOf('wine-0000-2'), '0000-2');
assert.equal(itemIdOf('0000-3'), '0000-3');

{
  assert.deepEqual(filterGroups(true, false).map((g) => g.map((f) => f.label)), [
    ['All', 'On menu', 'Classics', 'Old drinks', 'R&D'],
    ['Batched', 'Made in-house', 'Garnishes', 'Bottles'],
    ['Ready here', 'Needs something'],
    ['Cocktails', 'Beer', 'Wine'],
  ]);
  assert.deepEqual(filterGroups(false, true).map((g) => g.map((f) => f.label)), [['Cocktails', 'Ingredients', 'Beer', 'Wine', 'Needs a price']]);
  // Without the extras: All, On menu, Classics, Old drinks, Beer, Wine (phone order since 24 Oct), and the kit check (Kit and ice, step 11) at every venue.
  assert.deepEqual(filterGroups(true, true, false).map((g) => g.map((f) => f.label)), [['All', 'On menu', 'Classics', 'Old drinks'], ['Ready here', 'Needs something'], ['Beer', 'Wine']]);
  assert.equal(parseShow('needs', false), 'cocktails', 'no venue, no kit');
  assert.equal(parseShow('ready', true, false), 'ready');
  assert.deepEqual(filterGroups(false, true, false), filterGroups(false, true), 'no venue: extras do not apply');
  assert.equal(tileLine('Stirred', 'Coupe'), 'Stirred · Coupe');
  assert.equal(tileLine('Stirred', null, 'Martini flight'), 'Stirred · Martini flight');
  assert.equal(tileLine(null, ''), null);
  assert.equal(prepGroup('Smoked Pear Shrub', ['Infuse']), 'Shrub');
  assert.equal(prepGroup('Fig Leaf Cordial'), 'Cordial');
  assert.equal(prepGroup('Clarified Lime'), 'Clarified');
  assert.equal(prepGroup('Lime', ['Clarify']), 'Clarified');
  assert.equal(prepGroup('Brown-Butter Rye'), 'Fat-washed');
  assert.equal(prepGroup('Rye', ['Fat wash']), 'Fat-washed');
  assert.equal(prepGroup('Black Walnut Tincture'), 'Infusion');
  assert.equal(prepGroup('Burnt Honey Syrup'), 'Syrup');
  assert.equal(prepGroup('Saline'), null);
  assert.equal(yieldText(1000, 'ml'), '1 L');
  assert.equal(yieldText(750, 'ml'), '750 ml');
  assert.equal(yieldText(1500, 'g'), '1.5 kg');
  assert.equal(yieldText(null, 'ml'), null);
}

assert.equal(methodWord('Stir'), 'Stirred');
assert.equal(methodWord('Shake'), 'Shaken');
assert.equal(methodWord('Build'), 'Built');
assert.equal(methodWord('Freezer pour'), 'Freezer pour');
assert.equal(methodWord(null), null);

// A phone's chip row: four out front, the rest in the filter menu by section.
{
  const split = splitFilters(filterGroups(true, true, true));
  assert.deepEqual(split.front.map((f) => f.label), ['All', 'On menu', 'Classics', 'Made in-house']);
  assert.deepEqual(split.more.map((s) => [s.title, s.filters.map((f) => f.label)]), [
    ['Drinks', ['Old drinks', 'R&D', 'Batched']],
    ['Shelves', ['Garnishes', 'Bottles']],
    ['Kind', ['Cocktails', 'Beer', 'Wine']],
    ['Costs', ['Needs a price']],
    ['Kit', ['Ready here', 'Needs something']],
  ]);
  // Every filter lands somewhere, once.
  const every = filterGroups(true, true, true).flat().map((f) => f.value).sort();
  assert.deepEqual([...split.front, ...split.more.flatMap((s) => s.filters)].map((f) => f.value).sort(), every);
  // Without the extras there are no preps: three out front.
  assert.deepEqual(splitFilters(filterGroups(true, false, false)).front.map((f) => f.label), ['All', 'On menu', 'Classics']);
  // Without a venue, each type stays out front and there's no menu.
  const solo = splitFilters(filterGroups(false, false));
  assert.deepEqual(solo.front.map((f) => f.label), ['Cocktails', 'Ingredients', 'Beer', 'Wine']);
  assert.equal(solo.more.length, 0);
}
