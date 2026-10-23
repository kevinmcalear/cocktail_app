import { test } from 'node:test';
import assert from 'node:assert/strict';

import { format, hashes, mismatch, parse } from '../db-snapshot.mjs';

// A PR reuses main's built database only when replaying its migrations from
// scratch would build the same one. Getting this wrong tests a PR on a schema
// its migrations don't produce.

const snap = { '20260101000000_a.sql': 'aa', '20260102000000_b.sql': 'bb' };

test('the same migrations, or new ones after them, reuse it', () => {
  assert.equal(mismatch(snap, { ...snap }), null);
  assert.equal(mismatch(snap, { ...snap, '20260103000000_c.sql': 'cc' }), null);
});

test('an edited, removed or out-of-order migration replays from scratch', () => {
  assert.match(mismatch(snap, { ...snap, '20260102000000_b.sql': 'b2' }), /changed/);
  assert.match(mismatch(snap, { '20260101000000_a.sql': 'aa' }), /not in this checkout/);
  assert.match(mismatch(snap, { ...snap, '20260101500000_x.sql': 'xx' }), /sorts before/);
  assert.match(mismatch({}, snap), /no migrations/);
});

test('the list round-trips, and covers every migration here', () => {
  const h = hashes();
  assert.deepEqual(parse(format(h)), h);
  assert.ok(Object.keys(h).length > 200);
});
