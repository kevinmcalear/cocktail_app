import assert from 'node:assert/strict';
import { completions, groupCatalog, groupLabel, moreCount, moreLabel, PER_GROUP, scopeOptions, showOptions, shows, startScope } from './searchScope';
import type { SearchItem } from '@/types/search';

// "All 30" when a tap shows the rest, else a page at a time; nothing once all show.
assert.equal(moreLabel(12, 4), 'All 12');
assert.equal(moreLabel(30, 4), 'All 30');
assert.equal(moreCount(30, 4), 30);
assert.equal(moreLabel(100, 4), 'Show more (96)');
assert.equal(moreCount(100, 4), 29);
assert.equal(moreLabel(100, 54), 'All 100');
assert.equal(moreLabel(4, 4), null);

// The area option only comes from Discover.
assert.deepEqual(scopeOptions('Little Rye', null).map((o) => o.value), ['mine', 'everywhere']);
assert.deepEqual(scopeOptions('Little Rye', 'This area').map((o) => o.label), ['Little Rye', 'This area', 'Everywhere']);

// The search circle starts where you came from.
assert.equal(startScope('library', 'mine', false), 'mine');
assert.equal(startScope('menus', 'mine', true), 'mine');
assert.equal(startScope('discover', 'mine', true), 'area');
assert.equal(startScope('discover', 'mine', false), 'everywhere');
assert.equal(startScope('bar', 'everywhere', false), 'everywhere');
assert.equal(startScope(null, 'mine', false), 'mine');

const items: SearchItem[] = [
  { id: '1', name: 'Plum Negroni', category: 'Cocktail', menuOrder: 2 },
  { id: '2', name: 'Negroni, house spec', category: 'Cocktail', menuOrder: 0 },
  { id: '3', name: 'Campari', category: 'Ingredient' },
  { id: 'menu-4', name: 'Autumn menu', category: 'Menu', description: 'Negroni season' },
  { id: '5', name: 'White Negroni', category: 'Cocktail', fromBar: 'Pale Moth' },
  { id: 'beer-6', name: 'Negroni Sour Ale', category: 'Beer' },
  { id: '7', name: 'Boulevardier', category: 'Cocktail', recipes: [{ ingredient: { name: 'Campari' } }] },
];

// Nothing typed: no matches, so the empty state shows instead.
assert.deepEqual(groupCatalog(items, '  '), { drinks: [], ingredients: [], menus: [] });

// Drinks of every kind, on a menu now first; other bars' drinks stay out.
const g = groupCatalog(items, 'Negroni');
assert.deepEqual(g.drinks.map((i) => i.id), ['2', 'beer-6', '1']);
assert.deepEqual(g.menus.map((i) => i.id), ['menu-4']);
assert.deepEqual(g.ingredients, []);

// An ingredient finds itself and the drinks that use it.
const c = groupCatalog(items, 'campari');
assert.deepEqual(c.ingredients.map((i) => i.id), ['3']);
assert.deepEqual(c.drinks.map((i) => i.id), ['7']);

assert.equal(groupLabel('Drinks', 3), 'Drinks · 3');
assert.equal(groupLabel('Drinks', 0), 'Drinks');

// Groups show three before "All n", as the search boards draw them.
assert.equal(PER_GROUP, 3);
assert.equal(moreLabel(5, PER_GROUP), 'All 5');

// What the typed word could finish as: names that start with it, shortest first, at most two.
assert.deepEqual(completions(['Negroni Sbagliato', 'Negroni', 'Plum Negroni', 'Negroni batch, 1 L'], 'negr'), ['negroni', 'negroni sbagliato']);
assert.deepEqual(completions(['Negroni', 'negroni'], 'NEG'), ['negroni']);
// One letter, or a query that's already a whole name: nothing to finish.
assert.deepEqual(completions(['Negroni'], 'n'), []);
assert.deepEqual(completions(['Negroni Sbagliato', 'Negroni'], 'negroni'), []);
// Accents fold the way the search does.
assert.deepEqual(completions(['Café Brûlot'], 'cafe'), ['cafe brulot']);

// The type chips: All plus each kind found, only when there's a choice.
assert.deepEqual(showOptions({ drinks: 3 }), []);
assert.deepEqual(
  showOptions({ menus: 1, drinks: 4, people: 0, ingredients: 2 }).map((o) => `${o.label}${o.count ?? ''}`),
  ['All', 'Drinks4', 'Ingredients2', 'Menus1']
);
assert.equal(shows(undefined, 'menus'), true);
assert.equal(shows('all', 'menus'), true);
assert.equal(shows('drinks', 'menus'), false);
// Can make keeps the drinks only: bars and people leave until it's off (Q37).
assert.equal(shows('canmake', 'drinks'), true);
assert.equal(shows('canmake', 'bars'), false);
assert.equal(shows('canmake', 'people'), false);
