import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { PANTRY, PANTRY_WATER } from './pantry';
import { byDrink, canMakeLabel } from './venueCanMake';

// --- the rows by drink, and their words ---
const got = byDrink([
  { drink_id: 'martini', can_make: true, missing_count: 0, missing: [] },
  { drink_id: 'boulevardier', can_make: false, missing_count: 1, missing: [{ id: 'c', name: 'Cynar' }] },
  { drink_id: 'far', can_make: false, missing_count: 4, missing: [{ id: 'a', name: 'Amaro' }, { id: 'b', name: 'Bitters' }, { id: 'f', name: 'Falernum' }] },
  { drink_id: 'odd', can_make: false, missing_count: 1, missing: null },
]);
assert.equal(canMakeLabel(got.martini), 'Can make');
assert.equal(canMakeLabel(got.boulevardier), 'Missing 1: Cynar');
assert.equal(canMakeLabel(got.far), 'Missing 4');
assert.deepEqual(got.odd.missing, []);
assert.equal(canMakeLabel(got.odd), 'Missing 1', 'one short but not named (hidden from the caller): just the count');
assert.equal(got.unknown, undefined);

// --- the venue's staples are lib/pantry.ts's, word for word ---
const dir = new URL('../supabase/migrations/', import.meta.url);
const sql = readdirSync(dir)
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .filter((s) => s.includes('FUNCTION "private"."venue_back_bar"'))
  .pop();
assert.ok(sql, 'a migration makes private.venue_back_bar');
const staples = sql.match(/unnest\(ARRAY\[([^\]]+)\]\) AS n/)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
assert.deepEqual(staples, [...PANTRY.map((p) => p.name), PANTRY_WATER]);

console.log('venueCanMake checks passed');
