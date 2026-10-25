// My Bar's glassware and ice (20261117100000_home_glassware_ice.sql): each
// person's own, like home_kit_items. Others and anon read and write none;
// one main glass of a type; machine only for our machine.
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
  throw new Error(`Refusing to run home kit tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

before(async () => {
  for (const label of ['owner', 'other']) users[label] = await makeUser(label);
});

after(async () => {
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('home glassware', () => {
  test('the owner adds and reads their glasses; someone else and anon see none', async () => {
    const { data, error } = await users.owner.client.from('home_glassware').insert({ glass: 'coupe', name: 'Grandma’s coupes', source: 'ours', count: 6, is_default: true }).select('id, user_id').single();
    assert.equal(error, null);
    assert.equal(data.user_id, users.owner.id);
    assert.deepEqual((await users.other.client.from('home_glassware').select('id')).data, []);
    assert.deepEqual((await anon.from('home_glassware').select('id')).data ?? [], []);
    const { error: updateError, data: changed } = await users.other.client.from('home_glassware').update({ count: 1 }).eq('id', data.id).select('id');
    assert.equal(updateError, null);
    assert.deepEqual(changed, [], 'no rows of someone else to change');
  });

  test('nobody files a glass under someone else', async () => {
    const { error } = await users.other.client.from('home_glassware').insert({ user_id: users.owner.id, glass: 'rocks' });
    assert.ok(error, 'refused by the policy');
  });

  test('one main glass of a type', async () => {
    const { error } = await users.owner.client.from('home_glassware').insert({ glass: 'coupe', is_default: true });
    assert.ok(error, 'a second main coupe is refused');
  });
});

describe('home ice', () => {
  test('the owner adds their ice; someone else and anon see none', async () => {
    const { error } = await users.owner.client.from('home_ice').insert({ name: 'Clear rocks cube · 50 mm', shape: 'large', size_mm: 50, clear: true, source: 'machine', machine: 'Klaris' });
    assert.equal(error, null);
    assert.equal((await users.owner.client.from('home_ice').select('id')).data.length, 1);
    assert.deepEqual((await users.other.client.from('home_ice').select('id')).data, []);
    assert.deepEqual((await anon.from('home_ice').select('id')).data ?? [], []);
  });

  test('a machine only for our machine; drawn as only for cut to size and something else', async () => {
    assert.ok((await users.owner.client.from('home_ice').insert({ name: 'Cubes', shape: 'cubes', source: 'bought', machine: 'Freezer' })).error);
    assert.ok((await users.owner.client.from('home_ice').insert({ name: 'Cubes', shape: 'cubes', draw_as: 'large' })).error);
  });
});
