// Australian beer, cider and wine (supabase/migrations/20261017750000_australian_beer_wine.sql):
// the load lands its bottles with maker pages and sources, Australian
// fortifieds never file under Port or Sherry, and running it again changes
// nothing.
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
  throw new Error(`Refusing to run Australian beer and wine tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261017750000_australian_beer_wine.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });

// The style a row files under, and every style above it.
const ANCESTORS = `WITH RECURSIVE up(id, name, generic_id, depth) AS (
    SELECT s.id, s.name, s.generic_id, 0 FROM public.items s WHERE s.id = $1
    UNION ALL SELECT p.id, p.name, p.generic_id, up.depth + 1 FROM up JOIN public.items p ON p.id = up.generic_id WHERE up.depth < 8)
  SELECT lower(name) AS name FROM up`;

before(() => db.connect());
after(() => db.end());

describe('Australian beer, cider and wine', () => {
  test('the new styles file under the right families', async () => {
    for (const [style, family] of [
      ['Australian Tawny', 'fortified wine'],
      ['Rutherglen Muscat', 'fortified wine'],
      ['Rutherglen Topaque', 'fortified wine'],
    ]) {
      const { rows } = await db.query(
        `SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL AND ingredient_role = 'generic'
            AND public.ingredient_key(name) = public.ingredient_key($1)`,
        [style]
      );
      assert.equal(rows.length, 1, style);
      const names = (await db.query(ANCESTORS, [rows[0].id])).rows.map((r) => r.name);
      assert.ok(names.includes(family), `${style} is under ${family}: ${names.join(' > ')}`);
    }
  });

  test('no Australian tawny, muscat or topaque from this load files under Port or Sherry', async () => {
    const { rows } = await db.query(
      `SELECT b.name, b.generic_id FROM public.items b
         JOIN public.item_sources s ON s.item_id = b.id AND s.field = 'style' AND s.checked_on = DATE '2026-10-13'
        WHERE b.ingredient_role = 'product' AND b.name ~* '(tawny|muscat|topaque)'`
    );
    assert.ok(rows.length > 20, `checked ${rows.length}`);
    for (const r of rows) {
      const names = (await db.query(ANCESTORS, [r.generic_id])).rows.map((x) => x.name);
      assert.ok(!names.includes('port') && !names.includes('tawny port'), `${r.name} files under ${names.join(' > ')}`);
    }
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
