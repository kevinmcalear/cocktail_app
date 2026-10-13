import assert from 'node:assert/strict';

import { cleanSwaps, placeBeside, swapLine, SWAP_LIMIT, tallyMade, withMade } from './madeIt';

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

// --- shown made drinks in a profile's Had list ---
{
  const home = { itemId: 'negroni', venue: null, atBar: false, imageUrl: 'sketch.png', isSketch: true };
  const bar = { itemId: 'negroni', venue: { id: 'rye' }, atBar: false, imageUrl: 'sketch.png', isSketch: true };
  const shown = [
    { id: 'm2', itemId: 'negroni', imageUrl: 'mine.jpg', isSketch: false, note: 'Less bitter.' },
    { id: 'm1', itemId: 'negroni', imageUrl: null, isSketch: false, note: 'Older.' },
    { id: 'm3', itemId: 'bamboo', imageUrl: null, isSketch: false, note: null },
  ];
  const { drinks, extra } = withMade([bar, home], shown);
  // The bar's one stays as it was; the home one takes the latest make's photo and note.
  assert.equal(drinks[0], bar);
  assert.deepEqual(drinks[1], { ...home, imageUrl: 'mine.jpg', isSketch: false, made: shown[0] });
  // A drink made but not ranked at home is a row of its own, once.
  assert.deepEqual(extra.map((m) => m.id), ['m3']);
  // A make with no photo keeps the drink's own picture.
  assert.equal(withMade([home], [shown[1]]).drinks[0].imageUrl, 'sketch.png');
  assert.deepEqual(withMade([], shown).extra.map((m) => m.id), ['m2', 'm3']);
}
