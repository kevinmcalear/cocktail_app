// drink_cost: cost per serve through sub-recipes from pack prices and
// yields, for the costs capability only. Runs through the real API against
// the local stack.
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
  throw new Error(`Refusing to run drink cost tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

// costs opens at Admin (40); a Drink Creator (35) has prep but not costs.
const ROLES = { creator: 35, admin: 40 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@drink-cost-test.local`;
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

async function cost(client, item = ids.drink) {
  const { data, error } = await client.rpc('drink_cost', { p_item: item, p_bar: ids.bar });
  assert.ifError(error);
  return data;
}

before(async () => {
  for (const label of Object.keys(ROLES)) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Cost bar ${run}`, currency: 'GBP' })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.rum = (await insert('items', { name: `White rum ${run}`, item_type: 'ingredient', abv: 40 })).id;
  ids.lime = (await insert('items', { name: `Lime juice ${run}`, item_type: 'ingredient' })).id;
  ids.honey = (await insert('items', { name: `Honey ${run}`, item_type: 'ingredient' })).id;
  ids.water = (await insert('items', { name: `Hot water ${run}`, item_type: 'ingredient' })).id;
  ids.syrup = (await insert('items', { name: `Honey syrup ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
  ids.peel = (await insert('items', { name: `Lime wheel ${run}`, item_type: 'ingredient' })).id;
  ids.cubes = (await insert('items', { name: `Cubes ${run}`, item_type: 'ice' })).id;
  ids.drink = (await insert('items', { name: `Daiquiri ${run}`, item_type: 'cocktail', bar_id: ids.bar, ice_id: ids.cubes, ice_per_serve_g: 100 })).id;
  // The syrup: 500 g honey and 250 ml water make 600 ml.
  await insert('recipes', { recipe_item_id: ids.syrup, ingredient_item_id: ids.honey, amount: 500, unit: 'g', sort_order: 1 });
  await insert('recipes', { recipe_item_id: ids.syrup, ingredient_item_id: ids.water, amount: 250, unit: 'ml', sort_order: 2 });
  await insert('item_prep', { item_id: ids.syrup, yield_amount: 600, yield_unit: 'ml' });
  // The drink.
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.rum, amount: 60, unit: 'ml', sort_order: 1 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.lime, amount: 22.5, unit: 'ml', sort_order: 2 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.syrup, amount: 15, unit: 'ml', sort_order: 3 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.peel, amount: 1, unit: 'wheel', sort_order: 4 });
  // Packs and prices: rum £22 for 700 ml, honey £8 a kg, water free, wheels 10p each, ice £1.50 for 5 kg. Lime has none.
  const pack = (item, amount, unit, minor) =>
    Promise.all([
      insert('item_purchasing', { bar_id: ids.bar, item_id: item, pack_size_amount: amount, pack_size_unit: unit }),
      insert('item_costs', { bar_id: ids.bar, item_id: item, pack_cost_minor: minor }),
    ]);
  await pack(ids.rum, 700, 'ml', 2200);
  await pack(ids.honey, 1, 'kg', 800);
  await pack(ids.water, 1, 'L', 0);
  await pack(ids.peel, 20, 'each', 200);
  await pack(ids.cubes, 5, 'kg', 150);
});

after(async () => {
  for (const id of [ids.drink, ids.syrup, ids.rum, ids.lime, ids.honey, ids.water, ids.peel, ids.cubes]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('drink_cost', () => {
  test('adds the serve up through the syrup and its yield, and says what is missing', async () => {
    const c = await cost(users.admin.client);
    // Rum 60 of 700 ml at £22 = 189p; syrup (£4 + 0) over 600 ml, 15 ml = 10p; wheel 10p; ice 100 g of 5 kg at £1.50 = 3p.
    const byName = Object.fromEntries(c.lines.map((l) => [l.ingredient.replace(` ${run}`, ''), l]));
    assert.equal(byName['White rum'].minor, 189);
    assert.equal(byName['Honey syrup'].minor, 10);
    assert.equal(byName['Lime wheel'].minor, 10);
    assert.equal(byName['Lime wheel'].garnish, true);
    assert.equal(byName['Lime juice'].minor, null, 'no price, so it is missing, not free');
    assert.equal(c.missing, 1);
    assert.equal(c.liquid_minor, 199);
    assert.equal(c.garnish_minor, 10);
    assert.equal(c.ice_minor, 3);
    assert.equal(c.total_minor, 212);
  });

  test('a priced lime completes it', async () => {
    await insert('item_purchasing', { bar_id: ids.bar, item_id: ids.lime, pack_size_amount: 1, pack_size_unit: 'L' });
    await insert('item_costs', { bar_id: ids.bar, item_id: ids.lime, pack_cost_minor: 600 });
    const c = await cost(users.admin.client);
    assert.equal(c.missing, 0);
    assert.equal(c.liquid_minor, 199 + 14, '22.5 ml at 60p per 100 ml');
  });

  test('nothing for a Drink Creator, an outsider or a signed-out visitor', async () => {
    assert.equal(await cost(users.creator.client), null);
    const outsider = await makeUser('outsider');
    assert.equal(await cost(outsider.client), null);
    await service.auth.admin.deleteUser(outsider.id);
    const { data, error } = await anon.rpc('drink_cost', { p_item: ids.drink, p_bar: ids.bar });
    assert.ok(error || data === null, 'anon gets nothing');
  });

  test('a pack with no size, or a prep with no yield, is priced from what it has', async () => {
    await service.from('item_purchasing').update({ pack_size_amount: null, pack_size_unit: null }).eq('bar_id', ids.bar).eq('item_id', ids.rum);
    let c = await cost(users.admin.client);
    assert.equal(c.lines.find((l) => l.ingredient.startsWith('White rum')).minor, null, 'a price with no pack size is no price');
    await service.from('item_purchasing').update({ pack_size_amount: 700, pack_size_unit: 'ml' }).eq('bar_id', ids.bar).eq('item_id', ids.rum);
    await service.from('item_prep').update({ yield_amount: null, yield_unit: null }).eq('item_id', ids.syrup);
    c = await cost(users.admin.client);
    assert.equal(c.lines.find((l) => l.ingredient.startsWith('Honey syrup')).minor, 24, 'without a yield, the water that went in (250 ml) stands in: £4 over 250 ml, 15 ml');
  });
});
