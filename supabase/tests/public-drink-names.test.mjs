// Signed out, a public drink shows its ingredient names but never amounts,
// and a catalog classic names the classic it came from
// (supabase/migrations/20261015900000_public_drink_names_and_lineage.sql).
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run public drink name tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const names = async (key) => {
  const { data, error } = await anon.rpc('public_drink_ingredients', { p_item_ids: [ids[key]] });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  ids.bar = (await serviceInsert('bars', { name: `Names Bar ${run}` })).id;
  ids.profile = (await serviceInsert('profiles', { kind: 'bar', handle: `names${run}`, display_name: `Names Bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.gin = await item({ name: `Gin ${run}`, item_type: 'ingredient' });
  ids.prep = await item({ name: `Secret Cordial ${run}`, item_type: 'ingredient', bar_id: ids.bar });
  ids.drink = await item({ name: `Names Martini ${run}`, bar_id: ids.bar, publish_mode: 'description' });
  ids.hidden = await item({ name: `Hidden Martini ${run}`, bar_id: ids.bar, publish_mode: 'private' });
  for (const key of ['drink', 'hidden']) {
    await serviceInsert('recipes', { recipe_item_id: ids[key], ingredient_item_id: ids.gin, amount: 60, unit: 'ml', sort_order: 0 });
    await serviceInsert('recipes', { recipe_item_id: ids[key], ingredient_item_id: ids.prep, amount: 15, unit: 'ml', sort_order: 1 });
  }
  ids.parent = await item({ name: `Parent Classic ${run}`, is_catalog: true });
  ids.child = await item({ name: `Child Classic ${run}`, is_catalog: true, lineage_parent_id: ids.parent });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('UPDATE public.items SET lineage_parent_id = NULL WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  await db.end();
});

test('signed out, a description-only drink names its shared ingredients, with no amounts', async () => {
  const rows = await names('drink');
  assert.deepEqual(
    rows.map((r) => r.name),
    [`Gin ${run}`]
  );
  assert.deepEqual(Object.keys(rows[0]).sort(), ['item_id', 'name', 'sort_order']);
});

test("a bar's house prep stays unnamed", async () => {
  assert.ok(!(await names('drink')).some((r) => r.name.includes('Secret Cordial')));
});

test('a private drink names nothing', async () => {
  assert.deepEqual(await names('hidden'), []);
});

test('a locked bar page names nothing', async () => {
  await db.query("UPDATE public.bars SET page_visibility = 'locked' WHERE id = $1", [ids.bar]);
  try {
    assert.deepEqual(await names('drink'), []);
  } finally {
    await db.query("UPDATE public.bars SET page_visibility = 'open' WHERE id = $1", [ids.bar]);
  }
});

test("a catalog classic names the classic it came from; a root names none", async () => {
  const child = await anon.rpc('public_lineage_parent', { p_item_id: ids.child });
  assert.ifError(child.error);
  assert.equal(child.data, ids.parent);
  const root = await anon.rpc('public_lineage_parent', { p_item_id: ids.parent });
  assert.ifError(root.error);
  assert.equal(root.data, null);
});
