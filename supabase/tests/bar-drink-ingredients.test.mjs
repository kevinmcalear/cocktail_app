// Ingredients and styles for bar drinks that only had a description
// (20260930950000_bar_drink_ingredients.sql): filled from the description,
// linked to their classic, never over a spec that's already there, and safe
// to run twice.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

import { notesBackOnRows } from './fixtures/credited-notes.mjs';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run bar drink ingredient tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20260930950000_bar_drink_ingredients.sql', import.meta.url);
const db = new pg.Client({ connectionString: status.DB_URL });

const DRINK = `
  SELECT i.id, i.origin, c.name AS classic FROM public.items i
  JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.handle = 'cafelatrovamiami'
  LEFT JOIN public.items c ON c.id = i.riff_of_id
  WHERE lower(i.name) = 'toasted coconut negroni'`;

const specOf = async (id) =>
  (
    await db.query(
      `SELECT s.name, g.name AS generic, r.amount, r.preparation_notes AS prep
       FROM public.recipes r
       JOIN public.items s ON s.id = r.ingredient_item_id
       LEFT JOIN public.items g ON g.id = r.parent_ingredient_id
       WHERE r.recipe_item_id = $1 ORDER BY r.sort_order`,
      [id]
    )
  ).rows;

// Retried because holding these tables can deadlock with another test file's
// open transaction; Postgres then cancels one side.
async function inRolledBackTransaction(fn) {
  for (let attempt = 1; ; attempt++) {
    await db.query('BEGIN');
    try {
      await db.query("SET LOCAL lock_timeout = '10s'");
      await db.query('LOCK TABLE public.items, public.recipes, public.item_categories IN SHARE ROW EXCLUSIVE MODE');
      return await fn();
    } catch (e) {
      if (attempt >= 3 || !['40P01', '55P03'].includes(e.code)) throw e;
    } finally {
      await db.query('ROLLBACK');
    }
  }
}

before(() => db.connect());
after(() => db.end());

describe('bar drink ingredients', () => {
  test('a drink with only a description gets its lines, in spec order, with no measures', async () => {
    const { rows } = await db.query(DRINK);
    assert.equal(rows.length, 1, 'Café La Trova has one Toasted Coconut Negroni');
    assert.deepEqual(await specOf(rows[0].id), [
      { name: 'Toasted Coconut Rum', generic: 'Rum', amount: null, prep: null },
      { name: 'Campari', generic: null, amount: null, prep: null },
      { name: 'Sweet Vermouth', generic: null, amount: null, prep: null },
    ]);
  });

  test("it's linked to the classic it's a version of, as a variant", async () => {
    const { rows } = await db.query(DRINK);
    assert.equal(rows[0].classic, 'Negroni');
    assert.equal(rows[0].origin, 'Varient');
  });

  test('almost every public bar drink now has ingredients', async () => {
    const { rows } = await db.query(`
      SELECT count(*)::int AS n,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id))::int AS bare
      FROM public.items i
      WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id IS NOT NULL
        AND NOT i.is_catalog -- a classic first made at a bar is the catalog's, not a bar drink
        AND i.description IS NOT NULL
        AND i.name !~ ' [0-9a-f]{8}$' -- other test files' fixtures, named with a run id`);
    assert.ok(rows[0].n >= 500, `expected the seeded drinks, found ${rows[0].n}`);
    // A few descriptions name no ingredient at all ("from the current menu").
    // A menu listing with no description is a name only, and is not counted here.
    assert.ok(rows[0].bare / rows[0].n < 0.08, `${rows[0].bare} of ${rows[0].n} drinks still have no lines`);
  });

  test("a drink that already has a spec keeps it, and a riff link isn't replaced", async () => {
    const { rows } = await db.query(DRINK);
    const id = rows[0].id;
    await inRolledBackTransaction(async () => {
      await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [id]);
      await db.query(
        `INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order)
         SELECT $1, i.id, 30, 'ml', 0 FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = 'campari' LIMIT 1`,
        [id]
      );
      await db.query(
        `UPDATE public.items SET riff_of_id = (SELECT id FROM public.items WHERE is_catalog AND name = 'Boulevardier') WHERE id = $1`,
        [id]
      );
      // Today's name guard (20261008100000) postdates this seed; a re-run is a cleanup.
      await db.query("SELECT set_config('app.ingredient_merge', 'on', true)");
      await db.query(readFileSync(MIGRATION, 'utf8'));
      assert.deepEqual(await specOf(id), [{ name: 'Campari', generic: null, amount: '30', prep: null }]);
      assert.equal((await db.query(DRINK)).rows[0].classic, 'Boulevardier');
    });
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_categories)::int AS categories,
                               (SELECT count(*) FROM public.items WHERE riff_of_id IS NOT NULL)::int AS riffs`)
      ).rows[0];
    await inRolledBackTransaction(async () => {
      await notesBackOnRows(db);
      const before = await count();
      await db.query(readFileSync(MIGRATION, 'utf8'));
      assert.deepEqual(await count(), before);
    });
  });
});
