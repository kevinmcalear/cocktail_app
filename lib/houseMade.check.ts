// Checks for lib/houseMade.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { inParts, leadLine, servesPerBatch, volumeMl } from './houseMade';

// The board's shrub: equal parts of three, and two chilies as they are.
assert.deepEqual(
  inParts([
    { name: 'Pineapple', amount: 500, unit: 'g' },
    { name: 'White sugar', amount: 500, unit: 'g' },
    { name: 'Apple cider vinegar', amount: 500, unit: 'ml' },
    { name: 'Fresno chilies', amount: 2, unit: 'each' },
  ]).map((p) => `${p.label} ${p.name}`),
  ['1 part Pineapple', '1 part White sugar', '1 part Apple cider vinegar', '2 Fresno chilies']
);
// A 2:1 syrup.
assert.deepEqual(inParts([{ name: 'Honey', amount: 200, unit: 'ml' }, { name: 'Water', amount: 100, unit: 'ml' }]).map((p) => p.label), ['2 parts', '1 part']);

// A 620 ml batch at 20 ml a drink makes about 31.
assert.equal(servesPerBatch(620, 'ml', 20), 31);
assert.equal(servesPerBatch(1.2, 'L', 22.5), 53);
assert.equal(servesPerBatch(null, 'ml', 20), null);
assert.equal(volumeMl(2, 'oz')! > 59, true);

// Lead time in words.
assert.equal(leadLine(3 * 24 * 60), 'Start 3 days before you need it.');
assert.equal(leadLine(120), 'Start 2 hours before you need it.');
assert.equal(leadLine(null), null);
