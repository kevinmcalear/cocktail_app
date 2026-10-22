// The back bar's stock list (20261101100000_back_bar_stock.sql): members of
// the venue read it; adding and removing goes with placing items, so Create
// and edit drinks or Prep list and orders. Runs through the real API against
// the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run back bar stock tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// edit_drinks comes with Drink Creator (35); prep too, and a bar's own role can grant it lower down.
const ROLES = { guest: 10, bartender: 30, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@stock-list-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const stock = (who, itemId, extra = {}) =>
  users[who].client.from('back_bar_items').insert({ bar_id: ids.bar, item_id: itemId, source: 'drink', from_name: 'Ash Garden', added_by: users[who].id, ...extra });

const visible = async (who) => {
  const { data, error } = await users[who].client.from('back_bar_items').select('item_id').eq('bar_id', ids.bar);
  assert.ifError(error);
  return new Set(data.map((r) => r.item_id));
};

before(async () => {
  for (const label of [...Object.keys(ROLES), 'prepCrew', 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Stock bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  // An Employee whose role at this bar adds Prep list and orders.
  const role = await insert('venue_roles', { bar_id: ids.bar, name: `Prep crew ${run}`, base_level: 20, granted: ['prep'] });
  await insert('user_bars', { user_id: users.prepCrew.id, bar_id: ids.bar, role_level: 20, venue_role_id: role.id });
  ids.mezcal = (await insert('items', { name: `Mezcal ${run}`, item_type: 'ingredient' })).id;
  ids.campari = (await insert('items', { name: `Campari ${run}`, item_type: 'ingredient' })).id;
  ids.theirs = (await insert('items', { name: `Their cordial ${run}`, item_type: 'ingredient', bar_id: ids.otherBar })).id;
  ids.seeded = (await insert('back_bar_items', { bar_id: ids.bar, item_id: ids.campari, source: 'setup' })).id;
});

after(async () => {
  for (const id of [ids.mezcal, ids.campari, ids.theirs]) if (id) await service.from('items').delete().eq('id', id);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('back bar stock list', () => {
  test('every member of the venue reads it; an outsider does not', async () => {
    for (const who of Object.keys(ROLES)) assert.ok((await visible(who)).has(ids.campari), who);
    assert.equal((await visible('outsider')).size, 0);
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { data } = await anon.from('back_bar_items').select('item_id').eq('bar_id', ids.bar);
    assert.equal(data?.length ?? 0, 0, 'signed out sees nothing');
  });

  test('a Drink Creator adds a bottle, signed and dated; it reads back with where it came from', async () => {
    const { error } = await stock('creator', ids.mezcal);
    assert.ifError(error);
    const { data, error: readError } = await users.guest.client.from('back_bar_items').select('source, from_name, added_by, added_at').eq('item_id', ids.mezcal).single();
    assert.ifError(readError);
    assert.equal(data.source, 'drink');
    assert.equal(data.from_name, 'Ash Garden');
    assert.equal(data.added_by, users.creator.id);
    assert.ok(data.added_at);
    const twice = await stock('creator', ids.mezcal);
    assert.equal(twice.error?.code, '23505', 'a bottle is on the list once');
  });

  test('without the permission a member can neither add nor remove', async () => {
    for (const who of ['guest', 'bartender']) {
      const { error } = await stock(who, ids.mezcal, { bar_id: ids.bar });
      assert.ok(error, `${who} cannot add`);
      const removed = await users[who].client.from('back_bar_items').delete().eq('item_id', ids.mezcal).select('id');
      assert.ifError(removed.error);
      assert.equal(removed.data.length, 0, `${who} cannot remove`);
    }
    const outsider = await stock('outsider', ids.mezcal);
    assert.ok(outsider.error, 'an outsider cannot add');
    const updated = await users.creator.client.from('back_bar_items').update({ from_name: 'Changed' }).eq('item_id', ids.mezcal).select('id');
    assert.ok(updated.error || updated.data.length === 0, 'rows are never edited, only added or removed');
  });

  test('Prep list and orders is enough: a role that grants it adds and removes', async () => {
    const removed = await users.prepCrew.client.from('back_bar_items').delete().eq('item_id', ids.mezcal).select('id');
    assert.ifError(removed.error);
    assert.equal(removed.data.length, 1);
    const { error } = await stock('prepCrew', ids.mezcal);
    assert.ifError(error);
  });

  test('a row is signed by whoever adds it, and only for items the bar can use', async () => {
    await service.from('back_bar_items').delete().eq('item_id', ids.mezcal);
    const forged = await stock('creator', ids.mezcal, { added_by: users.guest.id });
    assert.ok(forged.error, 'added_by must be the caller');
    const theirs = await stock('creator', ids.theirs);
    assert.ok(theirs.error, "another bar's own item cannot go on this back bar");
    const bad = await stock('creator', ids.mezcal, { source: 'somewhere' });
    assert.ok(bad.error, 'source is one of drink, setup, back_bar');
  });
});
