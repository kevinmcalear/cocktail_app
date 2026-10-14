// Australian ice and garnish makers (supabase/migrations/20261017760000_australian_ice_garnish.sql):
// each maker page says what it makes and where it delivers, the garnishes
// land under their maker with the page they were checked on, and running it
// again changes nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run ice and garnish tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261017760000_australian_ice_garnish.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });
const page = (name) =>
  db.query("SELECT makes, serves, country_code FROM public.profiles WHERE kind = 'maker' AND lower(display_name) = lower($1)", [name]).then((r) => r.rows[0]);

before(() => db.connect());
after(() => db.end());

describe('Australian ice and garnish makers', () => {
  test('an ice maker says it makes ice and where it delivers', async () => {
    const p = await page('Van Winkle Ice Co.');
    assert.ok(p, 'the page exists');
    assert.ok(p.makes.includes('ice'));
    assert.deepEqual(p.serves, ['Yarra Valley', 'Melbourne']);
    assert.equal(p.country_code, 'AU');
  });

  test('garnish makers make garnish, and their garnishes name them', async () => {
    const { rows } = await db.query(
      `SELECT i.name, p.makes FROM public.items i JOIN public.profiles p ON p.id = i.maker_profile_id
        WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.name IN ('Petite Ingredient Crystallised Violets', 'Garnish Game Dehydrated Lime Wheels')
        ORDER BY i.name`
    );
    assert.equal(rows.length, 2);
    for (const r of rows) assert.ok(r.makes.includes('garnish'), `${r.name}'s maker makes garnish`);
  });

  test('a second run changes nothing', async () => {
    await db.query('BEGIN');
    try {
      const snap = `SELECT md5(string_agg(p.id::text || p.display_name || array_to_string(p.makes, ',') || array_to_string(p.serves, ','), ';' ORDER BY p.id)) AS h
                      FROM public.profiles p WHERE p.kind = 'maker'`;
      const items = "SELECT count(*)::int AS n FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL";
      const before = [(await db.query(snap)).rows[0].h, (await db.query(items)).rows[0].n];
      await db.query(MIGRATION);
      assert.deepEqual([(await db.query(snap)).rows[0].h, (await db.query(items)).rows[0].n], before);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
