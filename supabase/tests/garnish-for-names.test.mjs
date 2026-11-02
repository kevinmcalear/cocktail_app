// Garnish where only names show (20261206485000_garnish_for_names.sql): a
// guest or the floor learns which line is the garnish, and still reads no
// amount, unit or prep note. Whoever can't read a line's name learns nothing
// about it. Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run garnish tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
const ROLES = { guest: 10, employee: 20, bartender: 30 };

async function makeUser(label) {
  const email = `${label}-${run}@garnish-test.local`;
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

/** What a person reads of the drink's lines, in pour order. */
async function lines(label, itemId) {
  const { data, error } = await users[label].client
    .from('app_recipe_presentation')
    .select('display_ingredient_id, amount, unit, preparation_notes, is_garnish, sort_order')
    .eq('recipe_item_id', itemId)
    .order('sort_order');
  if (error) throw error;
  return data.map((r) => ({ named: !!r.display_ingredient_id, amount: r.amount, unit: r.unit, prep: r.preparation_notes, garnish: r.is_garnish }));
}

before(async () => {
  ids.bar = (await insert('bars', { name: `Garnish bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    users[label] = await makeUser(label);
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.gin = (await insert('items', { name: `Gin ${run}`, item_type: 'ingredient' })).id;
  ids.peel = (await insert('items', { name: `Lemon peel ${run}`, item_type: 'ingredient' })).id;
  ids.drink = (await insert('items', { name: `Garnish martini ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.gin, amount: 60, unit: 'ml', preparation_notes: `stir long ${run}`, sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.peel, amount: 1, unit: 'Twist', sort_order: 1 });
});

after(async () => {
  for (const id of [ids.drink, ids.shared, ids.gin, ids.peel]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('garnish follows the name, never the amount', () => {
  test('the floor reads which line is the garnish, and no amount, unit or prep note', async () => {
    assert.deepEqual(await lines('employee', ids.drink), [
      { named: true, amount: null, unit: null, prep: null, garnish: false },
      { named: true, amount: null, unit: null, prep: null, garnish: true },
    ]);
  });

  test("a guest who can't read the names learns nothing, garnish included", async () => {
    assert.deepEqual(await lines('guest', ids.drink), [
      { named: false, amount: null, unit: null, prep: null, garnish: null },
      { named: false, amount: null, unit: null, prep: null, garnish: null },
    ]);
  });

  test('a bartender reads the spec as before, with the garnish said', async () => {
    const read = await lines('bartender', ids.drink);
    assert.deepEqual(read.map((l) => [l.amount, l.unit, l.garnish]), [[60, 'ml', false], [1, 'Twist', true]]);
  });
});

describe("the names list for a locked or signed-out page", () => {
  test('says garnish and still has no amount or unit to give', async () => {
    // A shared drink published by name (no bar, so no page to lock).
    ids.shared = (await insert('items', { name: `Shared martini ${run}`, item_type: 'cocktail', publish_mode: 'description', published_at: new Date().toISOString() })).id;
    await insert('recipes', { recipe_item_id: ids.shared, ingredient_item_id: ids.gin, amount: 60, unit: 'ml', sort_order: 0 });
    await insert('recipes', { recipe_item_id: ids.shared, ingredient_item_id: ids.peel, amount: 1, unit: 'twist', sort_order: 1 });
    const { data, error } = await anon.rpc('public_drink_ingredients', { p_item_ids: [ids.shared] });
    assert.ifError(error);
    assert.equal(data.length, 2, 'a published drink lists its names');
    for (const row of data) assert.deepEqual(Object.keys(row).sort(), ['brand', 'garnish', 'item_id', 'name', 'sort_order'], 'no amount or unit column');
    assert.deepEqual(data.map((r) => r.garnish), [false, true]);
  });
});
