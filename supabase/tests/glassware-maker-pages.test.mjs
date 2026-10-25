// Every glassware maker in the glass catalog has a page
// (20261112100000_glassware_maker_pages.sql): the new maker pages are public,
// make glassware and hold no address; Arc's brands are part of Arc; the tiki
// bars that sell their own mugs are bar pages; and running it again changes
// nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run glassware maker page tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261112100000_glassware_maker_pages.sql', import.meta.url);
const NEW_MAKERS = [
  'arc', 'rona', 'rastal', 'sahm', 'zalto', 'gabriel.glas', 'richard.brendon', 'sophienwald', 'grassl',
  'josephinenhutte', 'sertodo', 'obakki', 'umezawa', 'tiki.farm', 'munktiki',
];
const NEW_BARS = ['cliftons.pacific.seas', 'tonga.hut', 'hale.pele', 'false.idol', 'maxs.south.seas.hideaway'];
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('glassware maker pages', () => {
  test('each new maker page is public, makes glassware and has no address', async () => {
    const { data, error } = await anon.from('profiles').select('handle, kind, makes, website, country_code, latitude, address_line').in('handle', NEW_MAKERS);
    assert.ifError(error);
    assert.deepEqual(data.map((p) => p.handle).sort(), [...NEW_MAKERS].sort());
    for (const p of data) {
      assert.equal(p.kind, 'maker', p.handle);
      assert.ok(p.makes.includes('glassware'), p.handle);
      assert.match(p.website, /^https:\/\//, p.handle);
      assert.match(p.country_code, /^[A-Z]{2}$/, p.handle);
      assert.equal(p.latitude, null, p.handle);
      assert.equal(p.address_line, null, p.handle);
    }
  });

  test("Arcoroc and Chef & Sommelier are part of Arc", async () => {
    const { rows } = await db.query(
      `SELECT p.handle, g.handle AS part_of FROM public.profiles p LEFT JOIN public.profiles g ON g.id = p.part_of_profile_id
       WHERE p.handle IN ('arcoroc', 'chef.sommelier') ORDER BY p.handle`
    );
    assert.deepEqual(rows, [{ handle: 'arcoroc', part_of: 'arc' }, { handle: 'chef.sommelier', part_of: 'arc' }]);
  });

  test('the tiki bars are public bar pages on the map', async () => {
    const { data, error } = await anon.from('profiles').select('handle, kind, latitude, longitude, makes').in('handle', NEW_BARS);
    assert.ifError(error);
    assert.deepEqual(data.map((p) => p.handle).sort(), [...NEW_BARS].sort());
    for (const p of data) {
      assert.equal(p.kind, 'bar', p.handle);
      assert.deepEqual(p.makes, [], p.handle);
      assert.ok(p.latitude && p.longitude, p.handle);
    }
  });

  test('running it again changes nothing', async () => {
    const count = `SELECT count(*)::int AS n FROM public.profiles WHERE kind IN ('maker', 'bar')`;
    const before = (await db.query(count)).rows[0].n;
    await db.query('BEGIN');
    try {
      await db.query(readFileSync(MIGRATION, 'utf8'));
      assert.equal((await db.query(count)).rows[0].n, before);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
