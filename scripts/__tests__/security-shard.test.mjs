import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECONDS, parse, shard } from '../security-shard.mjs';

// CI runs each shard on its own runner. A file in no shard is a test that
// silently stops running; a file in two is wasted time.

const files = readdirSync(join(dirname(fileURLToPath(import.meta.url)), '../../supabase/tests')).filter((f) => f.endsWith('.test.mjs'));

test('every test file runs in exactly one shard', () => {
  for (const total of [1, 2, 3, 4]) {
    const all = Array.from({ length: total }, (_, i) => shard(files, i + 1, total)).flat();
    assert.deepEqual(all.sort(), [...files].sort(), `${total} shards`);
  }
});

test('the slow files get a shard each', () => {
  const slow = Object.keys(SECONDS);
  const shards = [1, 2, 3].map((i) => shard(files, i, 3));
  for (const f of slow) assert.equal(shards.filter((s) => s.includes(f)).length, 1);
  assert.ok(shards.every((s) => slow.filter((f) => s.includes(f)).length <= 1));
});

test('a renamed slow file fails loudly', () => {
  assert.throws(() => shard(files.filter((f) => f !== 'db-indexes.test.mjs'), 1, 3), /db-indexes/);
});

test('SECURITY_SHARD must be index/total', () => {
  assert.deepEqual(parse(), { index: 1, total: 1 });
  assert.deepEqual(parse('2/3'), { index: 2, total: 3 });
  for (const bad of ['0/3', '4/3', '3', 'a/b']) assert.throws(() => parse(bad), /SECURITY_SHARD/);
});
