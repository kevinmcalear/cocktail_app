// What pairs with what (20261008110000_ingredient_pairs.sql): pairs count at
// the core ingredient, only drinks anyone can read count (never a venue's
// private specs), and anyone can ask.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run pairing tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const made = [];

async function item(row) {
  const { rows } = await db.query(
    `INSERT INTO public.items (name, item_type, bar_id, is_core, generic_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [row.name, row.item_type, row.bar_id ?? null, row.is_core ?? false, row.generic_id ?? null]
  );
  made.push(rows[0].id);
  return rows[0].id;
}

async function drink(name, barId, ingredients) {
  const id = await item({ name, item_type: 'cocktail', bar_id: barId });
  for (const [i, ing] of ingredients.entries()) {
    await db.query('INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 30, $3, $4)', [id, ing, 'ml', i]);
  }
  return id;
}

before(async () => {
  await db.connect();
  await db.query("SET app.image_worker = 'on'");
  const { rows } = await db.query('INSERT INTO public.bars (name, slug) VALUES ($1, $2) RETURNING id', [`Pairs ${run}`, `pairs-${run}`]);
  ids.bar = rows[0].id;
  ids.gin = await item({ name: `Zest Gin ${run}`, item_type: 'ingredient', is_core: true });
  ids.brand = await item({ name: `Zest Gin Brand ${run}`, item_type: 'ingredient', generic_id: ids.gin });
  ids.yuzu = await item({ name: `Zest Yuzu ${run}`, item_type: 'ingredient', is_core: true });
  ids.secret = await item({ name: `Zest Secret ${run}`, item_type: 'ingredient', is_core: true });
  // Two open drinks pour the brand with yuzu; three private venue drinks pair gin with the secret.
  ids.open1 = await drink(`Open One ${run}`, null, [ids.brand, ids.yuzu]);
  ids.open2 = await drink(`Open Two ${run}`, null, [ids.gin, ids.yuzu]);
  for (const n of [1, 2, 3]) await drink(`Private ${n} ${run}`, ids.bar, [ids.gin, ids.secret]);
  await db.query('SELECT private.refresh_ingredient_pairs()');
});

after(async () => {
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1::uuid[])', [made]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[...made].reverse()]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.query('SELECT private.refresh_ingredient_pairs()');
  await db.end();
});

describe('ingredient pairs', () => {
  test('a brand counts as its core ingredient, and anyone can ask', async () => {
    const { data, error } = await anon.rpc('get_pairings', { p_ids: [ids.brand], p_era: 'now', p_limit: 50 });
    assert.equal(error, null);
    const yuzu = data.find((p) => p.item_id === ids.yuzu);
    assert.ok(yuzu, 'yuzu pairs with the gin the brand is a kind of');
    assert.deepEqual(yuzu.together, [2]);
  });

  test("a venue's private drinks never count", async () => {
    const { data } = await anon.rpc('get_pairings', { p_ids: [ids.gin], p_era: 'now', p_limit: 50 });
    assert.ok(!data.some((p) => p.item_id === ids.secret), 'private pairing stays private');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.ingredient_pairs WHERE a_id = $1 OR b_id = $1', [ids.secret]);
    assert.equal(rows[0].n, 0);
  });

  test('the drinks behind a pair are the open ones', async () => {
    const { data, error } = await anon.rpc('get_pair_drinks', { p_a: ids.brand, p_b: ids.yuzu, p_limit: 10 });
    assert.equal(error, null);
    assert.deepEqual(data.map((d) => d.id).sort(), [ids.open1, ids.open2].sort());
    const { data: none } = await anon.rpc('get_pair_drinks', { p_a: ids.gin, p_b: ids.secret, p_limit: 10 });
    assert.deepEqual(none, []);
  });

  test('nobody writes the pairs table from the app', async () => {
    const { error } = await anon.from('ingredient_pairs').insert({ era: 'now', a_id: ids.gin, b_id: ids.yuzu, together: 99, lift: 1, score: 1 });
    assert.ok(error);
  });
});
