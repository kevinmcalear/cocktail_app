// Allergens checked by the bar, and private guest allergies
// (20261204400000_takeovers_and_allergens.sql): someone who edits drinks at
// the bar checks a drink's allergens, stamped by the server; any change to
// the spec, a house-made ingredient under it or a declaration clears it;
// guests (signed out too) read every allergen of a drink they may see, the
// unchecked count and the check's date, never who checked; a guest's own
// allergies are theirs alone. Runs through the real API against the local
// stack.
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
  throw new Error(`Refusing to run allergen tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@allergen-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const checked = async (itemId) => (await service.from('items').select('allergens_checked_at').eq('id', itemId).single()).data.allergens_checked_at;
const guestRead = async (client, itemId) => {
  const { data, error } = await client.rpc('guest_drink_allergens', { p_item_ids: [itemId] });
  if (error) throw error;
  return data[0] ?? null;
};

before(async () => {
  for (const label of ['admin', 'bartender', 'guest', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Allergen bar ${run}`, page_visibility: 'open' })).id;
  ids.page = (await insert('profiles', { kind: 'bar', bar_id: ids.bar, is_public: true, handle: `allergens${run}`, display_name: `Allergens ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  ids.orgeat = (await insert('items', { name: `Orgeat ${run}`, item_type: 'ingredient' })).id;
  ids.lemon = (await insert('items', { name: `Lemon ${run}`, item_type: 'ingredient' })).id;
  await insert('item_allergens', { item_id: ids.orgeat, allergen: 'tree_nuts' });
  ids.prep = (await insert('items', { name: `House orgeat mix ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
  await insert('recipes', { recipe_item_id: ids.prep, ingredient_item_id: ids.orgeat, amount: 1, unit: 'oz', sort_order: 0 });
  ids.drink = (await insert('items', { name: `Mai tai ${run}`, item_type: 'cocktail', bar_id: ids.bar, publish_mode: 'spec' })).id;
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.prep, amount: 0.5, unit: 'oz', sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.lemon, amount: 0.75, unit: 'oz', sort_order: 1 });
});

after(async () => {
  for (const id of [ids.drink, ids.prep, ids.orgeat, ids.lemon]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.page) await service.from('profiles').delete().eq('id', ids.page);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('checked by the bar, with a date', () => {
  test("a bartender can't check; an Admin can, and the server stamps it", async () => {
    const no = await users.bartender.client.from('items').update({ allergens_checked_at: new Date().toISOString() }).eq('id', ids.drink).select('id');
    assert.ok(no.error || no.data.length === 0);
    const yes = await users.admin.client.from('items').update({ allergens_checked_at: '2001-01-01T00:00:00Z' }).eq('id', ids.drink).select('allergens_checked_at, allergens_checked_by, allergens_checked_spec');
    assert.ifError(yes.error);
    const [row] = yes.data;
    assert.equal(row.allergens_checked_by, users.admin.id);
    assert.ok(Date.parse(row.allergens_checked_at) > Date.now() - 60000, 'stamped now');
    assert.ok(row.allergens_checked_spec, 'with what was checked');
  });

  test('guests read every allergen, the unchecked count and the date, never who checked', async () => {
    for (const client of [anon, users.guest.client]) {
      const r = await guestRead(client, ids.drink);
      assert.ok(r, 'a published drink');
      assert.deepEqual(r.allergens.map((a) => a.allergen), ['tree_nuts'], 'through the house-made ingredient');
      assert.equal(r.unchecked, 2, 'neither bought ingredient has been checked');
      assert.equal(r.lines, 2);
      assert.ok(r.checked_at, 'checked by the bar');
      assert.ok(!('checked_by' in r));
    }
    const staff = await users.bartender.client.rpc('drink_allergens', { p_item_id: ids.drink });
    assert.ok(staff.data.checked);
    assert.equal(staff.data.stale, false);
  });

  test('sending the old check back unchanged never refreshes it', async () => {
    const before = (await service.from('items').select('allergens_checked_at, allergens_checked_spec').eq('id', ids.drink).single()).data;
    const same = await users.admin.client.from('items').update({ allergens_checked_at: before.allergens_checked_at, name: `Mai tai ${run}` }).eq('id', ids.drink).select('allergens_checked_at, allergens_checked_spec');
    assert.ifError(same.error);
    assert.equal(Date.parse(same.data[0].allergens_checked_at), Date.parse(before.allergens_checked_at));
    assert.equal(same.data[0].allergens_checked_spec, before.allergens_checked_spec);
  });

  test("a change to a house-made ingredient under it clears the check; so does a new declaration", async () => {
    await insert('recipes', { recipe_item_id: ids.prep, ingredient_item_id: ids.lemon, amount: 0.25, unit: 'oz', sort_order: 1 });
    assert.equal((await guestRead(anon, ids.drink)).checked_at, null, 'Ask your bartender');
    const staff = await users.admin.client.rpc('drink_allergens', { p_item_id: ids.drink });
    assert.equal(staff.data.checked, null);
    assert.equal(staff.data.stale, true, 'staff see the spec changed since the check');

    await users.admin.client.from('items').update({ allergens_checked_at: new Date().toISOString() }).eq('id', ids.drink);
    assert.ok((await guestRead(anon, ids.drink)).checked_at, 'checked again');
    await insert('item_allergens', { item_id: ids.lemon, allergen: 'sulphites' });
    assert.equal((await guestRead(anon, ids.drink)).checked_at, null, 'a new declaration clears it');
    assert.ifError((await service.from('items').update({ allergens_checked_at: null }).eq('id', ids.drink)).error);
    assert.equal(await checked(ids.drink), null);
  });

  test("a drink the guest may not see reads nothing", async () => {
    const hidden = (await insert('items', { name: `Staff only ${run}`, item_type: 'cocktail', bar_id: ids.bar, publish_mode: 'private' })).id;
    assert.equal(await guestRead(anon, hidden), null);
    assert.equal(await guestRead(users.stranger.client, hidden), null);
    await service.from('items').delete().eq('id', hidden);
  });
});

describe("a guest's own allergies", () => {
  test('theirs alone, the 14 only', async () => {
    const save = await users.guest.client.from('user_prefs').upsert({ user_id: users.guest.id, allergies: ['tree_nuts', 'eggs'] }).select('allergies');
    assert.ifError(save.error);
    assert.deepEqual(save.data[0].allergies, ['tree_nuts', 'eggs']);
    const bad = await users.guest.client.from('user_prefs').upsert({ user_id: users.guest.id, allergies: ['moonbeams'] });
    assert.ok(bad.error);
    const other = await users.stranger.client.from('user_prefs').select('allergies').eq('user_id', users.guest.id);
    assert.equal(other.data.length, 0);
    const out = await anon.from('user_prefs').select('allergies').eq('user_id', users.guest.id);
    assert.ok(out.error || out.data.length === 0);
  });
});
