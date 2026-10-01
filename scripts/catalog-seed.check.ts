import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const generated = spawnSync(process.execPath, ['scripts/catalog-seed.mjs', '--print'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
assert.equal(generated.status, 0, generated.stderr);
const file = readFileSync('supabase/migrations/20261001190000_product_catalog.sql', 'utf8');
assert.equal(generated.stdout, file);
assert.match(file, /Tanqueray London Dry Gin/);
assert.match(file, /Guinness Draught/);
assert.match(file, /Demerara Syrup/);
assert.doesNotMatch(file, /—|–/);
