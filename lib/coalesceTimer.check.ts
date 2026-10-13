import assert from 'node:assert/strict';

import { coalesceTimer } from './coalesceTimer';

// A fake timer: callbacks wait until we fire them.
const timers: (() => void)[] = [];
const schedule = coalesceTimer((run) => timers.push(run));
const ran: number[] = [];

// Sixty results in one tick share one timer, and run in order.
for (let n = 1; n <= 60; n++) schedule(() => ran.push(n));
assert.equal(timers.length, 1, 'one timer for everything asked before it fires');
timers.shift()!();
assert.deepEqual(ran, Array.from({ length: 60 }, (_, i) => i + 1));

// Asked while the timer runs: a fresh timer, not lost and not run early.
schedule(() => {
  ran.push(61);
  schedule(() => ran.push(62));
});
timers.shift()!();
assert.equal(ran.at(-1), 61);
assert.equal(timers.length, 1);
timers.shift()!();
assert.equal(ran.at(-1), 62);
assert.equal(timers.length, 0, 'nothing left scheduled');
