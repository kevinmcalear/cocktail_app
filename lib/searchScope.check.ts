import assert from 'node:assert/strict';
import { groupCatalog, groupLabel, moreCount, moreLabel, scopeOptions } from './searchScope';
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
