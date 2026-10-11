// Ingredient names on a public spec
// (supabase/migrations/20261012700000_public_spec_ingredient_names.sql).
//
// Someone outside a venue reads its published spec through
// app_recipe_presentation, each line's ingredient by its generic, and names it
// through published_ingredient (published_items). A line names its
// ingredient when that ingredient is in the shared catalog, or is a venue's
// own and published in its own right; a private house ingredient stays
// unnamed ("House ingredient" on the page). public_spec_changes uses the same
// rule for older versions of a spec.
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run public spec name tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

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

// What usePublishedDrink reads: each line with its ingredient as the public sees it.
async function publicLines(client) {
  const { data, error } = await client
    .from('app_recipe_presentation')
    .select('sort_order, display_ingredient_id, display_ingredient:published_ingredient(id, name)')
    .eq('recipe_item_id', ids.drink)
    .order('sort_order');
  assert.ifError(error);
  return data.map((r) => {
    const ing = Array.isArray(r.display_ingredient) ? r.display_ingredient[0] : r.display_ingredient;
    return { id: r.display_ingredient_id, name: ing?.name ?? null };
  });
}

before(async () => {
  await db.connect();
  for (const label of ['stranger', 'admin']) users[label] = await makeUser(label);

  // A bar with an Open page and a public profile, and another venue the stranger works at.
  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  await db.query("UPDATE public.bars SET page_visibility = 'open' WHERE id = $1", [ids.bar]);
  await serviceInsert('profiles', { kind: 'bar', handle: `rye${run}`, display_name: `Little Rye ${run}`, bar_id: ids.bar, is_public: true });
  ids.other = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });

  const item = async (row) => (await serviceInsert('items', { item_type: 'ingredient', ...row })).id;
  // Shared catalog generics and a shared brand of one of them.
  ids.rye = await item({ name: `Rye Whiskey ${run}` });
  ids.vermouth = await item({ name: `Sweet Vermouth ${run}` });
  ids.bitters = await item({ name: `Angostura ${run}` });
  ids.brand = await item({ name: `Rittenhouse ${run}`, generic_id: ids.rye });
  // The bar's own: a private house vermouth blend (a kind of sweet vermouth),
  // a private house syrup with no generic, and a published house cordial.
  ids.houseBlend = await item({ name: `Secret Blend ${run}`, bar_id: ids.bar, publish_mode: 'private', generic_id: ids.vermouth });
  ids.houseSyrup = await item({ name: `Secret Syrup ${run}`, bar_id: ids.bar, publish_mode: 'private' });
  ids.cordial = await item({ name: `Lime Cordial ${run}`, bar_id: ids.bar, publish_mode: 'description' });

  ids.drink = await item({ item_type: 'cocktail', name: `Rye Manhattan ${run}`, bar_id: ids.bar, publish_mode: 'spec' });
  const lines = [ids.brand, ids.houseBlend, ids.bitters, ids.houseSyrup, ids.cordial];
  for (const [i, ingredient] of lines.entries()) {
    await serviceInsert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ingredient, amount: 10 + i, unit: 'ml', sort_order: i });
  }
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1 AND item_type = $2', [like, 'cocktail']);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a published spec, read from outside the venue', () => {
  const expected = () => [
    // The shared brand shows as its shared generic, named.
    { id: ids.rye, name: `Rye Whiskey ${run}` },
    // A private house blend shows as its shared generic, named.
    { id: ids.vermouth, name: `Sweet Vermouth ${run}` },
    // A shared ingredient with no generic, named.
    { id: ids.bitters, name: `Angostura ${run}` },
    // A private house ingredient with no generic: unnamed.
    { id: ids.houseSyrup, name: null },
    // A house ingredient the bar published in its own right, named.
    { id: ids.cordial, name: `Lime Cordial ${run}` },
  ];

  test('signed in at another venue', async () => {
    assert.deepEqual(await publicLines(users.stranger.client), expected());
  });

  test('signed out', async () => {
    assert.deepEqual(await publicLines(anon), expected());
  });

  test('published_items has no row for a private house ingredient', async () => {
    const { data, error } = await anon.from('published_items').select('id').in('id', [ids.houseSyrup, ids.houseBlend]);
    assert.ifError(error);
    assert.deepEqual(data, []);
  });

  test("published_items names the shared lines as references, and the published cordial as itself", async () => {
    const { data, error } = await anon.from('published_items').select('id, is_reference').in('id', [ids.rye, ids.vermouth, ids.bitters, ids.brand, ids.cordial]);
    assert.ifError(error);
    const byId = Object.fromEntries(data.map((r) => [r.id, r.is_reference]));
    assert.deepEqual(byId, { [ids.rye]: true, [ids.vermouth]: true, [ids.bitters]: true, [ids.brand]: true, [ids.cordial]: false });
  });
});

describe('a published spec, read by its own bar', () => {
  test('the shared brand is still named on the public page', async () => {
    const lines = await publicLines(users.admin.client);
    assert.deepEqual(lines[0], { id: ids.brand, name: `Rittenhouse ${run}` });
  });
});

describe('the same rule as public_spec_changes', () => {
  test('an older version of the spec names the same lines', async () => {
    // A saved version with the drink's lines, shown to guests by the bar
    // (20261011160000_public_spec_changes.sql).
    const { rows } = await db.query(
      `SELECT jsonb_agg(jsonb_build_object('ingredient_item_id', ingredient_item_id, 'amount', amount, 'unit', unit) ORDER BY sort_order) AS lines
       FROM public.recipes WHERE recipe_item_id = $1`,
      [ids.drink]
    );
    await db.query('INSERT INTO public.item_versions (item_id, version, snapshot) VALUES ($1, 1, $2)', [ids.drink, { lines: rows[0].lines }]);
    await db.query('UPDATE public.bars SET show_spec_changes = true WHERE id = $1', [ids.bar]);
    const { data, error } = await users.stranger.client.rpc('public_spec_changes', { p_item: ids.drink });
    assert.ifError(error);
    const older = data[0].snapshot.lines.map((l) => ({ id: l.ingredient_item_id, name: l.name }));
    assert.deepEqual(older, await publicLines(users.stranger.client));
  });
});
