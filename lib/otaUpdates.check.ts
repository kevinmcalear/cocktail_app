import assert from 'node:assert/strict';
import { CHECK_EVERY_MS, holdUpdates, shouldCheck, shouldReload, updatesHeld } from './otaUpdates';

// Checks at most every 30 minutes.
const t0 = 1_000_000;
assert.equal(shouldCheck(t0 + CHECK_EVERY_MS - 1, t0), false);
assert.equal(shouldCheck(t0 + CHECK_EVERY_MS, t0), true);

// Reloads only on the way to the background, with an update ready and no hold.
assert.equal(shouldReload('background', true, false), true);
assert.equal(shouldReload('inactive', true, false), false);
assert.equal(shouldReload('active', true, false), false);
assert.equal(shouldReload('background', false, false), false);
assert.equal(shouldReload('background', true, true), false);

// Holds count, and a release called twice only releases once.
assert.equal(updatesHeld(), false);
const a = holdUpdates();
const b = holdUpdates();
a();
a();
assert.equal(updatesHeld(), true);
b();
assert.equal(updatesHeld(), false);

console.log('otaUpdates: ok');
