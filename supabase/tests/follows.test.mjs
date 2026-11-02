// Follows (20261205600000_follows.sql): you follow and unfollow as yourself;
// you see who you follow and who follows you, nobody else does; a blocked
// person can't be followed; friends_ranks shows only what each person shares
// (a public, age-checked profile, the drinks they show, dates they show), and
// marks their top drink of a family. Runs through the real API against the
// local stack.
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
  throw new Error(`Refusing to run follow tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@follow-test.local`;
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

before(async () => {
  await db.connect();
  for (const label of ['me', 'sam', 'quiet', 'stranger']) users[label] = await makeUser(label);
  for (const u of [users.sam, users.quiet]) {
    await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [u.id]);
  }
  ids.sam = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: `Sam ${run}`, user_id: users.sam.id, is_public: true })).id;
  ids.quiet = (await serviceInsert('profiles', { kind: 'person', handle: `quiet${run}`, display_name: `Quiet ${run}`, user_id: users.quiet.id, is_public: false })).id;
  await db.query("UPDATE public.profiles SET had_mode = 'all', shows_dates = true WHERE id = $1", [ids.sam]);
  ids.sour = (await serviceInsert('items', { item_type: 'cocktail', name: `Penicillin ${run}`, drink_family: 'sour' })).id;
  ids.sour2 = (await serviceInsert('items', { item_type: 'cocktail', name: `Whiskey Sour ${run}`, drink_family: 'sour' })).id;
  for (const [u, item, sentiment] of [
    [users.sam, ids.sour, 'loved'],
    [users.sam, ids.sour2, 'fine'],
    [users.quiet, ids.sour, 'loved'],
  ]) {
    const { error } = await u.client.from('rank_entries').insert({ item_id: item, ranked_as_item_id: item, sentiment, rank_key: 0, had_on: '2026-10-30' });
    assert.ifError(error);
  }
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('follows', () => {
  test('you follow as yourself, never as someone else', async () => {
    assert.ifError((await users.me.client.from('follows').insert({ follower_id: users.me.id, followee_id: users.sam.id })).error);
    assert.ifError((await users.me.client.from('follows').insert({ follower_id: users.me.id, followee_id: users.quiet.id })).error);
    assert.ok((await users.me.client.from('follows').insert({ follower_id: users.sam.id, followee_id: users.quiet.id })).error);
    assert.ok((await users.me.client.from('follows').insert({ follower_id: users.me.id, followee_id: users.me.id })).error, 'not yourself');
  });

  test('you and the person you follow see the follow; nobody else does', async () => {
    assert.equal((await users.me.client.from('follows').select('followee_id')).data?.length, 2);
    assert.equal((await users.sam.client.from('follows').select('follower_id').eq('followee_id', users.sam.id)).data?.length, 1);
    assert.equal((await users.stranger.client.from('follows').select('follower_id')).data?.length ?? 0, 0);
  });

  test('friends_ranks shows only what people share, and their best of a family', async () => {
    const { data, error } = await users.me.client.rpc('friends_ranks', { p_limit: 10 });
    assert.ifError(error);
    const mine = (data ?? []).filter((r) => r.name.endsWith(run));
    assert.deepEqual(mine.map((r) => r.profile_id).filter((p) => p === ids.quiet), [], 'a private profile shares nothing');
    const sams = mine.filter((r) => r.profile_id === ids.sam);
    assert.equal(sams.length, 2);
    assert.deepEqual(sams.filter((r) => r.best_in_family).map((r) => r.item_id), [ids.sour], 'one best sour: the higher-scored one');
    assert.equal((await users.stranger.client.rpc('friends_ranks', { p_limit: 10 })).data?.length ?? 0, 0, 'no follows, no ranks');
  });

  test('friends_ranks for one drink: every friend who shares a rank of it, dated or not', async () => {
    const forSour = async () => (await users.me.client.rpc('friends_ranks', { p_limit: 50, p_item_id: ids.sour })).data ?? [];
    const rows = await forSour();
    assert.deepEqual(rows.map((r) => [r.profile_id, r.item_id]), [[ids.sam, ids.sour]], 'only that drink, and the private profile shares nothing');
    assert.equal(rows[0].best_in_family, true, 'best of the family still looks at all their drinks');
    await db.query('UPDATE public.profiles SET shows_dates = false WHERE id = $1', [ids.sam]);
    try {
      const recent = (await users.me.client.rpc('friends_ranks', { p_limit: 50 })).data ?? [];
      assert.equal(recent.filter((r) => r.profile_id === ids.sam).length, 0, 'no date, not recent');
      const undated = await forSour();
      assert.equal(undated.length, 1, 'a rank without its date still counts for the drink');
      assert.equal(undated[0].created_at, null);
    } finally {
      await db.query('UPDATE public.profiles SET shows_dates = true WHERE id = $1', [ids.sam]);
    }
    assert.equal((await users.stranger.client.rpc('friends_ranks', { p_limit: 10, p_item_id: ids.sour })).data?.length ?? 0, 0, 'no follows, no ranks');
  });

  test('you unfollow your own follow only', async () => {
    await users.sam.client.from('follows').delete().eq('follower_id', users.me.id);
    assert.equal((await users.me.client.from('follows').select('followee_id')).data?.length, 2, 'Sam can’t remove my follow');
    assert.ifError((await users.me.client.from('follows').delete().eq('followee_id', users.quiet.id)).error);
    assert.equal((await users.me.client.from('follows').select('followee_id')).data?.length, 1);
  });
});
