// Venue feature switches (supabase/migrations/20261016800000_venue_feature_switches.sql):
// bars.enabled_features starts empty, the venue's members read it, only its
// Admins change it, other people can't see or change it, and only known keys
// are allowed.
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
  throw new Error(`Refusing to run venue feature switch tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

const users = {};
let barId;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const read = (client) => client.from('bars').select('enabled_features').eq('id', barId);
const write = (client, features) => client.from('bars').update({ enabled_features: features }).eq('id', barId).select('enabled_features');
const stored = async () => (await service.from('bars').select('enabled_features').eq('id', barId).single()).data.enabled_features;

before(async () => {
  for (const label of ['admin', 'creator', 'bartender', 'stranger']) users[label] = await makeUser(label);
  const { data, error } = await service.from('bars').insert({ name: `Switches bar ${run}` }).select('id').single();
  if (error) throw error;
  barId = data.id;
  for (const [label, role_level] of [['admin', 40], ['creator', 35], ['bartender', 30]]) {
    const { error: e } = await service.from('user_bars').insert({ user_id: users[label].id, bar_id: barId, role_level });
    if (e) throw e;
  }
});

after(async () => {
  if (barId) await service.from('bars').delete().eq('id', barId);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('venue feature switches', () => {
  test('a venue starts with no extras', async () => {
    assert.deepEqual(await stored(), []);
  });

  test('members read the switches; strangers and signed-out visitors see no row', async () => {
    for (const label of ['admin', 'creator', 'bartender']) {
      const { data, error } = await read(users[label].client);
      assert.ifError(error);
      assert.deepEqual(data, [{ enabled_features: [] }], `${label} reads them`);
    }
    for (const client of [users.stranger.client, anon]) {
      const { data, error } = await read(client);
      assert.ok(error || data.length === 0, 'no row');
    }
  });

  test('only an Admin changes them', async () => {
    for (const label of ['creator', 'bartender', 'stranger']) {
      const { data, error } = await write(users[label].client, ['tonight']);
      assert.ok(error || data.length === 0, `${label} is refused`);
    }
    const anonWrite = await write(anon, ['tonight']);
    assert.ok(anonWrite.error || anonWrite.data.length === 0, 'signed out is refused');
    assert.deepEqual(await stored(), [], 'nothing changed');

    const { data, error } = await write(users.admin.client, ['tonight', 'prep']);
    assert.ifError(error);
    assert.deepEqual(data, [{ enabled_features: ['tonight', 'prep'] }]);
    const seen = await read(users.bartender.client);
    assert.deepEqual(seen.data, [{ enabled_features: ['tonight', 'prep'] }], 'the team sees the change');
  });

  test('only known keys are stored', async () => {
    const { error } = await write(users.admin.client, ['tonight', 'nightclub']);
    assert.ok(error, 'an unknown key is refused');
    assert.deepEqual(await stored(), ['tonight', 'prep']);
    const nulls = await write(users.admin.client, null);
    assert.ok(nulls.error, 'null is refused');
  });
});
