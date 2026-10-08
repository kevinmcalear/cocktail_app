// Faster cocktail lists, drink pages and catalog pages, same rows
// (supabase/migrations/20261010200000_catalog_read_speed.sql).
//
// The rows themselves are checked elsewhere: presentation-speed.test.mjs
// compares app_recipe_presentation with its earlier definition for every kind
// of reader (view-as included), and credited-drink-notes.test.mjs covers who
// reads a note. This file checks what makes them fast: the recipe ingredient
// embeds fold into the query, the notes policy checks one item, and the
// indexes and role setting are there.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run catalog speed tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

async function planAs(role, sql) {
  await db.query('BEGIN');
  try {
    const claims = role === 'anon' ? { role: 'anon' } : { sub: randomUUID(), role: 'authenticated' };
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await db.query(`SET LOCAL ROLE ${role}`);
    return (await db.query(`EXPLAIN (COSTS OFF) ${sql}`)).rows.map((r) => r['QUERY PLAN']).join('\n');
  } finally {
    await db.query('ROLLBACK');
  }
}

// The shape PostgREST sends for `recipes:app_recipe_presentation!recipe_item_id(..., display_ingredient(id, name))`.
const embed = (fn) => `
  SELECT c.id, ing.name
  FROM public.app_item_presentation c
  LEFT JOIN LATERAL (
    SELECT r.sort_order, d.name
    FROM public.app_recipe_presentation r
    LEFT JOIN LATERAL (
      SELECT i.id, i.name FROM public.${fn}(r::public.app_recipe_presentation) i LIMIT NULL OFFSET NULL
    ) d ON true
    WHERE r.recipe_item_id = c.id LIMIT NULL OFFSET NULL
  ) ing ON true
  WHERE c.item_type = 'cocktail'
  ORDER BY c.name, c.id LIMIT 50`;

describe('recipe ingredient embeds', () => {
  test('are plain invoker SQL functions with no SET clause', async () => {
    const { rows } = await db.query(
      `SELECT proname, prosecdef, proconfig, provolatile, prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql') AS is_sql
       FROM pg_proc WHERE proname IN ('display_ingredient', 'published_ingredient') AND pronamespace = 'public'::regnamespace
       ORDER BY proname`
    );
    assert.deepEqual(
      rows.map((r) => [r.proname, r.prosecdef, r.proconfig, r.provolatile, r.is_sql]),
      [
        ['display_ingredient', false, null, 's', true],
        ['published_ingredient', false, null, 's', true],
      ]
    );
  });

  for (const [fn, role] of [['display_ingredient', 'authenticated'], ['published_ingredient', 'authenticated'], ['published_ingredient', 'anon']]) {
    test(`${fn} folds into the query for ${role}`, async () => {
      const plan = await planAs(role, embed(fn));
      assert.doesNotMatch(plan, /Function Scan/, plan);
    });
  }

  test("display_ingredient looks the ingredient up by its key, not by reading every item", async () => {
    const plan = await planAs('authenticated', embed('display_ingredient'));
    assert.doesNotMatch(plan, /Seq Scan on items i\b/, plan);
  });
});

describe('credited drink notes', () => {
  test('the policy checks the note\'s own item', async () => {
    const { rows } = await db.query(
      `SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credited_drink_notes' AND policyname = 'credited_drink_notes_select'`
    );
    assert.match(rows[0].qual, /EXISTS/);
    assert.doesNotMatch(rows[0].qual, /item_id IN/);
  });
});

describe('indexes and settings', () => {
  test('foreign keys have their indexes', async () => {
    const { rows } = await db.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1) ORDER BY indexname`,
      [['ingredient_pairs_a_id_idx', 'ingredient_pairs_b_id_idx', 'item_categories_category_id_idx', 'item_images_image_id_idx']]
    );
    assert.deepEqual(
      rows.map((r) => r.indexdef.replace(/^.* USING btree /, `${r.indexname} `)),
      [
        'ingredient_pairs_a_id_idx (a_id)',
        'ingredient_pairs_b_id_idx (b_id)',
        'item_categories_category_id_idx (category_id)',
        'item_images_image_id_idx (image_id)',
      ]
    );
  });

  test('signed-in reads get 8MB to sort in, in a form PostgREST can apply', async () => {
    const { rows } = await db.query(
      `SELECT s.setconfig FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole WHERE r.rolname = 'authenticated' AND s.setdatabase = 0`
    );
    const setting = rows[0].setconfig.find((s) => s.startsWith('work_mem='));
    assert.ok(setting, rows[0].setconfig.join(', '));
    // PostgREST lowercases role settings before applying them ('8MB' would fail as '8mb').
    await db.query('BEGIN');
    try {
      await db.query(`SELECT set_config('work_mem', lower($1), true)`, [setting.slice('work_mem='.length)]);
      assert.equal((await db.query('SHOW work_mem')).rows[0].work_mem, '8MB');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
