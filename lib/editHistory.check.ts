// Checks for lib/editHistory.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { record, redo, startHistory, undo } from './editHistory';

// A burst folds into one step; a new step keeps what came before.
let h = startHistory('Penicillin');
h = record(h, 'Penicillin!', true);
h = record(h, 'Penicillin!!', false);
assert.deepEqual(h.past, ['Penicillin']);
assert.equal(h.present, 'Penicillin!!');

// Undo goes back a step, redo forward; nothing to undo leaves it as it is.
h = undo(h);
assert.equal(h.present, 'Penicillin');
assert.deepEqual(h.future, ['Penicillin!!']);
assert.equal(undo(h), h);
h = redo(h);
assert.equal(h.present, 'Penicillin!!');
assert.equal(redo(h), h);

// A change after an undo forgets what was undone.
h = undo(h);
h = record(h, 'Gold Rush', true);
assert.deepEqual(h.future, []);
assert.deepEqual(h.past, ['Penicillin']);

// Fifty steps back at most.
let long = startHistory(0);
for (let i = 1; i <= 60; i++) long = record(long, i, true);
assert.equal(long.past.length, 50);
assert.equal(long.past[0], 10);
