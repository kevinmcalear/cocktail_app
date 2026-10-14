// House prep recipes from supabase/seeds/preps/*.json (the migrations
// scripts/prep-recipes.mjs writes): each seeded recipe sits on a shared prep
// with its sources, a prep whose only line has no amount gets the full recipe,
// a venue prep of the same name is never touched, no flavour job is queued, and
// a second run changes nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run prep recipe tests against a non-local API: ${status.API_URL}`);
}

const SEEDS = new URL('../seeds/preps/', import.meta.url);
const seeds = readdirSync(SEEDS)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, SEEDS), 'utf8')));
const migrations = seeds.map((s) => readFileSync(new URL(`../migrations/${s.migration}`, import.meta.url), 'utf8'));
const withAmounts = seeds.flatMap((s) => s.preps.filter((p) => (p.recipe ?? []).some((l) => l.amount != null)));
const db = new pg.Client({ connectionString: status.DB_URL });

const SHARED = `SELECT i.id FROM public.items i
  WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.id = public.resolve_ingredient($1)`;
const shape = (id) =>
  db
    .query(
      `SELECT (SELECT json_agg(json_build_object('i', r.ingredient_item_id, 'a', r.amount, 'u', r.unit) ORDER BY r.sort_order)
                 FROM public.recipes r WHERE r.recipe_item_id = $1) AS lines,
              (SELECT json_agg(s.body ORDER BY s.position) FROM public.item_steps s WHERE s.item_id = $1) AS steps,
              (SELECT json_agg(s.field || ' ' || s.url ORDER BY s.field, s.url) FROM public.item_sources s WHERE s.item_id = $1) AS sources,
              (SELECT row_to_json(p) FROM (SELECT yield_amount, yield_unit, shelf_life_hours, storage, actions FROM public.item_prep WHERE item_id = $1) p) AS card,
              (SELECT generic_id FROM public.items WHERE id = $1) AS kind_of`,
      [id]
    )
    .then((r) => r.rows[0]);
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

describe('house prep recipes', { skip: seeds.length === 0 && 'no prep recipe seeds yet' }, () => {
  test('every seeded recipe sits on a shared prep with amounts and a recipe source', async () => {
    for (const p of withAmounts) {
      const { rows } = await db.query(SHARED, [p.name]);
      assert.equal(rows.length, 1, `${p.name} is a shared ingredient`);
      const s = await shape(rows[0].id);
      assert.ok(s.lines?.some((l) => l.a != null), `${p.name} has amounts`);
      assert.ok(s.sources?.some((x) => x.startsWith('recipe ')), `${p.name} has a recipe source`);
    }
  });

  test('a second run changes nothing and queues no flavour job', () =>
    inTransaction(async () => {
      const ids = [];
      for (const p of withAmounts) ids.push((await db.query(SHARED, [p.name])).rows[0].id);
      const beforeShapes = await Promise.all(ids.map(shape));
      const queued = await jobs();
      for (const sql of migrations) await db.query(sql);
      assert.deepEqual(await Promise.all(ids.map(shape)), beforeShapes);
      assert.equal(await jobs(), queued);
    }));

  test('a prep whose only line has no amount gets the full recipe; a venue prep of the name is left alone', () =>
    inTransaction(async () => {
      const seed = seeds.find((s) => s.preps.some((p) => !p.replace && (p.recipe ?? []).some((l) => l.amount != null)));
      if (!seed) return;
      const p = seed.preps.find((x) => !x.replace && (x.recipe ?? []).some((l) => l.amount != null));
      const [{ id }] = (await db.query(SHARED, [p.name])).rows;
      await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [id]);
      await db.query('DELETE FROM public.item_steps WHERE item_id = $1', [id]);
      await db.query(
        'INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, sort_order) VALUES ($1, public.resolve_ingredient($2), 0)',
        [id, p.recipe[0].ingredient]
      );
      const bar = await db.query("INSERT INTO public.bars (name) VALUES ('Prep recipes test bar') RETURNING id");
      // Older venue preps share a catalog name with no "kind of"; the name guard
      // stops new ones, so make one the way a cleanup would.
      await db.query("SELECT set_config('app.ingredient_merge', 'on', true)");
      const venue = await db.query(
        "INSERT INTO public.items (name, item_type, ingredient_role, bar_id) VALUES ($1, 'ingredient', 'prep', $2) RETURNING id",
        [p.name, bar.rows[0].id]
      );
      await db.query("SELECT set_config('app.ingredient_merge', 'off', true)");
      await db.query(migrations[seeds.indexOf(seed)]);
      const s = await shape(id);
      assert.equal(s.lines.length, p.recipe.length);
      assert.ok(s.lines.every((l) => l.a != null || p.recipe.some((r) => r.amount == null)));
      const v = await shape(venue.rows[0].id);
      assert.deepEqual([v.lines, v.steps, v.sources], [null, null, null]);
    }));
});
