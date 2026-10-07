// Who can name a drink's co-creators (20261007180000_editors_add_co_creators.sql):
// anyone who can edit the drink (a home drink's creator, a venue's editors at
// role 35 and up) and moderators; not a stranger, and not a venue's junior
// staff. Runs through the real API.
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
  throw new Error(`Refusing to run co-creator tests against a non-local API: ${status.API_URL}`);
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

const coCreators = async (itemId) => (await service.from('item_co_creators').select('profile_id').eq('item_id', itemId)).data.map((r) => r.profile_id);

before(async () => {
  for (const label of ['maker', 'editor', 'bartender', 'stranger']) users[label] = await makeUser(label);
  ids.venue = (await serviceInsert('bars', { name: `Co-creator Bar ${run}` })).id;
  await service.from('user_bars').insert([
    { user_id: users.editor.id, bar_id: ids.venue, role_level: 40 },
    { user_id: users.bartender.id, bar_id: ids.venue, role_level: 20 },
  ]);
  ids.jo = (await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', is_public: true })).id;
  ids.sam = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: 'Sam', is_public: true })).id;
  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `cobar${run}`, display_name: 'Co Bar', is_public: true })).id;

  // A drink made at home, by the maker's own account.
  const { data: home, error } = await users.maker.client.from('items').insert({ name: `Home Riff ${run}`, item_type: 'cocktail' }).select('id').single();
  if (error) throw error;
  ids.home = home.id;
  ids.venueDrink = (await serviceInsert('items', { name: `Venue Riff ${run}`, item_type: 'cocktail', bar_id: ids.venue })).id;
});

after(async () => {
  await service.from('items').delete().in('id', [ids.home, ids.venueDrink].filter(Boolean));
  await service.from('profiles').delete().in('id', [ids.jo, ids.sam, ids.bar].filter(Boolean));
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('co-creators', () => {
  test('a home drink’s maker names co-creators; a stranger can’t add or remove them', async () => {
    const add = await users.maker.client.from('item_co_creators').insert({ item_id: ids.home, profile_id: ids.jo });
    assert.equal(add.error, null);
    assert.deepEqual(await coCreators(ids.home), [ids.jo]);

    const sneak = await users.stranger.client.from('item_co_creators').insert({ item_id: ids.home, profile_id: ids.sam });
    assert.ok(sneak.error, 'a stranger can’t add one');
    await users.stranger.client.from('item_co_creators').delete().eq('item_id', ids.home).eq('profile_id', ids.jo);
    assert.deepEqual(await coCreators(ids.home), [ids.jo], 'nor take one off');

    const off = await users.maker.client.from('item_co_creators').delete().eq('item_id', ids.home).eq('profile_id', ids.jo);
    assert.equal(off.error, null);
    assert.deepEqual(await coCreators(ids.home), [], 'the maker can take one off');
  });

  test('a venue’s editors name co-creators; its junior staff can’t', async () => {
    const add = await users.editor.client.from('item_co_creators').insert({ item_id: ids.venueDrink, profile_id: ids.sam });
    assert.equal(add.error, null);
    const junior = await users.bartender.client.from('item_co_creators').insert({ item_id: ids.venueDrink, profile_id: ids.jo });
    assert.ok(junior.error, 'role 20 can’t edit the drink, so can’t credit it');
    assert.deepEqual(await coCreators(ids.venueDrink), [ids.sam]);
  });

  test('a co-creator is still a person, never a bar', async () => {
    const bar = await users.maker.client.from('item_co_creators').insert({ item_id: ids.home, profile_id: ids.bar });
    assert.ok(bar.error);
  });
});
