import assert from 'node:assert/strict';
import { DEFAULT_UNIT, isKnownUnit, unitLabel, RECIPE_UNITS } from './units';

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

console.log('units.check.ts: ok');
