// Small Hand Foods Orgeat files under Almond liqueur
// (supabase/migrations/20261017400000_orgeat_liqueur.sql): it moves from the
// Orgeat syrup style with its wrong ABV of 0 left unknown, the producer's FAQ
// becomes its style source, no flavour or image job is queued, a second run
// changes nothing, and a database without the bottle runs it cleanly.
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
  throw new Error(`Refusing to run orgeat tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261017400000_orgeat_liqueur.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });

const BOTTLE = `SELECT b.id, b.ingredient_role, b.abv, b.made_from_id, s.name AS style
  FROM public.items b LEFT JOIN public.items s ON s.id = b.generic_id
 WHERE b.item_type = 'ingredient' AND b.bar_id IS NULL AND b.ingredient_role = 'product'
   AND public.ingredient_key(b.name) = public.ingredient_key('Small Hand Foods Orgeat')`;
const sources = (id) =>
  db.query('SELECT field, url FROM public.item_sources WHERE item_id = $1 ORDER BY field, url', [id]).then((r) => r.rows);
const jobs = () => db.query('SELECT count(*)::int AS n FROM private.item_flavor_jobs').then((r) => r.rows[0].n);

// Each test runs in a transaction that's rolled back, so they don't touch each other.
const inTransaction = async (fn) => {
  await db.query('BEGIN');
  try {
    await fn();
  } finally {
    await db.query('ROLLBACK');
  }
};

before(() => db.connect());
after(() => db.end());

describe('Small Hand Foods Orgeat is a liqueur', () => {
  test('after the migrations it sits under Almond liqueur, ABV unknown, sourced to the FAQ', async () => {
    const { rows } = await db.query(BOTTLE);
    assert.equal(rows.length, 1);
    assert.deepEqual(
      { role: rows[0].ingredient_role, style: rows[0].style, abv: rows[0].abv, madeFrom: rows[0].made_from_id },
      { role: 'product', style: 'Almond liqueur', abv: null, madeFrom: null }
    );
    const style = (await sources(rows[0].id)).filter((s) => s.field === 'style').map((s) => s.url);
    assert.deepEqual(style, ['https://smallhandfoods.com/faq/']);
  });

  test('moves a syrup-filed orgeat without queueing a flavour job', () =>
    inTransaction(async () => {
      const [{ id }] = (await db.query(BOTTLE)).rows;
      await db.query(
        `UPDATE public.items SET abv = 0, generic_id = (
           SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL
              AND ingredient_role IN ('generic', 'prep') AND name = 'Orgeat' ORDER BY (ingredient_role = 'generic') DESC LIMIT 1)
         WHERE id = $1`,
        [id]
      );
      await db.query(
        "INSERT INTO public.item_sources (item_id, field, url, kind, checked_on) VALUES ($1, 'style', 'https://smallhandfoods.com/syrups', 'producer', DATE '2026-10-09') ON CONFLICT DO NOTHING",
        [id]
      );
      assert.equal((await db.query(BOTTLE)).rows[0].style, 'Orgeat');
      const queued = await jobs();
      await db.query(MIGRATION);
      const [row] = (await db.query(BOTTLE)).rows;
      assert.deepEqual({ style: row.style, abv: row.abv }, { style: 'Almond liqueur', abv: null });
      assert.ok(!(await sources(id)).some((s) => s.field === 'style' && s.url.endsWith('/syrups')));
      assert.equal(await jobs(), queued);
    }));

  test('a second run changes nothing', () =>
    inTransaction(async () => {
      const [before] = (await db.query(BOTTLE)).rows;
      const sourcesBefore = await sources(before.id);
      const queued = await jobs();
      await db.query(MIGRATION);
      assert.deepEqual((await db.query(BOTTLE)).rows, [before]);
      assert.deepEqual(await sources(before.id), sourcesBefore);
      assert.equal(await jobs(), queued);
    }));

  test('runs cleanly when the bottle is missing', () =>
    inTransaction(async () => {
      const [{ id }] = (await db.query(BOTTLE)).rows;
      await db.query("UPDATE public.items SET name = 'Gone orgeat (test)' WHERE id = $1", [id]);
      await db.query(MIGRATION);
      assert.equal((await db.query(BOTTLE)).rows.length, 0);
    }));
});
