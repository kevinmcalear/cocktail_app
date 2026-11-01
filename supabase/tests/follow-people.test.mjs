// follow_people() (20261206120000_follow_people.sql): the names and pictures of
// the people linked to you by follows, either way, including those with no
// public page. Nobody else's; never a name made from an email; no picture a
// page hides; nobody blocked; anon can't call it. Runs through the real API
// against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL) || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run follow_people tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};

async function makeUser(label, meta) {
  const email = `${label}-${run}@follow-people-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const photo = (id) => `http://127.0.0.1:54321/storage/v1/object/public/avatars/${id}/me.jpg`;

before(async () => {
  await db.connect();
  users.me = await makeUser('me', { full_name: `Me ${run}` });
  // Follows me, no page at all, a full name and an account photo.
  users.fan = await makeUser('fan', { full_name: `Fan ${run}` });
  // I follow them; their private page hides its photo; first and last name only.
  users.quiet = await makeUser('quiet', { first_name: 'Quiet', last_name: run });
  // Follows me, no name anywhere: never the part of the email before @.
  users.nameless = await makeUser('nameless', {});
  // Follows me, then I block them.
  users.blocked = await makeUser('blocked', { full_name: `Blocked ${run}` });
  // Linked to nobody here.
  users.stranger = await makeUser('stranger', { full_name: `Stranger ${run}` });
  await service.auth.admin.updateUserById(users.fan.id, { user_metadata: { full_name: `Fan ${run}`, avatar_url: photo(users.fan.id) } });
  await service.auth.admin.updateUserById(users.quiet.id, { user_metadata: { first_name: 'Quiet', last_name: run, avatar_url: photo(users.quiet.id) } });
  const { error } = await service.from('profiles').insert({ kind: 'person', handle: `quiet${run}`, display_name: `Quiet page ${run}`, user_id: users.quiet.id, is_public: false });
  if (error) throw error;
  await db.query('UPDATE public.profiles SET shows_photo = false WHERE handle = $1', [`quiet${run}`]);
  for (const [who, whom] of [
    [users.fan, users.me],
    [users.nameless, users.me],
    [users.blocked, users.me],
    [users.me, users.quiet],
    [users.fan, users.stranger],
  ]) {
    assert.ifError((await who.client.from('follows').insert({ follower_id: who.id, followee_id: whom.id })).error);
  }
  assert.ifError((await users.me.client.from('user_blocks').insert({ blocker_id: users.me.id, blocked_id: users.blocked.id })).error);
});

after(async () => {
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}%`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('follow_people', () => {
  test('names the people linked to you either way, and which way', async () => {
    const { data, error } = await users.me.client.rpc('follow_people');
    assert.ifError(error);
    const byId = new Map((data ?? []).map((r) => [r.user_id, r]));
    assert.equal(byId.get(users.fan.id)?.display_name, `Fan ${run}`);
    assert.equal(byId.get(users.fan.id)?.follows_me, true);
    assert.equal(byId.get(users.fan.id)?.i_follow, false);
    assert.equal(byId.get(users.quiet.id)?.display_name, `Quiet ${run}`, 'first and last name');
    assert.equal(byId.get(users.quiet.id)?.i_follow, true);
  });

  test('pictures only from their own upload, and not when their page hides it', async () => {
    const { data } = await users.me.client.rpc('follow_people');
    const byId = new Map((data ?? []).map((r) => [r.user_id, r]));
    assert.equal(byId.get(users.fan.id)?.avatar_url, photo(users.fan.id));
    assert.equal(byId.get(users.quiet.id)?.avatar_url, null, 'shows_photo off');
  });

  test('never a name made from an email', async () => {
    const { data } = await users.me.client.rpc('follow_people');
    const nameless = (data ?? []).find((r) => r.user_id === users.nameless.id);
    assert.ok(nameless, 'still listed');
    assert.equal(nameless.display_name, null);
    assert.ok(!JSON.stringify(data).includes('follow-people-test'), 'no email in the result');
  });

  test('nobody blocked, and nobody not linked to you', async () => {
    const ids = ((await users.me.client.rpc('follow_people')).data ?? []).map((r) => r.user_id);
    assert.ok(!ids.includes(users.blocked.id), 'blocked');
    assert.ok(!ids.includes(users.stranger.id), 'the fan follows them, I don’t');
    assert.equal(((await users.stranger.client.rpc('follow_people')).data ?? []).some((r) => r.user_id === users.me.id), false, 'a stranger can’t list me');
    const strangers = ((await users.stranger.client.rpc('follow_people')).data ?? []).map((r) => r.user_id);
    assert.deepEqual(strangers, [users.fan.id], 'the stranger sees only their own follower');
  });

  test('signed out, it can’t be called', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error } = await anon.rpc('follow_people');
    assert.ok(error, 'anon has no execute grant');
  });
});
