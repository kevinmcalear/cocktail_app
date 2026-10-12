import assert from 'node:assert/strict';

import { IDLE, secondsLeft, toggleClock } from './stepTimerClock';

assert.equal(secondsLeft(IDLE, 600, 0), 600);
const running = toggleClock(IDLE, 600, 0);
assert.deepEqual(running, { state: 'running', endsAt: 600_000 });
assert.equal(secondsLeft(running, 600, 100_000), 500);
// Pause holds what's left, Resume counts down from it.
const paused = toggleClock(running, 600, 100_000);
assert.deepEqual(paused, { state: 'paused', left: 500 });
assert.equal(secondsLeft(paused, 600, 999_999), 500);
assert.deepEqual(toggleClock(paused, 600, 200_000), { state: 'running', endsAt: 700_000 });
// Never below zero; a finished timer starts again from the top.
assert.equal(secondsLeft(running, 600, 700_000), 0);
assert.deepEqual(toggleClock(running, 600, 700_000), { state: 'running', endsAt: 1_300_000 });

console.log('stepTimerClock: ok');
