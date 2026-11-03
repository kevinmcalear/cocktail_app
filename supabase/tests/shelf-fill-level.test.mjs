// A shelf bottle's fill level (20261206690000_shelf_fill_level.sql): the owner
// sets it through the existing home_bar_items policy, another person can't
// read or change it, and only full, half and low are allowed.
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
  throw new Error(`Refusing to run shelf fill level tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
let itemId;

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
  await db.connect();
  for (const label of ['owner', 'stranger']) users[label] = await makeUser(label);
  itemId = (await db.query("INSERT INTO public.items (name, item_type) VALUES ($1, 'ingredient') RETURNING id", [`Fill gin ${run}`])).rows[0].id;
  const { error } = await users.owner.client.from('home_bar_items').insert({ item_id: itemId });
  assert.ifError(error);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = $1', [itemId]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

const level = async (who) => {
  const { data, error } = await users[who].client.from('home_bar_items').select('fill_level').eq('item_id', itemId);
  assert.ifError(error);
  return data;
};

describe('a bottle on the shelf', () => {
  test('has no level until the owner sets one', async () => {
    assert.deepEqual(await level('owner'), [{ fill_level: null }]);
  });

  test('the owner sets and clears it', async () => {
    for (const fill_level of ['half', 'low', 'full', null]) {
      const { data, error } = await users.owner.client.from('home_bar_items').update({ fill_level }).eq('item_id', itemId).select('fill_level');
      assert.ifError(error);
      assert.deepEqual(data, [{ fill_level }]);
    }
  });

  test('another person can neither read nor change it', async () => {
    await users.owner.client.from('home_bar_items').update({ fill_level: 'low' }).eq('item_id', itemId);
    assert.deepEqual(await level('stranger'), []);
    const { data, error } = await users.stranger.client.from('home_bar_items').update({ fill_level: 'full' }).eq('item_id', itemId).select('fill_level');
    assert.ifError(error);
    assert.deepEqual(data, []);
    assert.deepEqual(await level('owner'), [{ fill_level: 'low' }]);
  });

  test('only full, half and low are allowed', async () => {
    const { error } = await users.owner.client.from('home_bar_items').update({ fill_level: 'empty' }).eq('item_id', itemId);
    assert.ok(error);
  });
});
