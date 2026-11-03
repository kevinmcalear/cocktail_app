import assert from 'node:assert/strict';

import { useRankReturn } from './useRankReturn';

const s = () => useRankReturn.getState();

// Cancelled at Bring in: back with the typed search, nothing saved.
s().begin('negro');
assert.equal(s().take(), null, 'not back while Bring in is open');
s().back();
assert.deepEqual(s().take(), { phase: 'back', query: 'negro', menuId: null });
assert.equal(s().ret, null, 'taken once');

// Saved: Brought in offers the way back with the menu; leaving another way drops it.
s().begin('negro');
s().saved('m1');
assert.equal(s().take(), null);
s().drop();
assert.equal(s().ret, null);
s().begin('negro');
s().saved('m1');
s().back();
assert.equal(s().take(), null, 'back is for a bring-in that saved nothing');
s().resume();
assert.deepEqual(s().take(), { phase: 'back', query: 'negro', menuId: 'm1' });

// A bring-in Rank it didn't start leaves nothing behind.
s().saved('m2');
s().resume();
s().back();
assert.equal(s().take(), null);
// Dropping while still away keeps it (reading goes on in the background).
s().begin('x');
s().drop();
assert.equal(s().ret?.phase, 'away');
