import assert from 'node:assert/strict';

import { dropIndex } from './dropIndex';

const rows = [60, 80, 60, 100];
assert.equal(dropIndex(0, 10, rows), 0, 'a nudge stays put');
assert.equal(dropIndex(0, 45, rows), 1, 'past half the next row');
assert.equal(dropIndex(0, 140, rows), 2, 'past the next and half the one after');
assert.equal(dropIndex(0, 999, rows), 3, 'never past the end');
assert.equal(dropIndex(3, -35, rows), 2);
assert.equal(dropIndex(3, -999, rows), 0, 'never past the start');
assert.equal(dropIndex(2, -20, rows), 2);
