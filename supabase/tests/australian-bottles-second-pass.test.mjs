// Australian bottles, second pass (supabase/migrations/20261017790000_australian_bottles_second_pass.sql):
// the load lands its bottles and maker pages, every bottle it checked keeps
// the page it was checked on, and running it again changes nothing.
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
  throw new Error(`Refusing to run second-pass bottle tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261017790000_australian_bottles_second_pass.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });

// The bottles this load checked: their sources carry its date.
const LOADED = `SELECT DISTINCT s.item_id FROM public.item_sources s WHERE s.checked_on = DATE '2026-10-14' AND s.field = 'exists'`;

before(() => db.connect());
after(() => db.end());

describe('Australian bottles, second pass', () => {
  test('the load lands its bottles, each a product with a maker page that makes bottles', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE i.ingredient_role = 'product')::int AS products,
              count(*) FILTER (WHERE p.kind = 'maker' AND 'bottles' = ANY (p.makes))::int AS with_maker
         FROM public.items i JOIN (${LOADED}) l ON l.item_id = i.id
         LEFT JOIN public.profiles p ON p.id = i.maker_profile_id`
    );
    assert.ok(rows[0].n > 300, `loaded ${rows[0].n}`);
    assert.equal(rows[0].products, rows[0].n);
    assert.ok(rows[0].with_maker / rows[0].n > 0.95, `${rows[0].with_maker} of ${rows[0].n} name a maker`);
  });

  test('every loaded bottle keeps the pages it was checked on, as web addresses', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS bad FROM public.item_sources s JOIN (${LOADED}) l ON l.item_id = s.item_id
        WHERE s.url !~ '^https?://' OR s.url ~ 'products\\.json'`
    );
    assert.equal(rows[0].bad, 0);
  });

  test('a second run changes nothing', async () => {
    await db.query('BEGIN');
    try {
      const snap = `SELECT md5(string_agg(i.id::text || i.name || coalesce(i.generic_id::text, '') || coalesce(i.abv::text, '') || coalesce(i.maker_profile_id::text, ''), ',' ORDER BY i.id)) AS h
                      FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL`;
      const before = (await db.query(snap)).rows[0].h;
      const makers = (await db.query("SELECT count(*)::int AS n FROM public.profiles WHERE kind = 'maker'")).rows[0].n;
      await db.query(MIGRATION);
      assert.equal((await db.query(snap)).rows[0].h, before);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM public.profiles WHERE kind = 'maker'")).rows[0].n, makers);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
