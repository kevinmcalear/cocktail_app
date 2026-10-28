// Checks for lib/houseMade.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { leadLine, servesPerBatch, volumeMl } from './houseMade';

// A 620 ml batch at 20 ml a drink makes about 31.
assert.equal(servesPerBatch(620, 'ml', 20), 31);
assert.equal(servesPerBatch(1.2, 'L', 22.5), 53);
assert.equal(servesPerBatch(null, 'ml', 20), null);
assert.equal(volumeMl(2, 'oz')! > 59, true);

// Lead time in words.
assert.equal(leadLine(3 * 24 * 60), 'Start 3 days before you need it.');
assert.equal(leadLine(120), 'Start 2 hours before you need it.');
assert.equal(leadLine(null), null);
