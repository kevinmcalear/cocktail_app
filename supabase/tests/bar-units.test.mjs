// A bar's unit (supabase/migrations/20261205700000_bar_units.sql):
// bars.spec_unit is ml until set, and only ml, oz, cl or g. Its people read
// it; only its Admins change it, directly or through update_bar_settings
// (which keeps it when p_spec_unit is left out). A Bartender, a Drink
// Creator, someone with the brand permission, another bar's people and a
// signed-out visitor can't change it, and outsiders can't read it. Runs
// through the real API against the local stack.
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
  throw new Error(`Refusing to run bar units tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

const LEVELS = { admin: 40, creator: 35, bartender: 30, branded: 20, guest: 10 };

async function makeUser(label) {
  const email = `${label}-${run}@bar-units-test.local`;
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

/** The bar's unit as the database has it. */
async function savedUnit() {
  const { data, error } = await service.from('bars').select('spec_unit').eq('id', ids.bar).single();
  assert.ifError(error);
  return data.spec_unit;
}

const settings = (client, extra = {}) =>
  client.rpc('update_bar_settings', {
    p_bar_id: ids.bar, p_name: `Units bar ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40, ...extra,
  });

before(async () => {
  for (const label of [...Object.keys(LEVELS), 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Units bar ${run}` })).id;
  for (const [label, level] of Object.entries(LEVELS)) await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: level });
  // An Employee whose level has the brand permission (Roles and access), so the bars policy lets them update the row.
  await insert('venue_level_overrides', { bar_id: ids.bar, base_level: 20, granted: ['brand'], revoked: [] });
  ids.other = (await insert('bars', { name: `Other units bar ${run}` })).id;
  await insert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
});

after(async () => {
  for (const id of [ids.bar, ids.other]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('the column', () => {
  test('a new bar reads in ml', async () => {
    assert.equal(await savedUnit(), 'ml');
  });

  test('only ml, oz, cl or g', async () => {
    const { error } = await service.from('bars').update({ spec_unit: 'tsp' }).eq('id', ids.bar);
    assert.match(error?.message ?? '', /bars_spec_unit_check/);
    assert.equal(await savedUnit(), 'ml');
  });
});

describe('its people read it, nobody else', () => {
  test('every member reads it, at any level', async () => {
    for (const label of Object.keys(LEVELS)) {
      const { data, error } = await users[label].client.from('bars').select('spec_unit').eq('id', ids.bar);
      assert.ifError(error);
      assert.deepEqual(data, [{ spec_unit: 'ml' }], label);
    }
  });

  test('another bar\'s Admin and a signed-out visitor read nothing', async () => {
    for (const [who, client] of [['stranger', users.stranger.client], ['anon', anon]]) {
      const { data, error } = await client.from('bars').select('spec_unit').eq('id', ids.bar);
      assert.ifError(error);
      assert.deepEqual(data, [], who);
    }
  });
});

describe('only its Admins set it', () => {
  test('an Admin sets it through update_bar_settings, and leaving it out keeps it', async () => {
    const set = await settings(users.admin.client, { p_spec_unit: 'oz' });
    assert.ifError(set.error);
    assert.equal(set.data.spec_unit, 'oz');
    assert.ifError((await settings(users.admin.client)).error);
    assert.equal(await savedUnit(), 'oz');
  });

  test('an Admin sets it directly', async () => {
    const { error } = await users.admin.client.from('bars').update({ spec_unit: 'cl' }).eq('id', ids.bar);
    assert.ifError(error);
    assert.equal(await savedUnit(), 'cl');
  });

  test('a Drink Creator, a Bartender, the brand permission and a Guest cannot, either way', async () => {
    for (const label of ['creator', 'bartender', 'branded', 'guest']) {
      const rpc = await settings(users[label].client, { p_spec_unit: 'g' });
      assert.match(rpc.error?.message ?? '', /must be a bar Admin/, label);
      // RLS hides the row from those who may not update bars at all; the brand permission reaches it and is refused.
      const { error } = await users[label].client.from('bars').update({ spec_unit: 'g' }).eq('id', ids.bar);
      if (label === 'branded') assert.match(error?.message ?? '', /Only an Admin/, label);
      assert.equal(await savedUnit(), 'cl', label);
    }
  });

  test('another bar\'s Admin and a signed-out visitor cannot', async () => {
    const rpc = await settings(users.stranger.client, { p_spec_unit: 'g' });
    assert.match(rpc.error?.message ?? '', /must be a bar Admin/);
    await users.stranger.client.from('bars').update({ spec_unit: 'g' }).eq('id', ids.bar);
    const signedOut = await settings(anon, { p_spec_unit: 'g' });
    assert.ok(signedOut.error, 'signed out cannot call update_bar_settings');
    await anon.from('bars').update({ spec_unit: 'g' }).eq('id', ids.bar);
    assert.equal(await savedUnit(), 'cl');
  });
});
