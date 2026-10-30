// Checks for lib/bottles.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { bottlesFor, bottlesText, DEFAULT_BOTTLE_ML } from './bottles';

assert.equal(DEFAULT_BOTTLE_ML, 700);
// Eddie's example: 2.3 L of gin is 4 bottles of 700 ml.
assert.deepEqual(bottlesFor(2300), { count: 4, bottleMl: 700, assumed: true });
assert.equal(bottlesText(bottlesFor(2300)!), 'buy 4 × 700 ml (700 ml assumed)');
// The bottle's own size when it's known.
assert.deepEqual(bottlesFor(2300, 1000), { count: 3, bottleMl: 1000, assumed: false });
assert.equal(bottlesText(bottlesFor(2300, 1000)!), 'buy 3 × 1 L');
assert.equal(bottlesText(bottlesFor(2300, 750)!), 'buy 4 × 750 ml');
// Exactly full bottles don't round up past a float slip (1.1 × 1,400 ml is 1,540.0000000000002).
assert.equal(bottlesFor(1400, 700)!.count, 2);
assert.equal(bottlesFor(700 * 1.1 * 10 / 1.1, 700)!.count, 10);
assert.equal(bottlesFor(701, 700)!.count, 2);
assert.equal(bottlesFor(1, 700)!.count, 1);
// Nothing to buy, or a size that makes no sense.
assert.equal(bottlesFor(0), null);
assert.equal(bottlesFor(-5), null);
assert.equal(bottlesFor(Number.NaN), null);
assert.equal(bottlesFor(500, 0)!.assumed, true);
assert.equal(bottlesFor(500, null)!.bottleMl, 700);

console.log('bottles checks passed');
