// Venue preps that share a catalog prep's name become a version of it
// (supabase/migrations/20261018080000_prep_recipes_venue_links.sql): a listed
// venue prep with no kind, or a plain style, gets the catalog prep; one whose
// kind is its venue's own stays; an unlisted one is never touched; no flavour
// job is queued; a second run changes nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run venue link tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261018080000_prep_recipes_venue_links.sql', import.meta.url), 'utf8');
const LISTED = [...MIGRATION.matchAll(/^\('([0-9a-f-]{36})'\)/gm)].map((m) => m[1]);
const db = new pg.Client({ connectionString: status.DB_URL });

const shared = (name, role) =>
  db
    .query(
      `SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL AND ingredient_role = $2
          AND public.ingredient_key(name) = public.ingredient_key($1) ORDER BY created_at LIMIT 1`,
      [name, role]
    )
    .then((r) => r.rows[0]?.id ?? null);
const kindOf = (id) => db.query('SELECT generic_id FROM public.items WHERE id = $1', [id]).then((r) => r.rows[0].generic_id);
const jobs = () => db.query('SELECT count(*)::int AS n FROM private.item_flavor_jobs').then((r) => r.rows[0].n);
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

describe('venue preps linked to the catalog prep of their name', () => {
  test('the migration lists 44 venue preps by id and names none', () => {
    assert.equal(LISTED.length, 44);
    assert.equal(new Set(LISTED).size, 44);
    assert.doesNotMatch(MIGRATION.replace(/^--.*$/gm, ''), /\$q\$/, 'no names in the SQL');
  });

  test('links a listed prep with no kind or a plain style; leaves an own kind and unlisted rows alone', () =>
    inTransaction(async () => {
      const orgeat = await shared('Orgeat', 'prep');
      const cordial = await shared('Lime cordial', 'prep');
      const style = await shared('Cordial', 'generic');
      assert.ok(orgeat && cordial && style, 'the local catalog has Orgeat, Lime cordial and Cordial');
      const bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Links bar ${randomUUID().slice(0, 8)}`])).rows[0].id;
      // Older venue preps share a catalog name with no kind; the name guard
      // stops new ones, so make them the way a cleanup would.
      await db.query("SELECT set_config('app.ingredient_merge', 'on', true)");
      const add = (id, name, kind) =>
        db.query(`INSERT INTO public.items (id, name, item_type, ingredient_role, bar_id, generic_id) VALUES ($1, $2, 'ingredient', 'prep', $3, $4)`, [id, name, bar, kind]);
      const own = randomUUID();
      await add(own, 'Links test house syrup', null);
      await add(LISTED[0], 'Orgeat', null);
      await add(LISTED[1], 'Lime cordial', style);
      await add(LISTED[2], 'Orgeat', own);
      const unlisted = randomUUID();
      await add(unlisted, 'Orgeat', null);
      await db.query("SELECT set_config('app.ingredient_merge', 'off', true)");

      const queued = await jobs();
      await db.query(MIGRATION);
      assert.equal(await kindOf(LISTED[0]), orgeat);
      assert.equal(await kindOf(LISTED[1]), cordial);
      assert.equal(await kindOf(LISTED[2]), own, "a kind that's the venue's own stays");
      assert.equal(await kindOf(unlisted), null, 'an unlisted venue prep is untouched');
      assert.equal(await jobs(), queued, 'no flavour job');

      await db.query(MIGRATION);
      assert.deepEqual(
        await Promise.all([LISTED[0], LISTED[1], LISTED[2], unlisted].map(kindOf)),
        [orgeat, cordial, own, null],
        'a second run changes nothing'
      );
    }));

  test('runs cleanly when none of the listed rows exist', () =>
    inTransaction(async () => {
      await db.query(MIGRATION);
    }));
});
