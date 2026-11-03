// Ingredients | Steps on the account
// (supabase/migrations/20261205810000_spec_view_pref.sql): user_prefs.spec_view
// is each person's own. Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run spec view tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@spec-view-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

before(async () => {
  for (const label of ['bartender', 'stranger']) users[label] = await makeUser(label);
});

after(async () => {
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('user_prefs.spec_view', () => {
  test('a person saves and reads their own pick', async () => {
    const { client, id } = users.bartender;
    assert.ifError((await client.from('user_prefs').upsert({ user_id: id, spec_view: 'ingredients' })).error);
    const { data, error } = await client.from('user_prefs').select('spec_view').maybeSingle();
    assert.ifError(error);
    assert.equal(data.spec_view, 'ingredients');
  });

  test('only ingredients or steps', async () => {
    const { client, id } = users.bartender;
    const { error } = await client.from('user_prefs').upsert({ user_id: id, spec_view: 'rows' });
    assert.match(error?.message ?? '', /spec_view_check/);
  });

  test('nobody else reads or writes it', async () => {
    const { data } = await users.stranger.client.from('user_prefs').select('spec_view').eq('user_id', users.bartender.id);
    assert.deepEqual(data, []);
    await users.stranger.client.from('user_prefs').update({ spec_view: 'steps' }).eq('user_id', users.bartender.id);
    const write = await users.stranger.client.from('user_prefs').upsert({ user_id: users.bartender.id, spec_view: 'steps' });
    assert.ok(write.error, 'upsert over someone else refused');
    const read = await anon.from('user_prefs').select('spec_view').eq('user_id', users.bartender.id);
    assert.ok(read.error || !read.data?.length);
    const saved = await service.from('user_prefs').select('spec_view').eq('user_id', users.bartender.id).single();
    assert.equal(saved.data.spec_view, 'ingredients');
  });
});
