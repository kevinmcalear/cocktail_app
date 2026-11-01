// Permissions decide amounts (20261204300000_one_home.sql): names follow
// talking_points or specs; brands, amounts and units follow specs; prep
// notes follow house_made; a hidden spec shows only to those who edit the
// drink. The old per-field levels no longer move anything, and an old
// build's "Who can see the spec" pick still hides a spec. Runs through the
// real API against the local stack.
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
  throw new Error(`Refusing to run amounts tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const users = {};
const ids = {};
const ROLES = { guest: 10, employee: 20, bartender: 30, creator: 35, admin: 40 };

async function makeUser(label) {
  const email = `${label}-${run}@amounts-test.local`;
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

async function drink(name, fields = {}) {
  const id = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar, ...fields })).id;
  await insert('recipes', {
    recipe_item_id: id, ingredient_item_id: ids.brand, parent_ingredient_id: ids.generic,
    amount: 2, unit: 'oz', preparation_notes: `shake hard ${run}`, sort_order: 0,
  });
  return id;
}

/** What a person sees of a drink's one spec line. */
async function line(label, itemId) {
  const { data, error } = await users[label].client
    .from('app_recipe_presentation')
    .select('display_ingredient_id, ingredient_item_id, amount, unit, preparation_notes')
    .eq('recipe_item_id', itemId);
  if (error) throw error;
  const [r] = data;
  if (!r) return 'nothing';
  return {
    name: r.display_ingredient_id === ids.brand ? 'brand' : r.display_ingredient_id === ids.generic ? 'generic' : null,
    amount: r.amount,
    prep: r.preparation_notes ? 'prep' : null,
  };
}

before(async () => {
  ids.bar = (await insert('bars', { name: `Amounts bar ${run}`, default_measurement_level: 20, default_prep_level: 10, default_specific_brand_level: 10 })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    users[label] = await makeUser(label);
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.generic = (await insert('items', { name: `Gin ${run}`, item_type: 'ingredient' })).id;
  ids.brand = (await insert('items', { name: `House gin ${run}`, item_type: 'ingredient' })).id;
  ids.plain = await drink('Plain sour');
  ids.hidden = await drink('Secret sour', { spec_hidden: true });
});

after(async () => {
  for (const id of [ids.plain, ids.hidden, ids.oldPick, ids.generic, ids.brand]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('each role sees what its permissions open', () => {
  test("by default, and whatever the bar's old levels say", async () => {
    // The bar's levels would have opened amounts to Employees and prep and
    // brands to everyone: they no longer move anything.
    assert.deepEqual(await line('guest', ids.plain), { name: null, amount: null, prep: null });
    assert.deepEqual(await line('employee', ids.plain), { name: 'generic', amount: null, prep: null });
    assert.deepEqual(await line('bartender', ids.plain), { name: 'brand', amount: 2, prep: null });
    assert.deepEqual(await line('creator', ids.plain), { name: 'brand', amount: 2, prep: 'prep' }, 'Drink Creators read prep notes');
    assert.deepEqual(await line('admin', ids.plain), { name: 'brand', amount: 2, prep: 'prep' });
  });

  test('a hidden spec: names stay, the rest only for those who edit the drink', async () => {
    assert.deepEqual(await line('employee', ids.hidden), { name: 'generic', amount: null, prep: null });
    assert.deepEqual(await line('bartender', ids.hidden), { name: 'generic', amount: null, prep: null });
    assert.deepEqual(await line('creator', ids.hidden), { name: 'brand', amount: 2, prep: 'prep' });
  });

  test("switching a role's specs moves amounts and brands, not names", async () => {
    await insert('venue_level_overrides', { bar_id: ids.bar, base_level: 30, granted: [], revoked: ['specs'] });
    await insert('venue_level_overrides', { bar_id: ids.bar, base_level: 20, granted: ['specs'], revoked: [] });
    assert.deepEqual(await line('bartender', ids.plain), { name: 'generic', amount: null, prep: null });
    assert.deepEqual(await line('employee', ids.plain), { name: 'brand', amount: 2, prep: null });
    await service.from('venue_level_overrides').delete().eq('bar_id', ids.bar);
  });
});

describe('old builds', () => {
  test("a measurement pick above Bartender hides the spec; clearing it shows it again", async () => {
    ids.oldPick = await drink('Old pick sour');
    const pick = await users.admin.client.from('items').update({ override_measurement_level: 40 }).eq('id', ids.oldPick).select('spec_hidden');
    assert.ifError(pick.error);
    assert.equal(pick.data[0].spec_hidden, true);
    assert.deepEqual(await line('bartender', ids.oldPick), { name: 'generic', amount: null, prep: null });
    const low = await users.admin.client.from('items').update({ override_measurement_level: 20 }).eq('id', ids.oldPick).select('spec_hidden');
    assert.equal(low.data[0].spec_hidden, false, 'a lower pick no longer opens amounts, and shows the spec');
    assert.deepEqual(await line('employee', ids.oldPick), { name: 'generic', amount: null, prep: null });
  });

  test('the new app hides and shows with spec_hidden alone', async () => {
    const hide = await users.creator.client.from('items').update({ spec_hidden: true }).eq('id', ids.plain).select('spec_hidden');
    assert.ifError(hide.error);
    assert.equal(hide.data[0].spec_hidden, true);
    assert.deepEqual(await line('bartender', ids.plain), { name: 'generic', amount: null, prep: null });
    await users.creator.client.from('items').update({ spec_hidden: false }).eq('id', ids.plain);
  });
});
