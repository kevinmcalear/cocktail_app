// "New at <venue>" (supabase/migrations/20261027100000_venue_feature_events.sql):
// switching a venue feature on or off records who did it, by trigger; the
// venue's members read those rows, strangers and signed-out visitors see none,
// and nobody writes, changes or deletes them directly.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run venue feature event tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

const users = {};
let barId;
let otherBarId;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const switches = (client, features, id = barId) => client.from('bars').update({ enabled_features: features }).eq('id', id).select('id');
const events = (client, id = barId) => client.from('venue_feature_events').select('feature, enabled, by_user').eq('bar_id', id).order('at').order('feature');
const stored = async (id = barId) => (await events(service, id)).data;

before(async () => {
  for (const label of ['admin', 'bartender', 'stranger', 'otherAdmin']) users[label] = await makeUser(label);
  const { data, error } = await service.from('bars').insert([{ name: `News bar ${run}` }, { name: `Other news bar ${run}` }]).select('id, name');
  if (error) throw error;
  barId = data.find((b) => b.name.startsWith('News')).id;
  otherBarId = data.find((b) => b.name.startsWith('Other')).id;
  for (const [label, bar, role_level] of [['admin', barId, 40], ['bartender', barId, 30], ['otherAdmin', otherBarId, 40]]) {
    const { error: e } = await service.from('user_bars').insert({ user_id: users[label].id, bar_id: bar, role_level });
    if (e) throw e;
  }
});

after(async () => {
  for (const id of [barId, otherBarId]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('venue feature events', () => {
  test('a new venue has none', async () => {
    assert.deepEqual(await stored(), []);
  });

  test('switching records who turned what on or off, one row per change', async () => {
    const on = await switches(users.admin.client, ['tonight', 'prep']);
    assert.ifError(on.error);
    assert.deepEqual(await stored(), [
      { feature: 'prep', enabled: true, by_user: users.admin.id },
      { feature: 'tonight', enabled: true, by_user: users.admin.id },
    ]);
    const swap = await switches(users.admin.client, ['tonight', 'study']);
    assert.ifError(swap.error);
    const rows = await stored();
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.slice(2).sort((a, b) => a.feature.localeCompare(b.feature)),
      [
        { feature: 'prep', enabled: false, by_user: users.admin.id },
        { feature: 'study', enabled: true, by_user: users.admin.id },
      ],
      'Prep off and Study on; Tonight, unchanged, makes no row',
    );
    const same = await switches(users.admin.client, ['tonight', 'study']);
    assert.ifError(same.error);
    assert.equal((await stored()).length, 4, 'saving the same switches records nothing');
  });

  test('a refused switch records nothing', async () => {
    const { data } = await switches(users.bartender.client, ['tonight', 'study', 'history']);
    assert.equal(data?.length ?? 0, 0, 'a Bartender cannot switch');
    await switches(users.stranger.client, ['history']);
    assert.equal((await stored()).length, 4);
  });

  test('members read their venue’s rows; strangers, other venues and signed-out visitors see none', async () => {
    for (const label of ['admin', 'bartender']) {
      const { data, error } = await events(users[label].client);
      assert.ifError(error);
      assert.equal(data.length, 4, `${label} reads them`);
    }
    for (const client of [users.stranger.client, users.otherAdmin.client]) {
      const { data, error } = await events(client);
      assert.ifError(error);
      assert.deepEqual(data, [], 'no rows');
    }
    const signedOut = await events(anon);
    assert.ok(signedOut.error || signedOut.data.length === 0, 'signed out sees nothing');
  });

  test('nobody writes, changes or deletes rows directly', async () => {
    for (const client of [users.admin.client, users.bartender.client, users.stranger.client, anon]) {
      const insert = await client.from('venue_feature_events').insert({ bar_id: barId, feature: 'backBar', enabled: true, by_user: users.admin.id });
      assert.ok(insert.error, 'insert is refused');
      const update = await client.from('venue_feature_events').update({ by_user: users.bartender.id }).eq('bar_id', barId).select('id');
      assert.ok(update.error || update.data.length === 0, 'update is refused');
      const del = await client.from('venue_feature_events').delete().eq('bar_id', barId).select('id');
      assert.ok(del.error || del.data.length === 0, 'delete is refused');
    }
    const rows = await stored();
    assert.equal(rows.length, 4, 'nothing changed');
    assert.ok(rows.every((r) => r.by_user === users.admin.id));
  });

  test('the trigger function is not callable by clients', async () => {
    for (const client of [users.admin.client, anon]) {
      const { error } = await client.schema('private').rpc('record_venue_feature_events');
      assert.ok(error, 'refused');
    }
  });
});
