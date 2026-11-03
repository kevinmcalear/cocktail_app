import assert from 'node:assert/strict';

import { retryDelay, retryQuery } from './queryRetry';

// 4xx and PostgREST answers: never.
for (const e of [{ status: 401 }, { status: 403 }, { status: 404 }, { code: 'PGRST116' }, { code: 'PGRST301' }, { code: '42501' }, { code: '23505' }]) {
  assert.equal(retryQuery(0, e), false, JSON.stringify(e));
}
// Overload: once.
for (const e of [{ status: 544 }, { status: 503 }, { code: '57014' }, { message: 'canceling statement due to statement timeout' }, { message: 'Request timed out' }]) {
  assert.equal(retryQuery(0, e), true, JSON.stringify(e));
  assert.equal(retryQuery(1, e), false, JSON.stringify(e));
}
// A network glitch: twice.
const net = new TypeError('Failed to fetch');
assert.deepEqual([0, 1, 2].map((n) => retryQuery(n, net)), [true, true, false]);
// 429 and 408 are not final.
assert.equal(retryQuery(0, { status: 429 }), true);
// Backoff doubles, is capped, and stays within 50% jitter.
assert.equal(retryDelay(0, () => 0.5), 1000);
assert.equal(retryDelay(2, () => 0.5), 4000);
assert.equal(retryDelay(10, () => 0.5), 30_000);
assert.equal(retryDelay(1, () => 0), 1000);
assert.equal(retryDelay(1, () => 1), 3000);

console.log('queryRetry: ok');
