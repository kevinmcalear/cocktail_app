// follow_people() (20261206120000_follow_people.sql): the names and pictures of
// the people who follow you, including those with no public page. Never the
// people you follow (anyone can follow anyone by id); the name they gave (their
// page's, else their account's), never one made from an email or held by
// moderation; no picture a page hides; nobody blocked; anon can't call it.
// Runs through the real API against the local stack.
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

async function page(user, label, extra = {}) {
  const { error } = await service.from('profiles').insert({ kind: 'person', handle: `${label}${run}`, display_name: `${label} page ${run}`, user_id: user.id, is_public: false });
  if (error) throw error;
  for (const [column, value] of Object.entries(extra)) await db.query(`UPDATE public.profiles SET ${column} = $1 WHERE handle = $2`, [value, `${label}${run}`]);
}

before(async () => {
  await db.connect();
  users.me = await makeUser('me', { full_name: `Me ${run}` });
  // Follows me, no page at all, a full name and an account photo.
  users.fan = await makeUser('fan', { full_name: `Fan ${run}` });
  // Follows me; a private page (its name wins over the account's) that hides its photo.
  users.quiet = await makeUser('quiet', { full_name: `Legal Name ${run}` });
  // Follows me; first and last name only, a page held by moderation.
  users.held = await makeUser('held', { first_name: 'Held', last_name: run });
  // Follows me, no name anywhere: never the part of the email before @.
  users.nameless = await makeUser('nameless', {});
  // Follows me, then I block them.
  users.blocked = await makeUser('blocked', { full_name: `Blocked ${run}` });
  // I follow them; they don't follow me.
  users.followed = await makeUser('followed', { full_name: `Followed ${run}` });
  await service.auth.admin.updateUserById(users.fan.id, { user_metadata: { full_name: `Fan ${run}`, avatar_url: photo(users.fan.id) } });
  await service.auth.admin.updateUserById(users.quiet.id, { user_metadata: { full_name: `Legal Name ${run}`, avatar_url: photo(users.quiet.id) } });
  await page(users.quiet, 'quiet', { shows_photo: false });
  await page(users.held, 'held', { moderated_at: new Date().toISOString() });
  for (const who of [users.fan, users.quiet, users.held, users.nameless, users.blocked]) {
    assert.ifError((await who.client.from('follows').insert({ follower_id: who.id, followee_id: users.me.id })).error);
  }
  assert.ifError((await users.me.client.from('follows').insert({ follower_id: users.me.id, followee_id: users.followed.id })).error);
  assert.ifError((await users.me.client.from('user_blocks').insert({ blocker_id: users.me.id, blocked_id: users.blocked.id })).error);
});

after(async () => {
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}%`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

const listFor = async (user) => {
  const { data, error } = await user.client.rpc('follow_people');
  assert.ifError(error);
  return new Map((data ?? []).map((r) => [r.user_id, r]));
};

describe('follow_people', () => {
  test('names the people who follow you, with the name they gave', async () => {
    const byId = await listFor(users.me);
    assert.equal(byId.get(users.fan.id)?.display_name, `Fan ${run}`, 'no page: the account name');
    assert.equal(byId.get(users.quiet.id)?.display_name, `quiet page ${run}`, 'their page’s name before their account’s');
    assert.equal(byId.get(users.held.id)?.display_name, `Held ${run}`, 'a page held by moderation is skipped');
  });

  test('never the people you follow', async () => {
    const byId = await listFor(users.me);
    assert.equal(byId.has(users.followed.id), false);
    assert.equal((await listFor(users.followed)).has(users.me.id), true, 'they see me, since I follow them');
  });

  test('pictures only from their own upload, and not when their page hides it', async () => {
    const byId = await listFor(users.me);
    assert.equal(byId.get(users.fan.id)?.avatar_url, photo(users.fan.id));
    assert.equal(byId.get(users.quiet.id)?.avatar_url, null, 'shows_photo off');
  });

  test('never a name made from an email', async () => {
    const byId = await listFor(users.me);
    assert.ok(byId.has(users.nameless.id), 'still listed');
    assert.equal(byId.get(users.nameless.id).display_name, null);
    assert.ok(!JSON.stringify([...byId.values()]).includes('follow-people-test'), 'no email in the result');
  });

  test('nobody blocked; nothing for someone nobody follows', async () => {
    assert.equal((await listFor(users.me)).has(users.blocked.id), false);
    assert.equal((await listFor(users.fan)).size, 0);
  });

  test('signed out, it can’t be called', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    assert.ok((await anon.rpc('follow_people')).error, 'anon has no execute grant');
  });
});
