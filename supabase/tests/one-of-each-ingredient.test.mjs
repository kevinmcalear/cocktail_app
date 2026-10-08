// One of each ingredient (20261008100000_one_of_each_ingredient.sql): a name
// key shared with the app, aliases, the core list, the guard that refuses a
// second copy of an ingredient, versions that say what they're a kind of, and
// merging a copy into the real one.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run ingredient tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const users = {};
const made = [];

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw error;
  if (table === 'items') made.push(data.id);
  return data;
}

async function signedIn(email) {
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

// A name only this run uses, so parallel runs and seeds never collide.
const n = (name) => `${name} ${run}`;

before(async () => {
  await db.connect();
  ids.bar = (await serviceInsert('bars', { name: `Ingredients ${run}`, slug: `ingredients-${run}` })).id;
  users.member = await signedIn(`member-${run}@security-test.local`);
  users.admin = await signedIn(`admin-${run}@security-test.local`);
  const { error } = await service.from('user_bars').insert({ user_id: users.member.id, bar_id: ids.bar, role_level: 40 });
  if (error) throw error;
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
  ids.simple = (await serviceInsert('items', { name: n('Simple Syrup'), item_type: 'ingredient', is_core: true })).id;
  await db.query('INSERT INTO public.ingredient_aliases (key, item_id) VALUES (public.ingredient_key($1), $2)', [n('1:1 Sugar Syrup'), ids.simple]);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [made]);
  await db.query("DELETE FROM public.items WHERE name LIKE '%' || $1", [run]);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin?.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('one of each ingredient', () => {
  test('the key matches the app (lib/ingredientNames.ts)', async () => {
    const cases = {
      'Simple Syrup, 1:1': 'simple syrup 1:1',
      'Crème de Cassis': 'creme de cassis',
      'Peychaud’s Bitters': 'peychauds bitters',
      'Rock & Rye': 'rock and rye',
      'Añejo Tequila': 'anejo tequila',
      'Økar Island Bitter': 'okar island bitter',
    };
    for (const [name, key] of Object.entries(cases)) {
      const { rows } = await db.query('SELECT public.ingredient_key($1) AS k', [name]);
      assert.equal(rows[0].k, key, name);
    }
    const { rows } = await db.query("SELECT public.ingredient_key('  ') AS k");
    assert.equal(rows[0].k, null);
  });

  test('another spelling of a shared ingredient is refused, and says which to use', async () => {
    const { error } = await users.member.client.from('items').insert({ name: n('simple-syrup'), item_type: 'ingredient' });
    assert.equal(error?.code, 'P0001');
    assert.match(error.message, /is already an ingredient/);
    assert.equal(error.hint, ids.simple);
  });

  test('an alias is refused too, and resolve_ingredient finds it', async () => {
    const { error } = await users.member.client.from('items').insert({ name: n('1:1 sugar syrup'), item_type: 'ingredient' });
    assert.equal(error?.hint, ids.simple);
    const { data } = await users.member.client.rpc('resolve_ingredient', { p_name: n('1:1 Sugar-Syrup') });
    assert.equal(data, ids.simple);
    const { data: none } = await users.member.client.rpc('resolve_ingredient', { p_name: n('Honey Syrup') });
    assert.equal(none, null);
  });

  test("a venue keeps its own version only as a kind of the shared one", async () => {
    const plain = await users.member.client.from('items').insert({ name: n('Simple Syrup'), item_type: 'ingredient', bar_id: ids.bar });
    assert.equal(plain.error?.code, 'P0001');
    const version = await users.member.client
      .from('items')
      .insert({ name: n('Simple Syrup'), item_type: 'ingredient', bar_id: ids.bar, generic_id: ids.simple })
      .select('id')
      .single();
    assert.equal(version.error, null);
    made.push(version.data.id);
    // and can't quietly stop being one
    const unlink = await users.member.client.from('items').update({ generic_id: null }).eq('id', version.data.id);
    assert.equal(unlink.error?.code, 'P0001');
  });

  test('a new name ending in a core one becomes a kind of it', async () => {
    // "<run> Lavender Simple Syrup <run>" would not end with the core name, so build it to.
    const coreName = n('Simple Syrup');
    const { data, error } = await users.member.client
      .from('items')
      .insert({ name: `Lavender ${coreName}`, item_type: 'ingredient' })
      .select('id, generic_id')
      .single();
    assert.equal(error, null);
    made.push(data.id);
    assert.equal(data.generic_id, ids.simple);
  });

  test('only app admins curate the core list and aliases', async () => {
    const core = await users.member.client.from('items').insert({ name: n('Orgeat'), item_type: 'ingredient', is_core: true });
    assert.ok(core.error, 'a member cannot add a core ingredient');
    const alias = await users.member.client.from('ingredient_aliases').insert({ key: `simple ${run}`, item_id: ids.simple });
    assert.ok(alias.error, 'a member cannot add an alias');
    const { data: read, error: readError } = await anon.from('ingredient_aliases').select('key, item_id').eq('item_id', ids.simple);
    assert.equal(readError, null);
    assert.ok(read.length >= 1, 'anyone reads aliases');
    const adminCore = await users.admin.client.from('items').insert({ name: n('Orgeat'), item_type: 'ingredient', is_core: true }).select('id').single();
    assert.equal(adminCore.error, null);
    made.push(adminCore.data.id);
  });

  test('merging moves every reference, keeps the name as an alias, and drops the copy', async () => {
    const copy = (await serviceInsert('items', { name: n('Gomme'), item_type: 'ingredient' })).id;
    const real = (await serviceInsert('items', { name: n('Gomme Syrup'), item_type: 'ingredient', generic_id: ids.simple })).id;
    const child = (await serviceInsert('items', { name: n('Ube Gomme'), item_type: 'ingredient', generic_id: copy })).id;
    const drink = (await serviceInsert('items', { name: n('Gomme Fizz'), item_type: 'cocktail', bar_id: ids.bar })).id;
    await serviceInsert('recipes', { recipe_item_id: drink, ingredient_item_id: copy, amount: 15, unit: 'ml', sort_order: 0 });
    const { rows: cats } = await db.query('SELECT id FROM public.categories LIMIT 1');
    if (cats[0]) {
      await db.query('INSERT INTO public.item_categories (item_id, category_id) VALUES ($1, $3), ($2, $3)', [copy, real, cats[0].id]);
    }

    const refused = await users.member.client.rpc('merge_ingredients', { p_from: copy, p_into: real });
    assert.ok(refused.error, 'only app admins merge');

    const { error } = await users.admin.client.rpc('merge_ingredients', { p_from: copy, p_into: real });
    assert.equal(error, null);
    const { rows: line } = await db.query('SELECT ingredient_item_id FROM public.recipes WHERE recipe_item_id = $1', [drink]);
    assert.equal(line[0].ingredient_item_id, real);
    const { rows: kid } = await db.query('SELECT generic_id FROM public.items WHERE id = $1', [child]);
    assert.equal(kid[0].generic_id, real);
    const { rows: gone } = await db.query('SELECT 1 FROM public.items WHERE id = $1', [copy]);
    assert.equal(gone.length, 0);
    const { rows: alias } = await db.query('SELECT item_id FROM public.ingredient_aliases WHERE key = public.ingredient_key($1)', [n('Gomme')]);
    assert.equal(alias[0]?.item_id, real);
    if (cats[0]) {
      const { rows } = await db.query('SELECT count(*)::int AS c FROM public.item_categories WHERE item_id = $1', [real]);
      assert.equal(rows[0].c, 1, 'the clashing category row stays single');
    }
  });

  test('the app sees is_core', async () => {
    const { data, error } = await users.member.client.from('app_item_presentation').select('id, is_core').eq('id', ids.simple).single();
    assert.equal(error, null);
    assert.equal(data.is_core, true);
  });
});
