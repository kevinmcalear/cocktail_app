// Row-level security for a venue's stock list
// (supabase/migrations/20261101100000_bar_stock.sql): staff read it; people
// who can place items on the back bar add and take off bottles; nobody else.
// Runs through the real API as real users.
//
//   supabase start && supabase db reset
//   npm run test:security
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
  throw new Error(`Refusing to run stock list tests against a non-local API: ${status.API_URL}`);
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

const stocked = async (client, bar = ids.bar) => {
  const { data, error } = await client.from('bar_stock').select('item_id').eq('bar_id', bar);
  assert.ifError(error);
  return new Set(data.map((r) => r.item_id));
};

const add = (label, itemId, bar = ids.bar) =>
  users[label].client.from('bar_stock').insert({ bar_id: bar, item_id: itemId, added_from: `Ash Garden ${run}` }).select('item_id');

before(async () => {
  await db.connect();
  for (const label of ['admin', 'maker', 'bartender', 'floor', 'guest', 'barback', 'otherAdmin', 'outsider']) {
    users[label] = await makeUser(label);
  }
  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  ids.barbackRole = (await serviceInsert('venue_roles', { bar_id: ids.bar, name: 'Barback', base_level: 20, granted: ['prep'] })).id;
  for (const [label, bar, level, role] of [
    ['admin', ids.bar, 40],
    ['maker', ids.bar, 35],
    ['bartender', ids.bar, 30],
    ['floor', ids.bar, 20],
    ['guest', ids.bar, 10],
    ['barback', ids.bar, 20, ids.barbackRole],
    ['otherAdmin', ids.otherBar, 40],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: bar, role_level: level, venue_role_id: role ?? null });
  }
  ids.mezcal = (await serviceInsert('items', { name: `Del Maguey Vida ${run}`, item_type: 'ingredient', created_by: null })).id;
  ids.campari = (await serviceInsert('items', { name: `Campari ${run}`, item_type: 'ingredient', created_by: null })).id;
  ids.agave = (await serviceInsert('items', { name: `Agave syrup ${run}`, item_type: 'ingredient', created_by: null })).id;
  // Another bar's own bottle: not usable here.
  ids.theirs = (await serviceInsert('items', { name: `Moth house gin ${run}`, item_type: 'ingredient', bar_id: ids.otherBar })).id;
  await serviceInsert('bar_stock', { bar_id: ids.bar, item_id: ids.campari, added_by: users.admin.id });
  await serviceInsert('bar_stock', { bar_id: ids.otherBar, item_id: ids.campari, added_by: users.otherAdmin.id });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('bar stock: reading', () => {
  test('staff from Employee up read their own bar', async () => {
    for (const label of ['admin', 'maker', 'bartender', 'floor', 'barback']) {
      assert.ok((await stocked(users[label].client)).has(ids.campari), label);
    }
  });

  test('guests, other bars, outsiders and anon read nothing', async () => {
    for (const label of ['guest', 'otherAdmin', 'outsider']) {
      assert.equal((await stocked(users[label].client)).size, 0, label);
    }
    const { data } = await anon.from('bar_stock').select('item_id').eq('bar_id', ids.bar);
    assert.equal((data ?? []).length, 0);
    // The other bar's own list stays its own.
    assert.equal((await stocked(users.admin.client, ids.otherBar)).size, 0);
  });
});

describe('bar stock: adding and taking off', () => {
  test('Drink Creators and up, and a role with prep, add a bottle', async () => {
    for (const label of ['admin', 'maker', 'barback']) {
      const { error } = await add(label, ids.mezcal);
      assert.ifError(error);
      const { rows } = await db.query('SELECT added_by, added_from FROM public.bar_stock WHERE bar_id = $1 AND item_id = $2', [ids.bar, ids.mezcal]);
      assert.equal(rows[0].added_by, users[label].id, label);
      assert.equal(rows[0].added_from, `Ash Garden ${run}`);
      const { error: offError } = await users[label].client.from('bar_stock').delete().eq('bar_id', ids.bar).eq('item_id', ids.mezcal).select('item_id');
      assert.ifError(offError);
      assert.equal((await stocked(users.admin.client)).has(ids.mezcal), false, label);
    }
  });

  test('bartenders, floor staff, guests, other bars and outsiders cannot add', async () => {
    for (const label of ['bartender', 'floor', 'guest', 'otherAdmin', 'outsider']) {
      const { error } = await add(label, ids.agave);
      assert.ok(error, `${label} added a bottle`);
    }
    const { error } = await anon.from('bar_stock').insert({ bar_id: ids.bar, item_id: ids.agave });
    assert.ok(error);
    assert.equal((await stocked(users.admin.client)).has(ids.agave), false);
  });

  test('nobody adds in someone else’s name', async () => {
    const { error } = await users.maker.client.from('bar_stock').insert({ bar_id: ids.bar, item_id: ids.agave, added_by: users.admin.id });
    assert.ok(error);
  });

  test('another bar’s own bottle cannot go on this back bar', async () => {
    const { error } = await add('admin', ids.theirs);
    assert.ok(error);
  });

  test('those who cannot place items cannot take a bottle off', async () => {
    for (const label of ['bartender', 'floor', 'guest', 'otherAdmin', 'outsider']) {
      const { data, error } = await users[label].client.from('bar_stock').delete().eq('bar_id', ids.bar).eq('item_id', ids.campari).select('item_id');
      assert.ifError(error);
      assert.equal(data.length, 0, label);
    }
    assert.ok((await stocked(users.admin.client)).has(ids.campari));
  });

  test('rows are never updated, only added or taken off', async () => {
    const { data } = await users.admin.client.from('bar_stock').update({ added_from: 'Changed' }).eq('bar_id', ids.bar).eq('item_id', ids.campari).select('item_id');
    assert.equal((data ?? []).length, 0);
    const { rows } = await db.query('SELECT added_from FROM public.bar_stock WHERE bar_id = $1 AND item_id = $2', [ids.bar, ids.campari]);
    assert.equal(rows[0].added_from, null);
  });
});
