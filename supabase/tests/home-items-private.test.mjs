// Home items stay with their creator (20261008830000_home_items_private.sql):
// a home prep, syrup, ingredient or glass and its recipe are read by the
// creator, and by others only when it's published or used by something they
// can see. Its steps are the creator's alone (20261012410000). The shared
// catalog is unchanged.
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run home item tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function item(row) {
  const cols = Object.keys(row);
  const { rows } = await db.query(
    `INSERT INTO public.items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row)
  );
  return rows[0].id;
}

const recipe = (drink, ingredient, sort = 0) =>
  db.query('INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 1, $3, $4)', [drink, ingredient, 'oz', sort]);

/** What a client can read of an item: the row, its spec lines and its steps. */
async function reads(who, id) {
  const client = users[who].client;
  const [row, lines, steps] = await Promise.all([
    client.from('items').select('id').eq('id', id),
    client.from('app_recipe_presentation').select('id').eq('recipe_item_id', id),
    client.from('item_steps').select('position').eq('item_id', id),
  ]);
  for (const r of [row, lines, steps]) assert.ifError(r.error);
  return { row: row.data.length, lines: lines.data.length, steps: steps.data.length };
}

before(async () => {
  await db.connect();
  for (const label of ['maker', 'stranger', 'member', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await db.query('INSERT INTO public.profiles (kind, handle, display_name, user_id, is_public) VALUES ($1, $2, $3, $4, true)', [
    'person', `maker${run}`, `Maker ${run}`, users.maker.id,
  ]);
  ids.venue = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Home Items Bar ${run}`])).rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 30)', [ids.venue, users.member.id]);

  ids.catalogLemon = await item({ name: `Lemon ${run}`, item_type: 'ingredient' });
  ids.catalogFlagged = await item({ name: `Catalog bitters ${run}`, item_type: 'ingredient', created_by: users.moderator.id, is_catalog: true });

  // A private home prep with its own recipe and steps, made with a home syrup.
  const maker = users.maker.id;
  ids.privateSyrup = await item({ name: `Fig syrup ${run}`, item_type: 'ingredient', created_by: maker });
  ids.privatePrep = await item({ name: `Fig cordial ${run}`, item_type: 'ingredient', created_by: maker });
  await recipe(ids.privatePrep, ids.privateSyrup);
  await recipe(ids.privatePrep, ids.catalogLemon, 1);
  await db.query("INSERT INTO public.item_steps (item_id, position, body) VALUES ($1, 0, 'Simmer the figs.')", [ids.privatePrep]);

  // A published home drink using a home prep (itself made with a home syrup)
  // and a home glass: those show with it.
  ids.sharedSyrup = await item({ name: `Pear syrup ${run}`, item_type: 'ingredient', created_by: maker });
  ids.sharedPrep = await item({ name: `Pear cordial ${run}`, item_type: 'ingredient', created_by: maker });
  ids.glass = await item({ name: `Tulip ${run}`, item_type: 'glassware', created_by: maker });
  await recipe(ids.sharedPrep, ids.sharedSyrup);
  await db.query("INSERT INTO public.item_steps (item_id, position, body) VALUES ($1, 0, 'Poach the pears.')", [ids.sharedPrep]);
  ids.drink = await item({ name: `Pear Fizz ${run}`, item_type: 'cocktail', created_by: maker, publish_mode: 'spec', glassware_id: ids.glass });
  await recipe(ids.drink, ids.sharedPrep);

  // A venue drink using a third home syrup: its members see the syrup.
  ids.venueSyrup = await item({ name: `Plum syrup ${run}`, item_type: 'ingredient', created_by: maker });
  ids.venueDrink = await item({ name: `Plum Sour ${run}`, item_type: 'cocktail', bar_id: ids.venue });
  await recipe(ids.venueDrink, ids.venueSyrup);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.venue]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a home prep nobody else uses', () => {
  test('another person reads nothing of it: not the item, its recipe or its steps', async () => {
    assert.deepEqual(await reads('stranger', ids.privatePrep), { row: 0, lines: 0, steps: 0 });
    assert.deepEqual(await reads('stranger', ids.privateSyrup), { row: 0, lines: 0, steps: 0 });
    assert.deepEqual(await reads('member', ids.privatePrep), { row: 0, lines: 0, steps: 0 });
  });

  test('the creator reads all of it', async () => {
    assert.deepEqual(await reads('maker', ids.privatePrep), { row: 1, lines: 2, steps: 1 });
    assert.deepEqual(await reads('maker', ids.privateSyrup), { row: 1, lines: 0, steps: 0 });
  });

  test('a moderator still reads it', async () => {
    assert.equal((await reads('moderator', ids.privatePrep)).row, 1);
  });
});

describe('used by something the reader can see', () => {
  test("a published drink's prep, the prep's own syrup, and its glass show with it", async () => {
    assert.equal((await reads('stranger', ids.drink)).row, 1);
    // Its steps stay with the maker (20261012410000_home_prep_steps_private.sql).
    assert.deepEqual(await reads('stranger', ids.sharedPrep), { row: 1, lines: 1, steps: 0 });
    assert.equal((await reads('stranger', ids.sharedSyrup)).row, 1);
    assert.equal((await reads('stranger', ids.glass)).row, 1);
    const { data, error } = await users.stranger.client
      .from('items')
      .select('id, glass:glassware_id(id)')
      .eq('id', ids.drink)
      .single();
    assert.ifError(error);
    assert.equal(data.glass?.id, ids.glass);
  });

  test('once the drink goes private again, they go with it', async () => {
    await db.query("UPDATE public.items SET publish_mode = 'private' WHERE id = $1", [ids.drink]);
    try {
      assert.deepEqual(await reads('stranger', ids.sharedPrep), { row: 0, lines: 0, steps: 0 });
      assert.equal((await reads('stranger', ids.glass)).row, 0);
    } finally {
      await db.query("UPDATE public.items SET publish_mode = 'spec' WHERE id = $1", [ids.drink]);
    }
  });

  test("a venue drink's home syrup shows to the venue's members, not to others", async () => {
    assert.equal((await reads('member', ids.venueSyrup)).row, 1);
    assert.equal((await reads('stranger', ids.venueSyrup)).row, 0);
  });
});

describe('the shared catalog', () => {
  test('rows with no creator, and catalog rows, show to everyone', async () => {
    for (const who of ['stranger', 'member']) {
      assert.equal((await reads(who, ids.catalogLemon)).row, 1, who);
      assert.equal((await reads(who, ids.catalogFlagged)).row, 1, who);
    }
  });
});
