// Career history (20261001200000_career_history.sql): a person can record a
// menu they worked and a job at a bar that has closed, with the same writers
// as profile_positions. A pending claim blocks a second person profile.
// Drinks use the normal items insert, origin bar allowed to be closed.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run career history tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

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

before(async () => {
  for (const label of ['person', 'publisher', 'stranger', 'claimant']) users[label] = await makeUser(label);
  ids.venue = (await serviceInsert('bars', { name: `Career Bar ${run}` })).id;
  await service.from('user_bars').insert({ user_id: users.publisher.id, bar_id: ids.venue, role_level: 40 });

  ids.closed = (await serviceInsert('profiles', { kind: 'bar', handle: `closed${run}`, display_name: 'Closed Bar', is_public: true, is_closed: true, closed_year: 2019 })).id;
  ids.venueBar = (await serviceInsert('profiles', { kind: 'bar', handle: `open${run}`, display_name: 'Open Bar', is_public: true, bar_id: ids.venue })).id;
  ids.person = (await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', is_public: true, user_id: users.person.id })).id;
  ids.unclaimed = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: 'Sam', is_public: true })).id;
});

after(async () => {
  if (ids.drink) await service.from('items').delete().eq('id', ids.drink);
  const profiles = [ids.closed, ids.venueBar, ids.person, ids.unclaimed].filter(Boolean);
  if (profiles.length) await service.from('profiles').delete().in('id', profiles);
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('career history', () => {
  test('a person can add a past job and a menu at a closed bar; a stranger cannot', async () => {
    const job = await users.person.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.closed, title: 'Bartender', is_current: false })
      .select('id')
      .single();
    assert.ifError(job.error);

    const menu = await users.person.client
      .from('profile_worked_menus')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.closed, name: 'Opening list', year: 2018 })
      .select('id')
      .single();
    assert.ifError(menu.error);

    const stranger = await users.stranger.client
      .from('profile_worked_menus')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.closed, name: 'Stolen list' });
    assert.ok(stranger.error, 'a stranger cannot write someone else’s menu');
  });

  test("a bar's publisher can add a menu credit at their bar, not at a closed bar they don't run", async () => {
    const own = await users.publisher.client
      .from('profile_worked_menus')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.venueBar, name: 'House list' })
      .select('id')
      .single();
    assert.ifError(own.error);
    const other = await users.publisher.client
      .from('profile_worked_menus')
      .insert({ person_profile_id: ids.person, bar_profile_id: ids.closed, name: 'House list' });
    assert.ok(other.error, 'refused at a bar they do not publish for');
  });

  test('a menu credit runs from a person to a bar', async () => {
    const { error } = await service.from('profile_worked_menus').insert({ person_profile_id: ids.closed, bar_profile_id: ids.venueBar, name: 'Nope' });
    assert.match(error?.message ?? '', /person's profile/);
  });

  test('a cocktail they worked on is a normal shared drink, even when the bar is closed', async () => {
    const { data, error } = await users.person.client
      .from('items')
      .insert({
        name: `Gold Rush ${run}`,
        item_type: 'cocktail',
        bar_id: null,
        creator_profile_id: ids.person,
        origin_bar_profile_id: ids.closed,
        credit_status: 'suggested',
        publish_mode: 'description',
      })
      .select('id, origin_bar_profile_id, credit_status')
      .single();
    assert.ifError(error);
    ids.drink = data.id;
    assert.equal(data.origin_bar_profile_id, ids.closed);
    assert.equal(data.credit_status, 'suggested');
  });

  test('a pending claim blocks making a second profile', async () => {
    const claim = await users.claimant.client.from('profile_claims').insert({ profile_id: ids.unclaimed, message: 'This is me' }).select('id').single();
    assert.ifError(claim.error);
    const { error } = await users.claimant.client.from('profiles').insert({
      kind: 'person',
      handle: `claimant${run}`,
      display_name: 'Claimant',
      user_id: users.claimant.id,
      is_public: true,
    });
    assert.match(error?.message ?? '', /claim waiting/);
  });
});
