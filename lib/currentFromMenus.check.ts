import assert from 'node:assert/strict';
import {
  currentCocktailsFromDrinks,
  currentForLabel,
  currentMenus,
  isCurrentMenu,
} from './currentFromMenus';

assert.equal(isCurrentMenu({ is_active: true }), true);
assert.equal(isCurrentMenu({ is_active: false }), false);
assert.equal(isCurrentMenu({ is_active: null }), false);

const menus = [
  { id: '1', name: 'A', is_active: true, bar_id: null },
  { id: '2', name: 'B', is_active: false, bar_id: 'bar' },
  { id: '3', name: 'C', is_active: true, bar_id: 'bar' },
];
assert.deepEqual(
  currentMenus(menus).map((m) => m.id),
  ['1', '3']
);

const drinks = [
  { menu_id: '1', item: { id: 'c1', name: 'Martini', item_type: 'cocktail' } },
  { menu_id: '1', item: { id: 'c1', name: 'Martini', item_type: 'cocktail' } },
  { menu_id: '2', item: { id: 'c2', name: 'Old Fashioned', item_type: 'cocktail' } },
  { menu_id: '3', item: { id: 'b1', name: 'Lager', item_type: 'beer' } },
  { menu_id: '3', item: { id: 'c3', name: 'Negroni', item_type: 'cocktail' } },
  { menu_id: '3', item: null },
];
assert.deepEqual(currentCocktailsFromDrinks(drinks, ['1', '3']), [
  { id: 'c1', name: 'Martini', menu_id: '1' },
  { id: 'c3', name: 'Negroni', menu_id: '3' },
]);

assert.equal(currentForLabel(null), 'Personal');
assert.equal(currentForLabel('x', 'Cottage'), 'Cottage');
assert.equal(currentForLabel('x'), 'Venue');

console.log('currentFromMenus.check: ok');
