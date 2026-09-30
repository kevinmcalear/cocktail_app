// The service spec: recipes.at_service shows with the amounts and only the
// drink's editors set it; items.service_style reads wherever the drink reads.
// Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run service spec tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// Bar defaults: measurement level 30, edit_drinks from 35.
const ROLES = { employee: 20, bartender: 30, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@service-spec-test.local`;
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

before(async () => {
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Service bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.rum = (await insert('items', { name: `White rum ${run}`, item_type: 'ingredient' })).id;
  ids.lime = (await insert('items', { name: `Lime juice ${run}`, item_type: 'ingredient' })).id;
  ids.drink = (await insert('items', { name: `Daiquiri ${run}`, item_type: 'cocktail', bar_id: ids.bar, service_style: 'batched' })).id;
  ids.rumLine = (await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.rum, amount: 60, unit: 'ml', sort_order: 1, at_service: false })).id;
  ids.limeLine = (await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.lime, amount: 22.5, unit: 'ml', sort_order: 2, at_service: true })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.rum, ids.lime]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

async function presented(who) {
  const { data, error } = await users[who].client
    .from('app_recipe_presentation')
    .select('id, amount, at_service')
    .eq('recipe_item_id', ids.drink)
    .order('sort_order');
  assert.ifError(error);
  return data;
}

describe('recipes.at_service', () => {
  test('shows with the amounts: a bartender sees the split, an employee sees neither', async () => {
    const asBartender = await presented('bartender');
    assert.deepEqual(asBartender.map((r) => r.at_service), [false, true]);
    assert.equal(asBartender[0].amount, 60);
    const asEmployee = await presented('employee');
    assert.equal(asEmployee.length, 2, 'the rows still show, with names only');
    assert.deepEqual(asEmployee.map((r) => r.at_service), [null, null]);
    assert.deepEqual(asEmployee.map((r) => r.amount), [null, null]);
  });

  test('only someone who can edit the drink decides it', async () => {
    const asBartender = await users.bartender.client.from('recipes').update({ at_service: true }).eq('id', ids.rumLine).select('id');
    assert.ok(asBartender.error || asBartender.data.length === 0, 'a bartender without edit_drinks changes nothing');
    assert.deepEqual((await presented('bartender')).map((r) => r.at_service), [false, true], 'unchanged');
    const asCreator = await users.creator.client.from('recipes').update({ at_service: true }).eq('id', ids.rumLine).select('id, at_service').single();
    assert.ifError(asCreator.error);
    assert.equal(asCreator.data.at_service, true);
    assert.deepEqual((await presented('creator')).map((r) => r.at_service), [true, true]);
  });
});

describe('items.service_style', () => {
  test('reads with the drink and takes only the five styles', async () => {
    const { data, error } = await users.employee.client.from('app_item_presentation').select('service_style').eq('id', ids.drink).single();
    assert.ifError(error);
    assert.equal(data.service_style, 'batched');
    const bad = await service.from('items').update({ service_style: 'keg' }).eq('id', ids.drink);
    assert.ok(bad.error, 'an unknown style is refused');
    const cleared = await users.creator.client.from('items').update({ service_style: null }).eq('id', ids.drink).select('service_style').single();
    assert.ifError(cleared.error);
    assert.equal(cleared.data.service_style, null);
  });

  test('an outsider sees nothing of the drink', async () => {
    const { data, error } = await users.outsider.client.from('app_recipe_presentation').select('at_service').eq('recipe_item_id', ids.drink);
    assert.ifError(error);
    assert.equal(data.length, 0);
  });
});
