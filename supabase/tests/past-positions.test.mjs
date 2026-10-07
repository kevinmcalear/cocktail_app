// Past jobs are opt-in, one at a time (20261007120000_past_positions_opt_in.sql):
// others read a person's current job, and a past one only once the person
// switches it on. The person, moderators and the bar's publishers still read
// every row, so they can fix them, but only the person can show one.
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run past position tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
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

const profile = (kind, handle, extra = {}) =>
  serviceInsert('profiles', { kind, handle: `${handle}${run}`, display_name: `${handle} ${run}`, is_public: true, ...extra });

/** The titles a client can read for a person, sorted. */
async function titles(client, personId) {
  const { data, error } = await client.from('profile_positions').select('title').eq('person_profile_id', personId);
  assert.ifError(error);
  return data.map((r) => r.title).sort();
}

const show = (client, id, is_shown) => client.from('profile_positions').update({ is_shown }).eq('id', id).select('id');

before(async () => {
  await db.connect();
  for (const label of ['person', 'publisher', 'stranger', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  ids.venue = (await serviceInsert('bars', { name: `Past Jobs Bar ${run}` })).id;
  await service.from('user_bars').insert({ user_id: users.publisher.id, bar_id: ids.venue, role_level: 40 });

  ids.nowBar = (await profile('bar', 'nowbar')).id;
  ids.oldBar = (await profile('bar', 'oldbar', { bar_id: ids.venue })).id;
  ids.olderBar = (await profile('bar', 'olderbar')).id;
  ids.person = (await profile('person', 'kim', { user_id: users.person.id })).id;
  ids.unclaimed = (await profile('person', 'jo')).id;
  for (const person of [ids.person, ids.unclaimed]) {
    await serviceInsert('profile_positions', { person_profile_id: person, bar_profile_id: ids.nowBar, title: 'Head bartender' });
    const old = await serviceInsert('profile_positions', { person_profile_id: person, bar_profile_id: ids.oldBar, title: 'Bartender', is_current: false });
    const older = await serviceInsert('profile_positions', { person_profile_id: person, bar_profile_id: ids.olderBar, title: 'Barback', is_current: false });
    if (person === ids.person) Object.assign(ids, { old: old.id, older: older.id });
    else ids.unclaimedOld = old.id;
  }
});

after(async () => {
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('past positions', () => {
  test('a past job starts hidden, seeded or added', async () => {
    const { data, error } = await service.from('profile_positions').select('is_shown').in('person_profile_id', [ids.person, ids.unclaimed]);
    assert.ifError(error);
    assert.ok(data.every((r) => r.is_shown === false));
  });

  test('signed out and other people read only the current job', async () => {
    for (const client of [anon, users.stranger.client]) {
      assert.deepEqual(await titles(client, ids.person), ['Head bartender']);
      assert.deepEqual(await titles(client, ids.unclaimed), ['Head bartender']);
    }
    // From the bar's side too: its former staff stay off "People".
    const { data } = await anon.from('profile_positions').select('title').eq('bar_profile_id', ids.oldBar);
    assert.deepEqual(data, []);
  });

  test("the person, a moderator and the bar's publishers still read past jobs", async () => {
    assert.deepEqual(await titles(users.person.client, ids.person), ['Barback', 'Bartender', 'Head bartender']);
    assert.deepEqual(await titles(users.moderator.client, ids.unclaimed), ['Barback', 'Bartender', 'Head bartender']);
    const { data } = await users.publisher.client.from('profile_positions').select('title').eq('bar_profile_id', ids.oldBar);
    assert.equal(data.length, 2);
  });

  test('the person shows one past job at a time, and can hide it again', async () => {
    const on = await show(users.person.client, ids.old, true);
    assert.ifError(on.error);
    assert.equal(on.data.length, 1);
    assert.deepEqual(await titles(anon, ids.person), ['Bartender', 'Head bartender']);
    assert.deepEqual(await titles(users.stranger.client, ids.person), ['Bartender', 'Head bartender']);

    const off = await show(users.person.client, ids.old, false);
    assert.ifError(off.error);
    assert.deepEqual(await titles(anon, ids.person), ['Head bartender']);
  });

  test("a moderator or the bar can't show someone's past job, but can hide one", async () => {
    for (const client of [users.moderator.client, users.publisher.client]) {
      const { error } = await show(client, ids.unclaimedOld, true);
      assert.equal(error?.code, '42501');
    }
    const added = await users.publisher.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.unclaimed, bar_profile_id: ids.oldBar, title: 'Bar manager', is_current: false, is_shown: true });
    assert.equal(added.error?.code, '42501');
    const { data } = await show(users.stranger.client, ids.older, true);
    assert.deepEqual(data, [], 'a stranger edits nothing');

    await show(users.person.client, ids.old, true);
    const hidden = await show(users.publisher.client, ids.old, false);
    assert.ifError(hidden.error);
    assert.deepEqual(await titles(anon, ids.person), ['Head bartender']);
  });
});
