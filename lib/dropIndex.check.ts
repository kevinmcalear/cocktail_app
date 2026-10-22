import assert from 'node:assert/strict';

import { dropIndex, overIndex } from './dropIndex';

const rows = [60, 80, 60, 100];
assert.equal(dropIndex(0, 10, rows), 0, 'a nudge stays put');
assert.equal(dropIndex(0, 45, rows), 1, 'past half the next row');
assert.equal(dropIndex(0, 140, rows), 2, 'past the next and half the one after');
assert.equal(dropIndex(0, 999, rows), 3, 'never past the end');
assert.equal(dropIndex(3, -35, rows), 2);
assert.equal(dropIndex(3, -999, rows), 0, 'never past the start');
assert.equal(dropIndex(2, -20, rows), 2);

// Held over a row's middle half: that row, to drop it on. Between rows or at home: none.
assert.equal(overIndex(0, 70, rows), 1, 'over the middle of the next row');
assert.equal(overIndex(0, 30, rows), null, 'still between');
assert.equal(overIndex(0, 0, rows), null, 'its own place is never a target');
assert.equal(overIndex(3, -150, rows), 1);
assert.equal(overIndex(1, -70, [60, 80, 0]), 0);
