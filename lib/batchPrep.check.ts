// Checks for lib/batchPrep.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { batchPrepLines, daysBetween, keepsFor, bottleExpiry, expiryLine } from './batchPrep';
import { specLines } from './spec';

// Shelf lives in words.
assert.equal(keepsFor(14 * 24), 'keeps 14 days');
assert.equal(keepsFor(28 * 24), 'keeps 4 weeks');
assert.equal(keepsFor(24), 'keeps 1 day');
assert.equal(keepsFor(null), null);

// The bottle is used by its shortest-lived line, from today; spirits don't count.
const today = new Date(2026, 9, 8, 12);
const by = bottleExpiry([null, 14 * 24, 30 * 24], today)!;
assert.equal(daysBetween(today, by), 14);
assert.equal(expiryLine(by), 'use by Thu 22 Oct');
assert.equal(bottleExpiry([null, undefined], today), null);

// The prep card holds the bottled lines, scaled to the batch.
const row = (id: string, name: string, amount: number, unit: string) => ({ id: `r-${id}`, amount, unit, display_ingredient_id: id, display_ingredient: { id, name } });
const lines = specLines([row('sc', 'Blended Scotch', 60, 'ml'), row('le', 'Lemon juice', 22.5, 'ml'), row('hg', 'Honey-ginger syrup', 22.5, 'ml')]);
assert.deepEqual(batchPrepLines(lines, ['r-sc', 'r-hg'], 12), [
  { id: 'sc', name: 'Blended Scotch', amount: '720', unit: 'ml' },
  { id: 'hg', name: 'Honey-ginger syrup', amount: '270', unit: 'ml' },
]);
