// Security tests for 20261017700000_bar_edits_credited_drinks: a Drink
// Creator or above at a bar edits the shared drinks credited to that bar
// (the drink, its steps and its drawing), the drink stays shared and credited, and nobody
// else gains anything.
//
//   supabase start && supabase db reset
//   node --test supabase/tests/credited-drink-editing.test.mjs
//
// Every fixture is named with a per-run id and removed afterwards.

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
  throw new Error(`Refusing to run credited drink tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
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

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const barProfile = (name, barId) => ({ kind: 'bar', handle: `${name}.${run}`, display_name: `${name} ${run}`, bar_id: barId, is_public: true });
const credited = (name, profileId) =>
  serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: profileId });
const row = async (id) => (await db.query('SELECT name, description, bar_id, created_by, is_catalog, origin_bar_profile_id FROM public.items WHERE id = $1', [id])).rows[0];
const canEdit = async (client, itemId) => {
  const { data, error } = await client.rpc('can_edit_item', { p_item_id: itemId });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['creator', 'bartender', 'otherStaff', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Cottage ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Elsewhere ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await serviceInsert('user_bars', { user_id: users.otherStaff.id, bar_id: ids.otherBar, role_level: 40 });
  ids.profile = (await serviceInsert('profiles', barProfile('cottage', ids.bar))).id;
  ids.otherProfile = (await serviceInsert('profiles', barProfile('elsewhere', ids.otherBar))).id;

  ids.drink = (await credited('Cottage Martini', ids.profile)).id;
  ids.otherDrink = (await credited('Elsewhere Sour', ids.otherProfile)).id;
  ids.classic = (await serviceInsert('items', { name: `Classic Daiquiri ${run}`, item_type: 'cocktail', is_catalog: true })).id;
  await serviceInsert('item_steps', { item_id: ids.drink, position: 1, body: 'Stir with ice.' });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe("the bar's Drink Creator", () => {
  test('is offered editing for its credited drink only', async () => {
    const client = users.creator.client;
    assert.equal(await canEdit(client, ids.drink), true);
    assert.equal(await canEdit(client, ids.otherDrink), false);
    assert.equal(await canEdit(client, ids.classic), false);
  });

  test('edits the drink, its notes and its steps, and it stays shared and credited', async () => {
    const client = users.creator.client;
    const edit = await client
      .from('items')
      .update({ name: `Cottage Martini, wet ${run}`, description: 'Two to one.' })
      .eq('id', ids.drink)
      .select('id');
    assert.ifError(edit.error);
    assert.equal(edit.data.length, 1);
    assert.deepEqual(await row(ids.drink), {
      name: `Cottage Martini, wet ${run}`,
      description: 'Two to one.',
      bar_id: null,
      created_by: null,
      is_catalog: false,
      origin_bar_profile_id: ids.profile,
    });
    const written = await client.from('item_notes').insert({ item_id: ids.drink, body: 'Lemon oil, discard.' });
    assert.ifError(written.error);
    const notes = await db.query('SELECT body FROM public.item_notes WHERE item_id = $1', [ids.drink]);
    assert.deepEqual(notes.rows, [{ body: 'Lemon oil, discard.' }]);

    const step = await client.from('item_steps').update({ body: 'Stir 30 seconds.' }).eq('item_id', ids.drink).select('body');
    assert.ifError(step.error);
    assert.deepEqual(step.data, [{ body: 'Stir 30 seconds.' }]);
    const added = await client.from('item_steps').insert({ item_id: ids.drink, position: 2, body: 'Express lemon.' });
    assert.ifError(added.error);
  });

  test('draws its sketch, which nobody else can', async () => {
    const inputs = {
      v: 2, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 },
      foam: null, float: null, bleed: null, fizz: false, garnish: 'orange_peel',
      from: { glass: 'data', ice: 'data', method: 'data', liquid: 'rules', garnish: 'rules' }, coverage: 1,
    };
    const drawn = await users.creator.client.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: inputs });
    assert.ifError(drawn.error);
    assert.equal(drawn.data, true);
    for (const client of [users.bartender.client, users.otherStaff.client]) {
      const { data } = await client.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: inputs });
      assert.equal(data, false);
    }
  });

  test("can't take the drink as their own or their venue's, or move its credit away", async () => {
    const client = users.creator.client;
    for (const change of [{ created_by: users.creator.id }, { bar_id: ids.bar }, { origin_bar_profile_id: ids.otherProfile }, { origin_bar_profile_id: null }]) {
      const { error } = await client.from('items').update(change).eq('id', ids.drink);
      assert.ok(error, `${Object.keys(change)[0]} refused`);
    }
    const now = await row(ids.drink);
    assert.equal(now.bar_id, null);
    assert.equal(now.created_by, null);
    assert.equal(now.origin_bar_profile_id, ids.profile);
  });

  test("can't delete it or make it a catalog drink", async () => {
    const client = users.creator.client;
    const drop = await client.from('items').delete().eq('id', ids.drink).select('id');
    assert.deepEqual(drop.data ?? [], []);
    const catalog = await client.from('items').update({ is_catalog: true }).eq('id', ids.drink);
    assert.ok(catalog.error);
    assert.ok(await row(ids.drink));
  });
});

describe('everyone else', () => {
  test("a Bartender at the bar, another venue's admin, a stranger and anon edit nothing", async () => {
    for (const client of [users.bartender.client, users.otherStaff.client, users.stranger.client]) {
      assert.equal(await canEdit(client, ids.drink), false);
      const edit = await client.from('items').update({ description: 'Sneaky' }).eq('id', ids.drink).select('id');
      assert.deepEqual(edit.data ?? [], []);
      const step = await client.from('item_steps').insert({ item_id: ids.drink, position: 9, body: 'Sneaky' });
      assert.ok(step.error);
    }
    const edit = await anon.from('items').update({ description: 'Sneaky' }).eq('id', ids.drink).select('id');
    assert.deepEqual(edit.data ?? [], []);
    assert.equal((await row(ids.drink)).description, 'Two to one.');
  });

  test("other venues' staff still edit their own credited drinks, not this bar's", async () => {
    const client = users.otherStaff.client;
    assert.equal(await canEdit(client, ids.otherDrink), true);
    const edit = await client.from('items').update({ description: 'Ours.' }).eq('id', ids.otherDrink).select('id');
    assert.ifError(edit.error);
    assert.equal(edit.data.length, 1);
  });
});
