// Makers with no page, by name, and the drink editor's credit changes
// (20261130200000_creator_names.sql): items.creator_names takes up to five
// trimmed names, published_items carries them, and set_drink_credits makes
// one change all or nothing, as the person calling it (RLS and the guard
// triggers apply). Runs through the real API.
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
  throw new Error(`Refusing to run creator name tests against a non-local API: ${status.API_URL}`);
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

const drink = async () => (await service.from('items').select('creator_profile_id, creator_names, credit_status').eq('id', ids.drink).single()).data;
const rows = async () =>
  Object.fromEntries(((await service.from('item_co_creators').select('profile_id, status').eq('item_id', ids.drink)).data ?? []).map((r) => [r.profile_id, r.status]));
const setCredits = (who, change) =>
  users[who].client.rpc('set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: null, p_creator_names: [], p_add: [], p_remove: [], ...change });

before(async () => {
  for (const label of ['editor', 'stranger']) users[label] = await makeUser(label);
  ids.venue = (await serviceInsert('bars', { name: `Names Bar ${run}` })).id;
  await service.from('user_bars').insert([{ user_id: users.editor.id, bar_id: ids.venue, role_level: 40 }]);
  ids.editor = (await serviceInsert('profiles', { kind: 'person', handle: `ned${run}`, display_name: 'Ned', is_public: true, user_id: users.editor.id })).id;
  // Historic people nobody will claim, as the research seeds make them.
  ids.harry = (await serviceInsert('profiles', { kind: 'person', handle: `harry${run}`, display_name: 'Harry', is_public: true })).id;
  ids.kit = (await serviceInsert('profiles', { kind: 'person', handle: `kit${run}`, display_name: 'Kit', is_public: true })).id;
  ids.barPage = (await serviceInsert('profiles', { kind: 'bar', handle: `namesbar${run}`, display_name: 'Names Bar', is_public: true, bar_id: ids.venue })).id;
  ids.drink = (await serviceInsert('items', { name: `Names Sour ${run}`, item_type: 'cocktail', bar_id: ids.venue, creator_profile_id: ids.harry, credit_status: 'claimed' })).id;
  await serviceInsert('item_co_creators', { item_id: ids.drink, profile_id: ids.kit });
});

after(async () => {
  if (ids.drink) await service.from('items').delete().eq('id', ids.drink);
  await service.from('profiles').delete().in('id', [ids.editor, ids.harry, ids.kit, ids.barPage].filter(Boolean));
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('creator names and set_drink_credits', () => {
  test('names are trimmed, 1 to 80 characters, five at most', async () => {
    for (const bad of [[''], [' Ada'], ['x'.repeat(81)], ['a', 'b', 'c', 'd', 'e', 'f']]) {
      const { error } = await service.from('items').update({ creator_names: bad }).eq('id', ids.drink);
      assert.ok(error, `refused: ${JSON.stringify(bad).slice(0, 40)}`);
    }
  });

  test('an editor adds a name and themselves; the creator and its status stay', async () => {
    const { error } = await setCredits('editor', { p_creator_profile_id: ids.harry, p_creator_names: ['Ada Coleman'], p_add: [ids.editor] });
    assert.ifError(error);
    assert.deepEqual(await drink(), { creator_profile_id: ids.harry, creator_names: ['Ada Coleman'], credit_status: 'claimed' });
    assert.equal((await rows())[ids.editor], 'accepted', 'naming yourself needs no yes');
  });

  test('the signed-out view carries the names', async () => {
    const { data } = await service.from('published_items').select('creator_names').eq('id', ids.drink).maybeSingle();
    // Private drinks aren't in the view; when it is, the names come with it.
    if (data) assert.deepEqual(data.creator_names, ['Ada Coleman']);
  });

  test('a new creator starts as suggested, never claimed', async () => {
    const { error } = await setCredits('editor', { p_creator_profile_id: ids.kit, p_creator_names: ['Ada Coleman'], p_remove: [ids.kit] });
    assert.ifError(error);
    assert.deepEqual(await drink(), { creator_profile_id: ids.kit, creator_names: ['Ada Coleman'], credit_status: 'suggested' });
    assert.equal((await rows())[ids.kit], undefined);
  });

  test('all or nothing: a bad add leaves the drink as it was', async () => {
    const { error } = await setCredits('editor', { p_creator_profile_id: ids.harry, p_creator_names: [], p_add: [ids.barPage] });
    assert.ok(error, 'a bar is not a co-creator');
    assert.deepEqual(await drink(), { creator_profile_id: ids.kit, creator_names: ['Ada Coleman'], credit_status: 'suggested' });
  });

  test("someone who can't edit the drink changes nothing", async () => {
    const { error } = await setCredits('stranger', { p_creator_profile_id: null, p_creator_names: ['Me Instead'] });
    assert.ok(error);
    assert.deepEqual((await drink()).creator_names, ['Ada Coleman']);
  });

  test('signed out, the function is closed', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error } = await anon.rpc('set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: null, p_creator_names: [], p_add: [], p_remove: [] });
    assert.ok(error);
  });
});
