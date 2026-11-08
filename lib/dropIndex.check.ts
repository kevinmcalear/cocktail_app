import assert from 'node:assert/strict';

import { dragSlot, dropIndex, gapShift, slotOffset } from './dropIndex';

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

// Let go, a row eases to its slot: past the rows it passed, down positive (rows 60, 80, 60, 100).
assert.equal(slotOffset(0, 2, rows), 140, 'down past two rows');
assert.equal(slotOffset(3, 1, rows), -140, 'up past two rows');
assert.equal(slotOffset(1, 1, rows), 0, 'its own place');

// A list that only reorders (DragList, edge 1/2): a row slides once the held one's middle passes its own.
// The reviewer's menu: rows about 85 tall, a drag of 175 passes two of them (at 3/4 it needed 191).
const menu = [85, 85, 85, 85];
assert.equal(dragSlot(0, 175, menu, 0, 1 / 2).slot, 2, 'two rows down at 175');
assert.equal(dragSlot(0, 175, menu, 0).slot, 1, 'a spec line still waits for three quarters');
assert.equal(dragSlot(0, 80, menu, 0, 1 / 2).slot, 0, 'not yet past the first middle');
assert.equal(dragSlot(0, 90, menu, 0, 1 / 2).slot, 1, 'past the first middle');
assert.equal(dragSlot(0, 150, menu, 2, 1 / 2).slot, 2, 'a row that slid stays under a still finger');
assert.equal(dragSlot(3, -175, menu, 3, 1 / 2).slot, 1, 'two rows up at 175');
