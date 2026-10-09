// Who a person says they are (20261010700000_profile_identity.sql): their own
// line under their name, one of their own jobs instead, and whether people
// see their account photo, which a trigger copies onto the profile.
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
  throw new Error(`Refusing to run profile identity tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

const users = {};
const ids = {};
const photoOf = (userId) => `${status.API_URL}/storage/v1/object/public/avatars/${userId}/1.jpeg`;

async function makeUser(label, meta = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: meta });
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

const avatar = async (id) => (await service.from('profiles').select('avatar_url').eq('id', id).single()).data.avatar_url;

before(async () => {
  users.jo = await makeUser('jo');
  users.sam = await makeUser('sam');
  // Their photo is in their own folder; Sam's points at someone else's.
  await service.auth.admin.updateUserById(users.jo.id, { user_metadata: { avatar_url: photoOf(users.jo.id) } });
  await service.auth.admin.updateUserById(users.sam.id, { user_metadata: { avatar_url: photoOf(users.jo.id) } });
  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `idbar${run}`, display_name: `Id Bar ${run}`, is_public: true })).id;
  // Made by the person, as the app does: the trigger copies the photo on insert.
  const { data: jo, error } = await users.jo.client
    .from('profiles')
    .insert({ kind: 'person', handle: `jo${run}`, display_name: 'Jo', user_id: users.jo.id, is_public: true })
    .select('id')
    .single();
  assert.ifError(error);
  ids.jo = jo.id;
  ids.sam = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: 'Sam', user_id: users.sam.id, is_public: true })).id;
  ids.job = (await serviceInsert('profile_positions', { person_profile_id: ids.jo, bar_profile_id: ids.bar, title: 'Head bartender' })).id;
  ids.samJob = (await serviceInsert('profile_positions', { person_profile_id: ids.sam, bar_profile_id: ids.bar, title: 'Barback' })).id;
});

after(async () => {
  await service.from('profiles').update({ headline_position_id: null }).in('id', [ids.jo, ids.sam]);
  await service.from('profile_positions').delete().in('id', [ids.job, ids.samJob]);
  await service.from('profiles').delete().in('id', [ids.jo, ids.sam, ids.bar]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('the line under the name', () => {
  test('the person writes their own, and anyone reads it', async () => {
    const { error } = await users.jo.client.from('profiles').update({ tagline: 'Home bartender' }).eq('id', ids.jo);
    assert.ifError(error);
    const { data } = await anon.from('profiles').select('tagline, shows_photo, headline_position_id').eq('id', ids.jo).single();
    assert.deepEqual(data, { tagline: 'Home bartender', shows_photo: true, headline_position_id: null });
  });

  test('one short line: not over 40, not padded, not two lines, not on a bar', async () => {
    for (const tagline of ['x'.repeat(41), ' padded', 'two\nlines', '']) {
      const { error } = await users.jo.client.from('profiles').update({ tagline }).eq('id', ids.jo);
      assert.equal(error?.code, '23514', JSON.stringify(tagline));
    }
    const { error } = await service.from('profiles').update({ tagline: 'Cocktail bar' }).eq('id', ids.bar);
    assert.equal(error?.code, '23514');
  });

  test('nobody else writes it', async () => {
    const { data } = await users.sam.client.from('profiles').update({ tagline: 'Liar' }).eq('id', ids.jo).select('id');
    assert.deepEqual(data, []);
  });

  test('a job instead, but only one of their own', async () => {
    assert.ifError((await users.jo.client.from('profiles').update({ headline_position_id: ids.job }).eq('id', ids.jo)).error);
    const { error } = await users.jo.client.from('profiles').update({ headline_position_id: ids.samJob }).eq('id', ids.jo);
    assert.equal(error?.code, '23514');
  });
});

describe('the photo', () => {
  test('a person’s account photo reaches their profile', async () => {
    assert.equal(await avatar(ids.jo), photoOf(users.jo.id));
  });

  test('a picture outside their own folder never does', async () => {
    assert.equal(await avatar(ids.sam), null);
  });

  test('hidden, everyone sees initials; shown again, it comes back', async () => {
    assert.ifError((await users.jo.client.from('profiles').update({ shows_photo: false }).eq('id', ids.jo)).error);
    assert.equal(await avatar(ids.jo), null);
    assert.ifError((await users.jo.client.from('profiles').update({ shows_photo: true }).eq('id', ids.jo)).error);
    assert.equal(await avatar(ids.jo), photoOf(users.jo.id));
  });

  test('a new upload follows, through refresh_my_profile_photo', async () => {
    const next = photoOf(users.jo.id).replace('1.jpeg', '2.jpeg');
    await service.auth.admin.updateUserById(users.jo.id, { user_metadata: { avatar_url: next } });
    assert.ifError((await users.jo.client.rpc('refresh_my_profile_photo')).error);
    assert.equal(await avatar(ids.jo), next);
    const { error } = await anon.rpc('refresh_my_profile_photo');
    assert.ok(error);
  });

  test('hiding it from someone else’s profile is not possible', async () => {
    const { data } = await users.sam.client.from('profiles').update({ shows_photo: false }).eq('id', ids.jo).select('id');
    assert.deepEqual(data, []);
    assert.ok(await avatar(ids.jo));
  });
});
