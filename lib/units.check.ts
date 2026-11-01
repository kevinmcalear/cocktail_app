import assert from 'node:assert/strict';
import { amountText, DEFAULT_UNIT, isKnownUnit, overIce, splitAmount, unitLabel, RECIPE_UNITS } from './units';

assert.equal(DEFAULT_UNIT, 'ml');
assert.ok(RECIPE_UNITS.some((u) => u.value === 'ml'));
assert.ok(RECIPE_UNITS.some((u) => u.value === 'oz'));
assert.ok(RECIPE_UNITS.some((u) => u.value === 'dash'));
assert.equal(RECIPE_UNITS.find((u) => u.value === 'g')?.group, 'weight');
assert.equal(isKnownUnit('kg'), true);
assert.equal(unitLabel('bsp'), 'barspoon');
assert.equal(unitLabel('ml'), 'ml');
assert.equal(unitLabel(null), 'ml');
assert.equal(unitLabel('custom'), 'custom');
assert.equal(isKnownUnit('oz'), true);
assert.equal(isKnownUnit(''), false);
assert.equal(isKnownUnit('furlong'), false);


// A finish is counted, never poured: drops, sprays and a rinse read the way a bartender says them.
for (const u of ['spray', 'rinse', 'float']) assert.equal(RECIPE_UNITS.find((r) => r.value === u)?.group, 'count', `${u} is counted`);
assert.equal(amountText('3', 'drop'), '3 drops');
assert.equal(amountText('1', 'drop'), '1 drop');
assert.equal(amountText('2', 'dash'), '2 dashes');
assert.equal(amountText('1', 'rinse'), 'Rinse');
assert.equal(amountText('2', 'rinse'), '2 rinses');
assert.equal(amountText('1', 'float'), 'Float');
assert.equal(amountText('22.5', 'ml'), '22.5 ml');
assert.equal(amountText('2', 'oz'), '2 oz');
assert.equal(amountText('3', null), '3');

// The unit set smaller: the number and the unit apart; a range or mixed number stays whole.
assert.deepEqual(splitAmount('22.5 ml'), { value: '22.5', unit: 'ml' });
assert.deepEqual(splitAmount('2-3 dashes'), { value: '2-3', unit: 'dashes' });
assert.deepEqual(splitAmount('1 ½ oz'), { value: '1 ½', unit: 'oz' });
assert.deepEqual(splitAmount('Top'), { value: 'Top', unit: '' });
assert.equal(overIce('Large cube'), 'a large cube');
assert.equal(overIce('Crushed'), 'crushed');

console.log('units.check.ts: ok');
