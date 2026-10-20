// Checks for lib/discover.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { citiesFrom, findCities, findDrinks, foldName, orderDrinks } from './discover';

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

// --- findCities: the city a search names, starts before later words, busiest order kept ---
const places = citiesFrom([
  ...Array(5).fill({ city: 'New York', country_code: 'US' }),
  ...Array(3).fill({ city: 'Melbourne', country_code: 'AU' }),
  { city: 'York', country_code: 'GB' },
  { city: 'Newcastle', country_code: 'AU' },
]);
assert.deepEqual(findCities(places, 'New York').map((c) => c.city), ['New York']);
assert.deepEqual(findCities(places, 'new').map((c) => c.city), ['New York', 'Newcastle']);
assert.deepEqual(findCities(places, 'york').map((c) => c.city), ['York', 'New York']);
assert.deepEqual(findCities(places, 'mélb').map((c) => c.city), ['Melbourne']);
assert.deepEqual(findCities(places, 'n'), []);
assert.deepEqual(findCities(places, 'black pearl'), []);
