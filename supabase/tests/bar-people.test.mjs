// Who works where and who made what (20260929500000_bar_people.sql):
// positions link a person's profile to a bar's; anyone who can see both sees
// it, and only the person, the bar's publishers or a moderator can change it.
// Co-creators share a drink's credit; moderators add them. Runs through the
// real API.
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
  throw new Error(`Refusing to run profile position tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

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

const profile = (kind, handle, extra = {}) => serviceInsert('profiles', { kind, handle: `${handle}${run}`, display_name: handle, ...extra });

before(async () => {
  for (const label of ['person', 'publisher', 'stranger']) users[label] = await makeUser(label);
  ids.venue = (await serviceInsert('bars', { name: `Positions Bar ${run}` })).id;
  await service.from('user_bars').insert({ user_id: users.publisher.id, bar_id: ids.venue, role_level: 40 });

  ids.unclaimedBar = (await profile('bar', 'openbar', { is_public: true })).id;
  ids.venueBar = (await profile('bar', 'venuebar', { is_public: true, bar_id: ids.venue })).id;
  ids.publicPerson = (await profile('person', 'jo', { is_public: true })).id;
  ids.privatePerson = (await profile('person', 'sam', { is_public: false })).id;
  ids.claimedPerson = (await profile('person', 'kim', { is_public: true, user_id: users.person.id })).id;

  ids.public = (await serviceInsert('profile_positions', { person_profile_id: ids.publicPerson, bar_profile_id: ids.unclaimedBar, title: 'Head bartender' })).id;
  ids.private = (await serviceInsert('profile_positions', { person_profile_id: ids.privatePerson, bar_profile_id: ids.unclaimedBar, title: 'Owner' })).id;
  ids.claimed = (await serviceInsert('profile_positions', { person_profile_id: ids.claimedPerson, bar_profile_id: ids.unclaimedBar, title: 'Bar manager' })).id;
});

after(async () => {
  if (ids.item) await service.from('items').delete().eq('id', ids.item);
  const profiles = [ids.unclaimedBar, ids.venueBar, ids.publicPerson, ids.privatePerson, ids.claimedPerson].filter(Boolean);
  if (profiles.length) await service.from('profiles').delete().in('id', profiles);
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('profile positions', () => {
  test('signed-out visitors read a position with both profiles, but not one whose person is private', async () => {
    const { data, error } = await anon
      .from('profile_positions')
      .select('id, title, person:profiles!person_profile_id(handle), bar:profiles!bar_profile_id(handle)')
      .eq('bar_profile_id', ids.unclaimedBar);
    assert.ifError(error);
    const seen = new Set(data.map((r) => r.id));
    assert.ok(seen.has(ids.public));
    assert.ok(!seen.has(ids.private), 'a private person stays hidden');
    assert.equal(data.find((r) => r.id === ids.public).person.handle, `jo${run}`);
  });

  test('a stranger can neither add nor remove positions', async () => {
    const add = await users.stranger.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.publicPerson, bar_profile_id: ids.unclaimedBar, title: 'Owner' });
    assert.ok(add.error, 'insert refused');
    await users.stranger.client.from('profile_positions').delete().eq('id', ids.public);
    const { data } = await service.from('profile_positions').select('id').eq('id', ids.public);
    assert.equal(data.length, 1, 'still there');
  });

  test("a bar's publisher can add someone to their own bar, not to another", async () => {
    const own = await users.publisher.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.publicPerson, bar_profile_id: ids.venueBar, title: 'Bar director' })
      .select('id')
      .single();
    assert.ifError(own.error);
    const other = await users.publisher.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.publicPerson, bar_profile_id: ids.unclaimedBar, title: 'Bar director' });
    assert.ok(other.error, 'refused at a bar they do not publish for');
  });

  test('a person who claimed their profile can take down a wrong position', async () => {
    const { error } = await users.person.client.from('profile_positions').delete().eq('id', ids.claimed);
    assert.ifError(error);
    const { data } = await service.from('profile_positions').select('id').eq('id', ids.claimed);
    assert.equal(data.length, 0);
  });

  test('a position runs from a person to a bar', async () => {
    const { error } = await service
      .from('profile_positions')
      .insert({ person_profile_id: ids.unclaimedBar, bar_profile_id: ids.venueBar, title: 'Owner' });
    assert.match(error?.message ?? '', /person's profile/);
  });

  test('co-creators: signed-in people read them, strangers cannot add them, a co-creator can step off', async () => {
    const item = await serviceInsert('items', { name: `Team Drink ${run}`, item_type: 'cocktail', creator_profile_id: ids.publicPerson, origin_bar_profile_id: ids.unclaimedBar });
    ids.item = item.id;
    await serviceInsert('item_co_creators', { item_id: item.id, profile_id: ids.claimedPerson });

    const read = await users.stranger.client.from('items').select('id, co_creators:item_co_creators(profile:profiles(handle))').eq('id', item.id).single();
    assert.ifError(read.error);
    assert.deepEqual(read.data.co_creators.map((c) => c.profile.handle), [`kim${run}`]);

    const add = await users.stranger.client.from('item_co_creators').insert({ item_id: item.id, profile_id: ids.publicPerson });
    assert.ok(add.error, 'only moderators add co-creators');
    const bar = await service.from('item_co_creators').insert({ item_id: item.id, profile_id: ids.unclaimedBar });
    assert.match(bar.error?.message ?? '', /person's profile/);

    const off = await users.person.client.from('item_co_creators').delete().eq('item_id', item.id).eq('profile_id', ids.claimedPerson);
    assert.ifError(off.error);
    const { data } = await service.from('item_co_creators').select('item_id').eq('item_id', item.id);
    assert.equal(data.length, 0);
  });

  test('the seeded people are public, unclaimed and linked to their bars', async () => {
    const { data, error } = await anon
      .from('profile_positions')
      .select('title, person:profiles!person_profile_id(handle, is_public, is_claimed), bar:profiles!bar_profile_id(handle)')
      .limit(1000);
    assert.ifError(error);
    const seeded = data.filter((r) => r.bar.handle === 'barleonehk');
    assert.ok(seeded.length > 0, 'Bar Leone has its people');
    for (const r of seeded) {
      assert.equal(r.person.is_public, true);
      assert.equal(r.person.is_claimed, false);
    }
    const { data: doublethink } = await service
      .from('items')
      .select('creator:profiles!items_creator_profile_id_fkey(handle), co_creators:item_co_creators(profile:profiles(handle))')
      .eq('name', 'Doublethink')
      .single();
    assert.deepEqual(
      [doublethink.creator.handle, ...doublethink.co_creators.map((c) => c.profile.handle)].sort(),
      ['darren.leaney', 'kitty.gardner', 'tom.mchugh']
    );
  });
});
