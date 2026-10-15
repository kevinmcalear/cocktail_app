// Checks for lib/specPad.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { pressKey, quickAmounts, settleAmount } from './specPad';

const type = (keys: string[], from = '') => keys.reduce(pressKey, from);

assert.equal(type(['2', '2', '.', '5']), '22.5');
// One point, two places after it, and a leading zero gives way.
assert.equal(type(['.', '7', '5']), '0.75');
assert.equal(type(['1', '.', '.', '2', '5', '9']), '1.25');
assert.equal(type(['0', '3']), '3');
assert.equal(type(['⌫'], '22.5'), '22.');
assert.equal(type(['⌫', '⌫', '⌫', '⌫', '⌫'], '22.5'), '');
// Anything else on the pad is ignored, and five digits is plenty.
assert.equal(type(['x', '1', '2', '3', '4', '5', '6']), '12345');

// Jiggers for ml, quarter ounces shown as fractions, nothing for "top".
assert.deepEqual(quickAmounts('ml').map((q) => q.label), ['7.5', '15', '22.5', '30', '45', '60']);
assert.deepEqual(quickAmounts('oz').map((q) => q.label), ['¼', '½', '¾', '1', '1½', '2']);
assert.equal(quickAmounts('oz')[2].value, '0.75');
assert.deepEqual(quickAmounts('top'), []);

assert.equal(settleAmount('22.'), '22');
assert.equal(settleAmount('0.'), '');
assert.equal(settleAmount('0.75'), '0.75');
