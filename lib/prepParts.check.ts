// Checks for lib/prepParts.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { partsLabel, partsRatio, poursPerBatch, prepParts, sizeOptions } from './prepParts';

const line = (amount: number | string | null, unit: string | null) => ({ id: `${amount}${unit}`, name: 'x', amount, unit });

assert.equal(partsLabel(1), '1 part');
assert.equal(partsLabel(2), '2 parts');
assert.equal(partsLabel(0.5), '½ part');
assert.equal(partsLabel(1.5), '1½ parts');

// Rich syrup: 1000 g sugar, 500 ml water reads 2 : 1 (water counted by weight).
const rich = prepParts([line(1000, 'g'), line('500', 'ml')]);
assert.deepEqual(rich, ['2 parts', '1 part']);
assert.equal(partsRatio(rich), '2 : 1');

// A shrub with a counted chili keeps the count.
assert.deepEqual(prepParts([line(300, 'g'), line(300, 'g'), line(300, 'g'), line(2, null)]), ['1 part', '1 part', '1 part', '2']);
assert.equal(partsRatio(['1 part', '1 part', '1 part', '2']), '1 : 1 : 1');

// Small, uneven amounts don't read as parts.
assert.equal(prepParts([line(25, 'g'), line(500, 'g'), line(100, 'g'), line(15, 'ml')]), null, '20 : 1.7 : 6.7 : 1 is not a parts recipe');
assert.equal(prepParts([line(1000, 'g')]), null, 'one measured line has nothing to compare');
assert.equal(prepParts([line(100, 'g'), line(1, 'g')]), null, 'over 12 parts reads as amounts');
assert.equal(partsRatio(null), null);

// Sizes: the bottles show when the yield is a volume, minus the batch itself.
const sizes = sizeOptions(1130, 'ml');
assert.deepEqual(sizes.map((s) => s.key), ['batch', 'half', 'double', 'ml500', 'ml750', 'ml1000']);
assert.ok(Math.abs(sizes.find((s) => s.key === 'ml750')!.factor - 750 / 1130) < 1e-9);
assert.deepEqual(sizeOptions(750, 'ml').map((s) => s.key), ['batch', 'half', 'double', 'ml500', 'ml1000']);
assert.deepEqual(sizeOptions(null, null).map((s) => s.key), ['batch', 'half', 'double']);
assert.deepEqual(sizeOptions(2, 'kg').map((s) => s.key), ['batch', 'half', 'double'], 'a weighed yield has no bottles');

// Pours: the most common volume decides.
assert.equal(poursPerBatch(1130, 'ml', [line(0.5, 'oz'), line(15, 'ml'), line(10, 'ml'), line(1, 'tsp')]), 'One batch pours about 75 drinks at 15 ml.');
assert.equal(poursPerBatch(1130, 'ml', []), null);
assert.equal(poursPerBatch(null, null, [line(15, 'ml')]), null);

console.log('prepParts checks passed');
