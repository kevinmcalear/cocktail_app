import assert from 'node:assert/strict';

import { dragSlot, dropIndex, gapShift } from './dropIndex';

const rows = [60, 80, 60, 100];
assert.equal(dropIndex(0, 10, rows), 0, 'a nudge stays put');
assert.equal(dropIndex(0, 45, rows), 1, 'past half the next row');
assert.equal(dropIndex(0, 140, rows), 2, 'past the next and half the one after');
assert.equal(dropIndex(0, 999, rows), 3, 'never past the end');
assert.equal(dropIndex(3, -35, rows), 2);
assert.equal(dropIndex(3, -999, rows), 0, 'never past the start');
assert.equal(dropIndex(2, -20, rows), 2);

// Held with the rows making room (rows at 0, 60, 140, 200). A row's middle half drops on it; past three quarters it slides over the gap.
assert.deepEqual(dragSlot(1, -60, rows, 1), { slot: 1, over: 0 }, 'right over the row above');
assert.deepEqual(dragSlot(1, -40, rows, 1), { slot: 1, over: null }, 'between rows, still moving');
assert.deepEqual(dragSlot(0, 70, rows, 0), { slot: 0, over: 1 });
assert.deepEqual(dragSlot(0, 5, rows, 0), { slot: 0, over: null }, 'over its own place');
assert.deepEqual(dragSlot(0, 95, rows, 0), { slot: 1, over: null }, 'past three quarters: the row slides up, the card is over its gap');
assert.deepEqual(dragSlot(0, 999, rows, 0), { slot: 3, over: null }, 'never past the end');
assert.deepEqual(dragSlot(3, -130, rows, 3), { slot: 2, over: 1 }, 'up past a row, onto the next one');
assert.deepEqual(dragSlot(3, -999, rows, 3), { slot: 0, over: null }, 'never past the start');
// A row that has slid stays put under a still finger: the same move from the slot it made.
assert.equal(dragSlot(0, 95, rows, 1).slot, 1);
assert.equal(dragSlot(0, 70, rows, 1).slot, 1, 'still over the gap it made');
assert.equal(dragSlot(0, -15, rows, 1).slot, 0, 'back up past its top quarter slides it back');

// The rows between its place and its gap slide by its height; the rest stay.
assert.deepEqual([0, 1, 2, 3].map((i) => gapShift(i, 0, 2, 60)), [0, -60, -60, 0]);
assert.deepEqual([0, 1, 2, 3].map((i) => gapShift(i, 3, 1, 100)), [0, 100, 100, 0]);
assert.deepEqual([0, 1, 2, 3].map((i) => gapShift(i, 1, 1, 80)), [0, 0, 0, 0], 'still in its own place');
