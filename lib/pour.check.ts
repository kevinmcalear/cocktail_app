// Checks for lib/pour.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { money, onHandWords, pourFacts, pourRows, servedWords, strengthLine, usedInWords } from './pour';

assert.equal(money('9'), '$9');
assert.equal(money('$16.50'), '$16.50');
assert.equal(money('MP'), 'MP');
assert.equal(money('  '), null);

assert.equal(strengthLine(4.8), '4.8%');
assert.equal(strengthLine(null, [{ abv: 40 }, { abv: 46 }, { abv: null }]), 'Usually 40 to 46%');
assert.equal(strengthLine(null, [{ abv: 43 }, { abv: 43 }]), 'Usually 43%');
assert.equal(strengthLine(null, []), null);

assert.equal(servedWords(3), 'Very cold');
assert.equal(servedWords(16), 'Cool');
assert.equal(servedWords(null), null);

// The boards' pilsner and nebbiolo.
const pilsner = { abv: 4.8, serve_ml: 400, price: '9', serve_temp_c: 3, glass_note: 'rinsed cold', pour_note: 'two fingers of head', tap_line: 'Line 2' };
assert.deepEqual(pourFacts('beer', pilsner, 'Pilsner'), [
  { label: 'Strength', value: '4.8%' },
  { label: 'Pour', value: '400 ml · $9' },
  { label: 'Served', value: 'Very cold, pilsner glass' },
]);
assert.deepEqual(pourRows('beer', pilsner, 'Pilsner'), [
  { label: 'Glass', value: 'Pilsner, rinsed cold' },
  { label: 'Pour', value: '400 ml, two fingers of head' },
  { label: 'On tap', value: 'Line 2' },
]);
const nebbiolo = { abv: 14, serve_ml: 150, price: '16', bottle_price: '64', serve_temp_c: 16 };
assert.deepEqual(pourFacts('wine', nebbiolo, 'Burgundy'), [
  { label: 'Strength', value: '14%' },
  { label: 'Glass', value: '150 ml · $16' },
  { label: 'Bottle', value: '$64' },
]);
assert.deepEqual(pourRows('wine', { ...nebbiolo, tap_line: 'Line 9' }, 'Burgundy'), [
  { label: 'Glass', value: 'Burgundy' },
  { label: 'Pour', value: '150 ml, served at 16°C' },
]);

// Notes typed with a capital read in lower case after a comma.
assert.deepEqual(pourRows('beer', { ...pilsner, glass_note: 'Rinsed cold', pour_note: 'Two fingers of head' }, 'Pilsner').slice(0, 2), [
  { label: 'Glass', value: 'Pilsner, rinsed cold' },
  { label: 'Pour', value: '400 ml, two fingers of head' },
]);

// A glass that already says what it is, and nothing known: no empty rows.
assert.deepEqual(pourFacts('beer', { abv: null, serve_ml: null, price: null }, 'Beer mug'), [{ label: 'Served', value: 'Beer mug' }]);
assert.deepEqual(pourRows('beer', { abv: null, serve_ml: null, price: null }, null), []);

// A bottle's Used in and At the bar rows.
assert.equal(usedInWords({ amount: 0.25, unit: 'oz', float: true }), 'Float, 7.5 ml');
assert.equal(usedInWords({ amount: 0.5, unit: 'oz' }), '15 ml');
assert.equal(usedInWords({ amount: 60, unit: 'ml' }), '60 ml');
assert.equal(usedInWords({ amount: null, unit: null }), '');
assert.equal(usedInWords({ amount: 1, unit: 'twist' }, true), 'Garnish');
assert.equal(onHandWords({ kind: 'count', value: 2, unit: 'btl' }), '2 on hand');
assert.equal(onHandWords({ kind: 'count', value: 1.4, unit: 'btl' }), '1.4 on hand');
assert.equal(onHandWords({ kind: 'ml', value: 700, unit: 'ml' }), '700 ml on hand');
assert.equal(onHandWords({ kind: 'count', value: 0, unit: 'btl' }), 'None on hand');
assert.equal(onHandWords(undefined), 'Not counted');

console.log('pour checks pass');
