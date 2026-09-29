// Checks for lib/discover.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { citiesFrom, findDrinks, foldName, orderDrinks } from './discover';

const names = (xs: { name: string }[]) => xs.map((x) => x.name);

// --- foldName ---
assert.equal(foldName('  Café   Brûlot '), 'cafe brulot');

// --- orderDrinks: best-known first, then A to Z, case-insensitive ---
assert.deepEqual(
  names(orderDrinks([{ name: 'Zombie' }, { name: 'negroni' }, { name: 'Aviation' }, { name: 'Martini' }])),
  ['Martini', 'negroni', 'Aviation', 'Zombie']
);

// --- findDrinks: prefix matches first, accents ignored, blank keeps all ---
const drinks = [{ name: 'Espresso Martini' }, { name: 'Martini' }, { name: 'Martinez' }, { name: 'Negroni' }];
assert.deepEqual(names(findDrinks(drinks, 'mart')), ['Martini', 'Martinez', 'Espresso Martini']);
assert.deepEqual(names(findDrinks([{ name: 'Café Brûlot' }], 'cafe')), ['Café Brûlot']);
assert.deepEqual(names(findDrinks(drinks, '  ')), names(drinks));
assert.deepEqual(findDrinks(drinks, 'zzz'), []);

// --- citiesFrom: merged by folded name and country, busiest first, labels only disambiguate when needed ---
const cities = citiesFrom([
  { city: 'New York', country_code: 'US' },
  { city: 'new york ', country_code: 'US' },
  { city: 'Melbourne', country_code: 'AU' },
  { city: 'Melbourne', country_code: 'US' },
  { city: null, country_code: 'US' },
  { city: 'Paris', country_code: null },
]);
assert.deepEqual(
  cities.map((c) => [c.label, c.bars]),
  [
    ['New York', 2],
    ['Melbourne, AU', 1],
    ['Melbourne, US', 1],
  ]
);

console.log('discover: ok');
