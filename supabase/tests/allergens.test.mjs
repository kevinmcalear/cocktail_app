// Allergens: declared on bought ingredients (by the catalogue, or by a bar for
// what it buys), rolled up through house-made recipes by drink_allergens(),
// with ingredient names masked the way the spec is. Runs through the real API
// against the local stack.
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
  throw new Error(`Refusing to run allergen tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

// Bar defaults: visibility 10, generic ingredient 20, specific brand 30.
const ROLES = { guest: 10, employee: 20, bartender: 30, creator: 35 };

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@allergens-test.local`;
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

async function item(row) {
  return (await insert('items', { item_type: 'ingredient', ...row, name: `${row.name} ${run}` })).id;
}

/** Declare and check, for the catalogue (bar null) or a bar. */
async function declare(itemId, allergens, barId = null) {
  for (const allergen of allergens) await insert('item_allergens', { item_id: itemId, bar_id: barId, allergen });
  await insert('item_allergen_checks', { item_id: itemId, bar_id: barId });
}

async function rollup(client, itemId) {
  const { data, error } = await client.rpc('drink_allergens', { p_item_id: itemId });
  assert.ifError(error);
  return data;
}

const byAllergen = (d) => Object.fromEntries(d.allergens.map((a) => [a.allergen, a.via]));

before(async () => {
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Allergen bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }

  // Bought, shared ingredients. The brand carries the allergen; the generic is checked and clean.
  ids.vermouth = await item({ name: 'Dry vermouth' });
  await declare(ids.vermouth, []);
  ids.dolin = await item({ name: 'Dolin Dry' });
  await declare(ids.dolin, ['sulphites']);
  ids.eggWhite = await item({ name: 'Egg white' });
  await declare(ids.eggWhite, ['eggs']);
  ids.raspberries = await item({ name: 'Raspberries' }); // never checked
  // The catalogue says orgeat has tree nuts; this bar buys a nut-free one.
  ids.orgeat = await item({ name: 'Orgeat' });
  await declare(ids.orgeat, ['tree_nuts']);
  await declare(ids.orgeat, [], ids.bar);

  // A house-made syrup at the bar, made from egg white and raspberries.
  ids.syrup = await item({ name: 'Raspberry syrup', bar_id: ids.bar });
  await insert('recipes', { recipe_item_id: ids.syrup, ingredient_item_id: ids.eggWhite, amount: 30, unit: 'ml', sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.syrup, ingredient_item_id: ids.raspberries, amount: 200, unit: 'g', sort_order: 1 });

  // The drink: Dolin (brand of Dry vermouth), the syrup, and orgeat.
  ids.drink = (await insert('items', { name: `Clover ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await insert('recipes', {
    recipe_item_id: ids.drink, ingredient_item_id: ids.dolin, parent_ingredient_id: ids.vermouth, amount: 15, unit: 'ml', sort_order: 0,
  });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.syrup, amount: 20, unit: 'ml', sort_order: 1 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.orgeat, amount: 10, unit: 'ml', sort_order: 2 });

  // The same orgeat in a shared catalogue drink: the catalogue's declaration applies.
  ids.shared = (await insert('items', { name: `Mai Tai ${run}`, item_type: 'cocktail' })).id;
  await insert('recipes', { recipe_item_id: ids.shared, ingredient_item_id: ids.orgeat, amount: 15, unit: 'ml', sort_order: 0 });

  // A drink only admins can open.
  ids.hidden = (await insert('items', { name: `Hidden ${run}`, item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 40 })).id;
  await insert('recipes', { recipe_item_id: ids.hidden, ingredient_item_id: ids.eggWhite, amount: 30, unit: 'ml', sort_order: 0 });
});

after(async () => {
  for (const id of [ids.drink, ids.shared, ids.hidden, ids.syrup, ids.dolin, ids.vermouth, ids.eggWhite, ids.raspberries, ids.orgeat]) {
    if (id) await service.from('items').delete().eq('id', id);
  }
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('drink_allergens', () => {
  test('rolls up through the syrup, with the path, for someone who sees the spec', async () => {
    const d = await rollup(users.creator.client, ids.drink);
    assert.equal(d.lines, 3);
    assert.equal(d.unchecked, 1, 'the raspberries were never checked');
    const via = byAllergen(d);
    assert.deepEqual(via.sulphites, [[`Dolin Dry ${run}`]]);
    assert.deepEqual(via.eggs, [[`Raspberry syrup ${run}`, `Egg white ${run}`]]);
    assert.equal(via.tree_nuts, undefined, "the bar's own nut-free orgeat replaces the catalogue's declaration");
  });

  test('the catalogue declaration applies where the bar has not checked', async () => {
    const d = await rollup(users.creator.client, ids.shared);
    assert.deepEqual(byAllergen(d).tree_nuts, [[`Orgeat ${run}`]]);
    assert.equal(d.unchecked, 0);
  });

  test('a guest still learns the allergens, but not the ingredient names', async () => {
    const d = await rollup(users.guest.client, ids.drink);
    assert.deepEqual(Object.keys(byAllergen(d)).sort(), ['eggs', 'sulphites']);
    assert.deepEqual(byAllergen(d).sulphites, [[]], 'no names below the generic-ingredient level');
    assert.deepEqual(byAllergen(d).eggs, [[]]);
  });

  test('an employee sees generic names only', async () => {
    const d = await rollup(users.employee.client, ids.drink);
    assert.deepEqual(byAllergen(d).sulphites, [[`Dry vermouth ${run}`]], 'the generic, not the brand');
  });

  test('nothing for a drink the caller cannot open', async () => {
    assert.equal(await rollup(users.bartender.client, ids.hidden), null);
    assert.equal(await rollup(users.outsider.client, ids.drink), null);
  });

  test('anon cannot call it', async () => {
    const { error } = await anon.rpc('drink_allergens', { p_item_id: ids.drink });
    assert.ok(error, 'anon is refused');
  });

  test('works for a prep too', async () => {
    const d = await rollup(users.creator.client, ids.syrup);
    assert.deepEqual(byAllergen(d).eggs, [[`Egg white ${run}`]]);
    assert.equal(d.unchecked, 1);
  });
});

describe('item_allergens', () => {
  test('anyone who can see the ingredient can read the catalogue declaration', async () => {
    const { data, error } = await users.guest.client.from('item_allergens').select('allergen').eq('item_id', ids.dolin);
    assert.ifError(error);
    assert.deepEqual(data.map((r) => r.allergen), ['sulphites']);
  });

  test("a bar's declaration is for its members", async () => {
    const member = await users.guest.client.from('item_allergen_checks').select('bar_id').eq('item_id', ids.orgeat).eq('bar_id', ids.bar);
    assert.ifError(member.error);
    assert.equal(member.data.length, 1);
    const outsider = await users.outsider.client.from('item_allergen_checks').select('bar_id').eq('item_id', ids.orgeat).eq('bar_id', ids.bar);
    assert.ifError(outsider.error);
    assert.equal(outsider.data.length, 0);
  });

  test('a drink creator declares for the bar, an employee does not, nobody declares for another bar', async () => {
    const asEmployee = await users.employee.client.from('item_allergens').insert({ item_id: ids.vermouth, bar_id: ids.bar, allergen: 'milk' });
    assert.ok(asEmployee.error, 'an employee is refused');
    const elsewhere = await users.creator.client.from('item_allergens').insert({ item_id: ids.vermouth, bar_id: ids.otherBar, allergen: 'milk' });
    assert.ok(elsewhere.error, 'not a member there');
    const asCreator = await users.creator.client.from('item_allergens').insert({ item_id: ids.vermouth, bar_id: ids.bar, allergen: 'milk' });
    assert.ifError(asCreator.error);
    const check = await users.creator.client.from('item_allergen_checks').insert({ item_id: ids.vermouth, bar_id: ids.bar });
    assert.ifError(check.error);
    const gone = await users.creator.client.from('item_allergens').delete().eq('item_id', ids.vermouth).eq('bar_id', ids.bar);
    assert.ifError(gone.error);
    await service.from('item_allergen_checks').delete().eq('item_id', ids.vermouth).eq('bar_id', ids.bar);
  });

  test('the catalogue declaration goes with editing the item', async () => {
    const { error } = await users.creator.client.from('item_allergens').insert({ item_id: ids.vermouth, bar_id: null, allergen: 'milk' });
    assert.ok(error, 'a shared catalogue ingredient is not theirs to edit');
  });
});
