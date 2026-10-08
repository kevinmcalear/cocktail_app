// A drink's strength is worked out once per statement that changes its spec
// or method, and comes out the same as before
// (supabase/migrations/20261008620000_strength_statement_triggers.sql).
// Each check compares the stored figures with the worked example of
// drink-math.test.mjs and with a fresh refresh_drink_strength() of the final
// spec, which is what the old row triggers stored after every line.
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
  throw new Error(`Refusing to run strength trigger tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
const run = randomUUID().slice(0, 8);
const ids = {};

const COLS = 'abv, abv_source, serve_ml, serve_abv';
const stored = async (id) => (await db.query(`SELECT ${COLS} FROM public.items WHERE id = $1`, [id])).rows[0];
const near = (a, b, msg) => assert.ok(a != null && Math.abs(Number(a) - b) < 0.06, `${msg ?? ''} expected ${b}, got ${a}`);

/** The figures the old row triggers left: a refresh of the final spec. */
async function recomputed(id) {
  await db.query('BEGIN');
  try {
    await db.query('SELECT private.refresh_drink_strength($1)', [id]);
    return await stored(id);
  } finally {
    await db.query('ROLLBACK');
  }
}

async function assertSettled(...drinks) {
  for (const id of drinks) assert.deepEqual(await stored(id), await recomputed(id));
}

const item = async (key, cols) => {
  const row = { name: `${key} ${run}`, created_by: null, ...cols };
  const names = Object.keys(row);
  ids[key] = (await db.query(
    `INSERT INTO public.items (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row)
  )).rows[0].id;
};

before(async () => {
  await db.connect();
  await item('Shake', { item_type: 'method' });
  await item('White rum', { item_type: 'ingredient', abv: 40 });
  await item('Lime juice', { item_type: 'ingredient' });
  await item('Simple syrup', { item_type: 'ingredient', abv: 0 });
  await item('Daiquiri', { item_type: 'cocktail' });
  await item('Rum sour', { item_type: 'cocktail' });
  for (const drink of ['Daiquiri', 'Rum sour']) {
    await db.query('INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES ($1, $2, 0)', [ids[drink], ids.Shake]);
  }
});

after(async () => {
  const all = Object.values(ids);
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1)', [all]);
  await db.query('DELETE FROM public.item_methods WHERE item_id = ANY($1)', [all]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [all]);
  await db.end();
});

const SPEC = (drink) => [
  [drink, 'White rum', 60, 1],
  [drink, 'Lime juice', 22.5, 2],
  [drink, 'Simple syrup', 15, 3],
];

/** One statement for every line, as the editor's save does. */
async function insertLines(lines) {
  const values = lines.map((_, i) => `($${i * 4 + 1}::uuid, $${i * 4 + 2}::uuid, $${i * 4 + 3}::numeric, 'ml', $${i * 4 + 4}::int)`).join(', ');
  await db.query(
    `INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ${values}`,
    lines.flatMap(([drink, ingredient, amount, order]) => [ids[drink], ids[ingredient], amount, order])
  );
}

describe('strength after multi-line saves', () => {
  test('a whole spec saved in one statement: 24.6%, 121.9 ml at 19.7% after 25% water', async () => {
    await insertLines([...SPEC('Daiquiri'), ...SPEC('Rum sour')]);
    for (const drink of ['Daiquiri', 'Rum sour']) {
      const s = await stored(ids[drink]);
      assert.equal(s.abv_source, 'calculated');
      near(s.abv, 24.6);
      near(s.serve_ml, 121.9);
      near(s.serve_abv, 19.7);
    }
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
  });

  test('every line changed in one statement', async () => {
    await db.query('UPDATE public.recipes SET amount = amount * 2 WHERE recipe_item_id = $1', [ids.Daiquiri]);
    const s = await stored(ids.Daiquiri);
    near(s.abv, 24.6, 'same proportions');
    near(s.serve_ml, 243.8);
    await assertSettled(ids.Daiquiri);
  });

  test('the spec replaced (old lines deleted, new ones inserted)', async () => {
    await db.query('BEGIN');
    await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [ids.Daiquiri]);
    await insertLines(SPEC('Daiquiri'));
    await db.query('COMMIT');
    near((await stored(ids.Daiquiri)).serve_ml, 121.9);
    await assertSettled(ids.Daiquiri);
  });

  test('a line moved to another drink refreshes both', async () => {
    await db.query('UPDATE public.recipes SET recipe_item_id = $2, sort_order = 9 WHERE recipe_item_id = $1 AND sort_order = 3', [ids.Daiquiri, ids['Rum sour']]);
    near((await stored(ids.Daiquiri)).abv, 29.1, 'no syrup: 24 ml ethanol in 82.5 ml');
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
    await db.query('UPDATE public.recipes SET recipe_item_id = $1, sort_order = 3 WHERE recipe_item_id = $2 AND sort_order = 9', [ids.Daiquiri, ids['Rum sour']]);
    near((await stored(ids.Daiquiri)).abv, 24.6, 'and back');
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
  });

  test("an ingredient's ABV changes every drink that uses it", async () => {
    await db.query('UPDATE public.items SET abv = 50 WHERE id = $1', [ids['White rum']]);
    near((await stored(ids['Rum sour'])).abv, 30.8, '30 ml ethanol in 97.5 ml');
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
    await db.query('UPDATE public.items SET abv = 40 WHERE id = $1', [ids['White rum']]);
    near((await stored(ids.Daiquiri)).abv, 24.6);
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
  });

  test('the method removed and put back', async () => {
    await db.query('DELETE FROM public.item_methods WHERE item_id = ANY($1)', [[ids.Daiquiri, ids['Rum sour']]]);
    near((await stored(ids.Daiquiri)).serve_ml, 97.5, 'no method, no dilution');
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
    await db.query('INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES ($1, $3, 0), ($2, $3, 0)', [ids.Daiquiri, ids['Rum sour'], ids.Shake]);
    near((await stored(ids.Daiquiri)).serve_ml, 121.9);
    await assertSettled(ids.Daiquiri, ids['Rum sour']);
  });
});
