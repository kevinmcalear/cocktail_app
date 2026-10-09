import assert from 'node:assert/strict';

import { cleanSwaps, placeBeside, swapLine, SWAP_LIMIT, tallyMade } from './madeIt';

// --- beside the bar's: above when better, below when the same or worse ---
const band = [0, 1, 2]; // the bar's entry is index 1
assert.deepEqual(placeBeside(band, 1, 'better'), { index: 1, rankKey: 0.5 });
assert.deepEqual(placeBeside(band, 1, 'same'), { index: 2, rankKey: 1.5 });
assert.deepEqual(placeBeside(band, 1, 'worse'), { index: 2, rankKey: 1.5 });
// At the ends of the band.
assert.deepEqual(placeBeside([5], 0, 'better'), { index: 0, rankKey: 4 });
assert.deepEqual(placeBeside([5], 0, 'worse'), { index: 1, rankKey: 6 });

// --- swaps: both names, trimmed, one per ingredient, capped ---
assert.deepEqual(
  cleanSwaps([
    { from: ' Cynar ', to: ' Amaro Montenegro ' },
    { from: 'Lime', to: '' },
    { from: 'cynar', to: 'Campari' },
    { from: '', to: 'Soda' },
  ]),
  [{ from: 'Cynar', to: 'Amaro Montenegro' }]
);
assert.equal(cleanSwaps([{ from: 'Gin', to: 'x'.repeat(200) }])[0].to.length, 80);
assert.equal(cleanSwaps(Array.from({ length: 20 }, (_, i) => ({ from: `a${i}`, to: 'b' }))).length, SWAP_LIMIT);
assert.equal(swapLine({ from: 'Cynar', to: 'Amaro Montenegro' }), 'Amaro Montenegro for Cynar');

// --- each drink once, counted, latest made first ---
const made = (itemId: string, madeOn: string) => ({ itemId, name: itemId, imageUrl: null, madeOn });
assert.deepEqual(
  tallyMade([made('plane', '2026-10-08'), made('sour', '2026-10-09'), made('plane', '2026-10-01')]).map((t) => [t.itemId, t.times, t.lastOn]),
  [['sour', 1, '2026-10-09'], ['plane', 2, '2026-10-08']]
);
assert.deepEqual(tallyMade([]), []);
