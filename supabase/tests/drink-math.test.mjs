// Drink maths on the server: the strength is worked out from the spec and
// stored on the item whenever the spec, an ingredient's ABV, the method, the
// drink's own dilution or the venue's defaults change, and every role that
// can see the drink sees it. Runs through the real API against the local
// stack. The figures match lib/drinkMath.check.ts.
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
  throw new Error(`Refusing to run drink maths tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// Bar defaults: measurement level 30. Admin (40) edits the bar.
const ROLES = { employee: 20, bartender: 30, admin: 40 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@drink-math-test.local`;
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

async function strength(id = ids.drink) {
  const { data, error } = await service.from('items').select('abv, abv_source, serve_ml, serve_abv').eq('id', id).single();
  assert.ifError(error);
  return data;
}

const near = (a, b, msg) => assert.ok(a != null && Math.abs(Number(a) - b) < 0.06, `${msg ?? ''} expected ${b}, got ${a}`);

before(async () => {
  for (const label of Object.keys(ROLES)) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Maths bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.shake = (await insert('items', { name: `Shake ${run}`, item_type: 'method' })).id;
  ids.rum = (await insert('items', { name: `White rum ${run}`, item_type: 'ingredient', abv: 40 })).id;
  ids.lime = (await insert('items', { name: `Lime juice ${run}`, item_type: 'ingredient' })).id;
  ids.syrup = (await insert('items', { name: `Simple syrup ${run}`, item_type: 'ingredient', abv: 0 })).id;
  // A venue's own water is a kind of the shared Water (one of each ingredient, 20261008100000).
  const { data: sharedWater } = await service.rpc('resolve_ingredient', { p_name: 'Filtered water' });
  ids.water = (await insert('items', { name: 'Filtered water', item_type: 'ingredient', bar_id: ids.bar, generic_id: sharedWater ?? null })).id;
  ids.drink = (await insert('items', { name: `Daiquiri ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await insert('item_methods', { item_id: ids.drink, method_item_id: ids.shake, sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.rum, amount: 60, unit: 'ml', sort_order: 1 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.lime, amount: 22.5, unit: 'ml', sort_order: 2 });
  ids.syrupLine = (await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.syrup, amount: 15, unit: 'ml', sort_order: 3 })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.rum, ids.lime, ids.syrup, ids.water, ids.shake]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('strength is worked out on save', () => {
  test('a shaken daiquiri: 24.6% before and 19.7% after 25% water', async () => {
    const s = await strength();
    assert.equal(s.abv_source, 'calculated');
    near(s.abv, 24.6);
    near(s.serve_ml, 121.9);
    near(s.serve_abv, 19.7);
  });

  test('an employee below the measurement level sees the strength, not the amounts', async () => {
    const item = await users.employee.client.from('app_item_presentation').select('abv, serve_ml, serve_abv, abv_source').eq('id', ids.drink).single();
    assert.ifError(item.error);
    near(item.data.serve_abv, 19.7);
    near(item.data.serve_ml, 121.9);
    const rows = await users.employee.client.from('app_recipe_presentation').select('amount').eq('recipe_item_id', ids.drink);
    assert.ifError(rows.error);
    assert.deepEqual(rows.data.map((r) => r.amount), [null, null, null]);
  });

  test("the venue's dilution default and the drink's own figure change the serve", async () => {
    const asBartender = await users.bartender.client.from('bars').update({ dilution_defaults: { shaken: 30 } }).eq('id', ids.bar).select('id');
    assert.ok(asBartender.error || asBartender.data.length === 0, 'only an admin sets the house dilution');
    const asAdmin = await users.admin.client.from('bars').update({ dilution_defaults: { shaken: 30 } }).eq('id', ids.bar);
    assert.ifError(asAdmin.error);
    let s = await strength();
    near(s.serve_ml, 126.8, 'shaken at 30%');
    near(s.serve_abv, 18.9);
    const own = await users.admin.client.from('items').update({ dilution_pct: 10 }).eq('id', ids.drink);
    assert.ifError(own.error);
    s = await strength();
    near(s.serve_ml, 107.3, 'the drink’s measured 10%');
    near(s.serve_abv, 22.4);
    await service.from('items').update({ dilution_pct: null }).eq('id', ids.drink);
    await service.from('bars').update({ dilution_defaults: null }).eq('id', ids.bar);
    near((await strength()).serve_ml, 121.9, 'back to the house rule');
  });

  test("an ingredient's ABV changes every drink that uses it", async () => {
    await service.from('items').update({ abv: 50 }).eq('id', ids.rum);
    near((await strength()).abv, 30.8);
    await service.from('items').update({ abv: 40 }).eq('id', ids.rum);
    near((await strength()).abv, 24.6);
  });

  test('a typed ABV stays, the serve still recalculates', async () => {
    await service.from('items').update({ abv: 23, abv_source: 'manual' }).eq('id', ids.drink);
    await service.from('recipes').update({ amount: 20 }).eq('id', ids.syrupLine);
    const s = await strength();
    assert.equal(s.abv_source, 'manual');
    near(s.abv, 23);
    near(s.serve_ml, 128.1, '102.5 ml at 25%');
    await service.from('items').update({ abv: null, abv_source: 'calculated' }).eq('id', ids.drink);
    await service.from('recipes').update({ amount: 15 }).eq('id', ids.syrupLine);
    near((await strength()).abv, 24.6);
  });

  test('water in the spec means no more dilution at service', async () => {
    const line = await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.water, amount: 24.4, unit: 'ml', sort_order: 4 });
    const s = await strength();
    near(s.serve_ml, 121.9, 'the water is the dilution');
    near(s.serve_abv, 19.7);
    await service.from('recipes').delete().eq('id', line.id);
  });

  test('with no ABV on any ingredient, no strength is claimed', async () => {
    const mix = (await insert('items', { name: `Sour mix ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
    await insert('recipes', { recipe_item_id: mix, ingredient_item_id: ids.lime, amount: 30, unit: 'ml', sort_order: 1 });
    let s = await strength(mix);
    near(s.serve_ml, 30, 'the serve is still known');
    assert.equal(s.abv, null, 'not 0%');
    assert.equal(s.serve_abv, null);
    await service.from('items').update({ abv: 0 }).eq('id', ids.lime);
    s = await strength(mix);
    near(s.abv, 0, 'a stated 0% is a real answer');
    near(s.serve_abv, 0);
    await service.from('items').update({ abv: null }).eq('id', ids.lime);
    assert.equal((await strength(mix)).abv, null, 'and it empties again');
    await service.from('items').delete().eq('id', mix);
  });

  test('a house-made ingredient with a recipe gets its own ABV', async () => {
    const wash = (await insert('items', { name: `Rum wash ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
    await insert('recipes', { recipe_item_id: wash, ingredient_item_id: ids.rum, amount: 700, unit: 'ml', sort_order: 1 });
    await insert('recipes', { recipe_item_id: wash, ingredient_item_id: ids.syrup, amount: 300, unit: 'g', sort_order: 2 });
    const s = await strength(wash);
    near(s.abv, 29.7, '700 ml at 40% in 700 + 243.9 ml');
    await service.from('items').delete().eq('id', wash);
  });
});
