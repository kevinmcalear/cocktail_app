// A job on a profile shows only once the person and the bar have both said
// yes (20261008720000_position_acceptance.sql). Until then only the two
// sides and moderators read it.
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
  throw new Error(`Refusing to run position acceptance tests against a non-local API: ${status.API_URL}`);
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

async function profile(kind, handle, extra = {}) {
  const { rows } = await db.query(
    'INSERT INTO public.profiles (kind, handle, display_name, is_public, user_id, bar_id) VALUES ($1, $2, $3, true, $4, $5) RETURNING id',
    [kind, `${handle}${run}`, `${handle} ${run}`, extra.user_id ?? null, extra.bar_id ?? null]
  );
  return rows[0].id;
}

/** Adds a job as a client and returns the row as stored. */
async function add(who, person, bar, title, isCurrent = true) {
  const { data, error } = await users[who].client
    .from('profile_positions')
    .insert({ person_profile_id: person, bar_profile_id: bar, title, is_current: isCurrent })
    .select('id')
    .single();
  assert.ifError(error);
  return stored(data.id);
}

const stored = async (id) =>
  (await db.query('SELECT id, title, person_accepted, bar_accepted FROM public.profile_positions WHERE id = $1', [id])).rows[0];

/** Whether a client can read a job. */
async function reads(client, id) {
  const { data, error } = await client.from('profile_positions').select('id').eq('id', id);
  assert.ifError(error);
  return data.length === 1;
}

const accept = (who, id) => users[who].client.rpc('accept_profile_position', { p_id: id });
const decline = (who, id) => users[who].client.rpc('decline_profile_position', { p_id: id });

before(async () => {
  await db.connect();
  for (const label of ['person', 'admin', 'creator', 'staffer', 'stranger', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  ids.venue = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Acceptance Bar ${run}`])).rows[0].id;
  for (const [who, level] of [['admin', 40], ['creator', 35], ['staffer', 20]]) {
    await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, $3)', [ids.venue, users[who].id, level]);
  }
  ids.bar = await profile('bar', 'acceptbar', { bar_id: ids.venue });
  ids.wildBar = await profile('bar', 'wildbar');
  ids.person = await profile('person', 'kim', { user_id: users.person.id });
  ids.staffer = await profile('person', 'sam', { user_id: users.staffer.id });
  ids.unclaimed = await profile('person', 'jo');
});

after(async () => {
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.venue]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a job someone adds themselves', () => {
  test('rows written by SQL or the service role are accepted, like every existing row', async () => {
    const { data, error } = await service
      .from('profile_positions')
      .insert({ person_profile_id: ids.unclaimed, bar_profile_id: ids.wildBar, title: 'Founder' })
      .select('id')
      .single();
    assert.ifError(error);
    assert.deepEqual(await stored(data.id), { id: data.id, title: 'Founder', person_accepted: true, bar_accepted: true });
    assert.equal(await reads(anon, data.id), true);
  });

  test('waits for the bar, hidden from everyone but the person and the bar\'s Admins', async () => {
    const row = await add('person', ids.person, ids.bar, 'Bartender');
    ids.selfAdded = row.id;
    assert.equal(row.person_accepted, true);
    assert.equal(row.bar_accepted, false);
    for (const client of [anon, users.stranger.client, users.creator.client, users.staffer.client]) {
      assert.equal(await reads(client, row.id), false);
    }
    assert.equal(await reads(users.person.client, row.id), true);
    assert.equal(await reads(users.admin.client, row.id), true);
  });

  test('shows in the Admin\'s requests, not anyone else\'s', async () => {
    const { data } = await users.admin.client.rpc('position_requests');
    assert.deepEqual(data.map((r) => [r.id, r.venue_id, r.person_name]), [[ids.selfAdded, ids.venue, `kim ${run}`]]);
    for (const who of ['creator', 'stranger', 'person']) {
      const { data: none } = await users[who].client.rpc('position_requests');
      assert.deepEqual(none, [], who);
    }
  });

  test('only a current Admin of the bar accepts it; then everyone reads it', async () => {
    for (const who of ['person', 'creator', 'staffer', 'stranger']) {
      const { error } = await accept(who, ids.selfAdded);
      assert.match(error?.message ?? '', /isn't waiting for you/, who);
    }
    const { error: anonError } = await anon.rpc('accept_profile_position', { p_id: ids.selfAdded });
    assert.ok(anonError);
    assert.equal((await stored(ids.selfAdded)).bar_accepted, false);

    const { error } = await accept('admin', ids.selfAdded);
    assert.ifError(error);
    assert.equal(await reads(anon, ids.selfAdded), true);
    assert.equal(await reads(users.stranger.client, ids.selfAdded), true);
  });

  test('changing the title asks the bar again', async () => {
    const { error } = await users.person.client.from('profile_positions').update({ title: 'Bar manager' }).eq('id', ids.selfAdded);
    assert.ifError(error);
    assert.equal((await stored(ids.selfAdded)).bar_accepted, false);
    assert.equal(await reads(anon, ids.selfAdded), false);
  });

  test('the Admin can decline instead; a non-Admin cannot', async () => {
    const row = await add('person', ids.person, ids.bar, 'Barback', false);
    const { error: creatorError } = await decline('creator', row.id);
    assert.ok(creatorError);
    assert.ok(await stored(row.id));
    const { error } = await decline('admin', row.id);
    assert.ifError(error);
    assert.equal(await stored(row.id), undefined);
  });

  test('someone already on the venue\'s team is confirmed at once', async () => {
    const row = await add('staffer', ids.staffer, ids.bar, 'Bartender');
    assert.equal(row.bar_accepted, true);
    assert.equal(await reads(anon, row.id), true);
  });

  test('at a bar with no venue on Cocktail, a moderator answers', async () => {
    const row = await add('person', ids.person, ids.wildBar, 'Head bartender');
    assert.equal(await reads(anon, row.id), false);
    const { data: adminList } = await users.admin.client.rpc('position_requests');
    assert.ok(!adminList.some((r) => r.id === row.id));
    const { data: modList } = await users.moderator.client.rpc('position_requests');
    const mine = modList.find((r) => r.id === row.id);
    assert.equal(mine?.venue_id, null);
    assert.ifError((await accept('moderator', row.id)).error);
    assert.equal(await reads(anon, row.id), true);
  });

  test('a moderator does not answer for a bar that has a venue', async () => {
    const row = await add('person', ids.person, ids.bar, 'Server');
    const { error } = await accept('moderator', row.id);
    assert.ok(error);
    assert.equal((await stored(row.id)).bar_accepted, false);
  });
});

describe('a job the bar adds', () => {
  test('a real person accepts it before it shows', async () => {
    const row = await add('admin', ids.person, ids.bar, 'Head bartender');
    assert.equal(row.bar_accepted, true);
    assert.equal(row.person_accepted, false);
    assert.equal(await reads(anon, row.id), false);
    assert.equal(await reads(users.person.client, row.id), true);

    const { error: adminError } = await accept('admin', row.id);
    assert.ok(adminError, 'the bar cannot accept for the person');
    assert.ifError((await accept('person', row.id)).error);
    assert.equal(await reads(anon, row.id), true);
  });

  test('the person can decline it', async () => {
    const row = await add('admin', ids.person, ids.bar, 'Bar director');
    assert.ifError((await decline('person', row.id)).error);
    assert.equal(await stored(row.id), undefined);
  });

  test('an unclaimed profile has no one to ask, so it shows at once', async () => {
    const row = await add('admin', ids.unclaimed, ids.bar, 'Bartender');
    assert.deepEqual([row.person_accepted, row.bar_accepted], [true, true]);
    assert.equal(await reads(anon, row.id), true);
  });
});

describe('the flags', () => {
  test('a client cannot set them, or move a job to another person or bar', async () => {
    const client = users.person.client;
    const { error: insertError } = await client
      .from('profile_positions')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.bar, title: 'Owner', bar_accepted: true });
    assert.ok(insertError);
    const row = await add('person', ids.person, ids.bar, 'Porter');
    for (const change of [{ bar_accepted: true }, { person_accepted: true }, { bar_profile_id: ids.wildBar }, { person_profile_id: ids.unclaimed }]) {
      const { error } = await client.from('profile_positions').update(change).eq('id', row.id);
      assert.ok(error, JSON.stringify(change));
    }
    assert.equal((await stored(row.id)).bar_accepted, false);
  });

  test('the person still switches a past job on and off', async () => {
    const { rows } = await db.query(
      "INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, is_current) VALUES ($1, $2, 'Barback', false) RETURNING id",
      [ids.person, ids.wildBar]
    );
    const { data, error } = await users.person.client.from('profile_positions').update({ is_shown: true }).eq('id', rows[0].id).select('id');
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(await reads(anon, rows[0].id), true);
  });
});
