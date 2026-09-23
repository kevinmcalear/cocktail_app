// Row-level security and storage tests, run through the real API as real users.
//
// Needs the local stack with migrations applied:
//   supabase start && supabase db reset
//   npm run test:security
//
// Every fixture is named with a per-run id and removed afterwards, so the suite
// can run against a local database that already holds data.

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
const API_URL = status.API_URL;
const ANON_KEY = status.ANON_KEY;
const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(API_URL)) {
  throw new Error(`Refusing to run security tests against a non-local API: ${API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

const service = createClient(API_URL, SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(API_URL, ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const uploadedPaths = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(API_URL, ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function itemName(id) {
  const { data } = await service.from('items').select('name').eq('id', id).single();
  return data?.name;
}

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

before(async () => {
  await db.connect();

  for (const label of ['owner', 'creator', 'bartender', 'outsider', 'otherAdmin', 'catalogAdmin', 'invitee']) {
    users[label] = await makeUser(label);
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);

  ids.barOne = (await serviceInsert('bars', { name: `Bar One ${run}` })).id;
  ids.barTwo = (await serviceInsert('bars', { name: `Bar Two ${run}` })).id;
  for (const [label, bar, role] of [
    ['owner', ids.barOne, 40],
    ['creator', ids.barOne, 35],
    ['bartender', ids.barOne, 30],
    ['otherAdmin', ids.barTwo, 40],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: bar, role_level: role });
  }

  ids.legacyGlobal = (await serviceInsert('items', { name: `Legacy gin ${run}`, item_type: 'ingredient', created_by: null })).id;
  ids.outsiderPersonal = (
    await serviceInsert('items', { name: `Outsider syrup ${run}`, item_type: 'ingredient', created_by: users.outsider.id })
  ).id;
  ids.barCocktail = (await serviceInsert('items', { name: `Bar One sour ${run}`, item_type: 'cocktail', bar_id: ids.barOne })).id;
  ids.barTwoCocktail = (await serviceInsert('items', { name: `Bar Two fizz ${run}`, item_type: 'cocktail', bar_id: ids.barTwo })).id;
  ids.recipe = (
    await serviceInsert('recipes', {
      recipe_item_id: ids.barCocktail,
      ingredient_item_id: ids.legacyGlobal,
      amount: 2,
      unit: 'oz',
      preparation_notes: `secret prep ${run}`,
      sort_order: 0,
    })
  ).id;

  ids.legacyMenu = (await serviceInsert('menus', { name: `Legacy menu ${run}`, created_by: null })).id;
  ids.barMenu = (await serviceInsert('menus', { name: `Bar One menu ${run}`, bar_id: ids.barOne })).id;
  await serviceInsert('menu_drinks', { menu_id: ids.barMenu, item_id: ids.barCocktail, sort_order: 0 });
  ids.legacyTemplate = (await serviceInsert('menu_templates', { name: `Legacy template ${run}`, created_by: null })).id;

  ids.ownerBarDraft = (
    await serviceInsert('drafts', { user_id: users.owner.id, bar_id: ids.barOne, entity_type: 'cocktail', draft_data: {} })
  ).id;
});

after(async () => {
  if (uploadedPaths.length) await service.storage.from('drinks').remove(uploadedPaths);
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menu_templates WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.categories WHERE name LIKE $1', [like]);
  await db.query(
    'DELETE FROM public.drafts WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE $1)',
    [like]
  );
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('signed-out requests', () => {
  test('cannot read the catalog', async () => {
    const { data } = await anon.from('items').select('id').eq('id', ids.legacyGlobal);
    assert.deepEqual(data, []);
  });

  test('cannot insert items', async () => {
    const { error } = await anon.from('items').insert({ name: `anon ${run}`, item_type: 'ingredient' });
    assert.ok(error);
  });

  test('cannot delete items', async () => {
    await anon.from('items').delete().eq('id', ids.legacyGlobal);
    assert.equal(await itemName(ids.legacyGlobal), `Legacy gin ${run}`);
  });

  test('cannot call bar RPCs', async () => {
    const { error } = await anon.rpc('create_new_bar', {
      p_name: `anon bar ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40,
    });
    assert.ok(error);
  });

  test('cannot upload to the drinks bucket, including the old public/ folder', async () => {
    for (const path of [`cocktails/${run}/anon.png`, `public/${run}.jpg`]) {
      const { error } = await anon.storage.from('drinks').upload(path, png, { contentType: 'image/png' });
      assert.ok(error, `anon upload to ${path} should fail`);
    }
  });
});

describe('a new account with no bars', () => {
  test('sees shared rows but not any bar\'s rows', async () => {
    const { data } = await users.outsider.client
      .from('items')
      .select('id')
      .in('id', [ids.legacyGlobal, ids.outsiderPersonal, ids.barCocktail, ids.barTwoCocktail]);
    assert.deepEqual(new Set(data.map((r) => r.id)), new Set([ids.legacyGlobal, ids.outsiderPersonal]));
  });

  test('cannot read another bar\'s recipes, bar row or menu', async () => {
    const client = users.outsider.client;
    assert.deepEqual((await client.from('recipes').select('id').eq('id', ids.recipe)).data, []);
    assert.deepEqual((await client.from('bars').select('id').eq('id', ids.barOne)).data, []);
    assert.deepEqual((await client.from('menus').select('id').eq('id', ids.barMenu)).data, []);
  });

  test('cannot edit or delete the legacy shared catalog', async () => {
    const client = users.outsider.client;
    await client.from('items').update({ name: 'vandalised' }).eq('id', ids.legacyGlobal);
    await client.from('items').delete().eq('id', ids.legacyGlobal);
    assert.equal(await itemName(ids.legacyGlobal), `Legacy gin ${run}`);
  });

  test('cannot delete another bar\'s recipes', async () => {
    await users.outsider.client.from('recipes').delete().eq('recipe_item_id', ids.barCocktail);
    const { data } = await service.from('recipes').select('id').eq('id', ids.recipe);
    assert.equal(data.length, 1);
  });

  test('can create and edit a personal item, recorded as its creator', async () => {
    const client = users.outsider.client;
    const { data, error } = await client
      .from('items')
      .insert({ name: `Mine ${run}`, item_type: 'ingredient' })
      .select('id, created_by')
      .single();
    assert.ifError(error);
    assert.equal(data.created_by, users.outsider.id);

    const { data: updated } = await client.from('items').update({ notes: 'ok' }).eq('id', ids.outsiderPersonal).select('id');
    assert.equal(updated.length, 1);
  });

  test('cannot create an item inside someone else\'s bar', async () => {
    const { error } = await users.outsider.client
      .from('items')
      .insert({ name: `Intruder ${run}`, item_type: 'cocktail', bar_id: ids.barOne });
    assert.ok(error);
  });

  test('cannot claim a created_by that is not theirs', async () => {
    const { error } = await users.outsider.client
      .from('items')
      .insert({ name: `Forged ${run}`, item_type: 'ingredient', created_by: users.owner.id });
    assert.ok(error);
  });

  test('cannot join a bar by inserting a membership, even after creating their own bar', async () => {
    const client = users.outsider.client;
    const { data: bar, error: createError } = await client.rpc('create_new_bar', {
      p_name: `Outsider bar ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40,
    });
    assert.ifError(createError);
    ids.outsiderBar = bar.id;

    const { error } = await client
      .from('user_bars')
      .insert({ user_id: users.outsider.id, bar_id: ids.barOne, role_level: 40 });
    assert.ok(error);
  });

  test('cannot move the shared catalog into their own bar', async () => {
    const { error } = await users.outsider.client.rpc('assign_item_to_bar', {
      p_item_id: ids.legacyGlobal, p_bar_id: ids.outsiderBar,
    });
    assert.ok(error);
  });

  test('cannot edit legacy menus, other bars\' menu drinks or legacy templates', async () => {
    const client = users.outsider.client;
    const { data: menu } = await client.from('menus').update({ name: 'vandalised' }).eq('id', ids.legacyMenu).select('id');
    assert.deepEqual(menu, []);
    const { error: drinkError } = await client
      .from('menu_drinks')
      .insert({ menu_id: ids.barMenu, item_id: ids.legacyGlobal, sort_order: 1 });
    assert.ok(drinkError);
    const { data: template } = await client
      .from('menu_templates')
      .update({ name: 'vandalised' })
      .eq('id', ids.legacyTemplate)
      .select('id');
    assert.deepEqual(template, []);
  });

  test('cannot see or create drafts in another bar', async () => {
    const client = users.outsider.client;
    assert.deepEqual((await client.from('drafts').select('id').eq('id', ids.ownerBarDraft)).data, []);
    const { error } = await client
      .from('drafts')
      .insert({ user_id: users.outsider.id, bar_id: ids.barOne, entity_type: 'cocktail', draft_data: {} });
    assert.ok(error);
  });

  test('cannot write categories', async () => {
    const { error } = await users.outsider.client.from('categories').insert({ name: `Junk ${run}` });
    assert.ok(error);
  });

  test('uploads only into the app\'s folders, only images, and never overwrites', async () => {
    const storage = users.outsider.client.storage.from('drinks');
    const good = `cocktails/${run}/outsider.png`;
    const { error: goodError } = await storage.upload(good, png, { contentType: 'image/png' });
    assert.ifError(goodError);
    uploadedPaths.push(good);

    for (const path of [`bars/${run}/logo.png`, `glassware-icons/${run}.png`, `elsewhere/${run}.png`]) {
      const { error } = await storage.upload(path, png, { contentType: 'image/png' });
      assert.ok(error, `upload to ${path} should fail`);
    }

    const { error: textError } = await storage.upload(`cocktails/${run}/note.txt`, 'hi', { contentType: 'text/plain' });
    assert.ok(textError, 'non-image upload should fail');

    const { error: overwriteError } = await users.bartender.client.storage
      .from('drinks')
      .upload(good, png, { contentType: 'image/png', upsert: true });
    assert.ok(overwriteError, 'overwriting someone else\'s file should fail');
  });

  test('can ask can_edit_item about itself, but cannot spend AI quota directly', async () => {
    const client = users.outsider.client;
    assert.equal((await client.rpc('can_edit_item', { p_item_id: ids.legacyGlobal })).data, false);
    assert.equal((await client.rpc('can_edit_item', { p_item_id: ids.outsiderPersonal })).data, true);
    const { error } = await client.rpc('consume_ai_quota', { p_user_id: users.outsider.id, p_fn: 'x', p_daily_limit: 99 });
    assert.ok(error);
  });
});

describe('an admin of a different bar', () => {
  test('cannot add themselves to another bar', async () => {
    const { error } = await users.otherAdmin.client
      .from('user_bars')
      .insert({ user_id: users.otherAdmin.id, bar_id: ids.barOne, role_level: 40 });
    assert.ok(error);
  });

  test('cannot change or remove another bar\'s members', async () => {
    const client = users.otherAdmin.client;
    await client.from('user_bars').update({ role_level: 10 }).eq('bar_id', ids.barOne);
    await client.from('user_bars').delete().eq('bar_id', ids.barOne);
    const { data } = await service.from('user_bars').select('user_id, role_level').eq('bar_id', ids.barOne);
    assert.equal(data.length, 3);
    assert.equal(data.find((r) => r.user_id === users.owner.id).role_level, 40);
  });

  test('cannot invite people into another bar', async () => {
    const { error } = await users.otherAdmin.client.rpc('add_user_to_bar_by_email', {
      p_email: users.invitee.email, p_bar_id: ids.barOne, p_role_level: 40,
    });
    assert.ok(error);
  });
});

describe('members of a bar', () => {
  test('a bartender (30) can read the bar\'s drinks but not edit them', async () => {
    const client = users.bartender.client;
    assert.equal((await client.from('items').select('id').eq('id', ids.barCocktail)).data.length, 1);
    const { data } = await client.from('items').update({ name: 'changed' }).eq('id', ids.barCocktail).select('id');
    assert.deepEqual(data, []);
    const { error } = await client
      .from('recipes')
      .insert({ recipe_item_id: ids.barCocktail, ingredient_item_id: ids.legacyGlobal, sort_order: 5 });
    assert.ok(error);
  });

  test('a bartender does not see other people\'s bar drafts', async () => {
    const { data } = await users.bartender.client.from('drafts').select('id').eq('id', ids.ownerBarDraft);
    assert.deepEqual(data, []);
  });

  test('the presentation views apply bar visibility and hide prep notes below the prep level', async () => {
    const client = users.bartender.client;
    const { data: items } = await client
      .from('app_item_presentation')
      .select('id')
      .in('id', [ids.barCocktail, ids.barTwoCocktail]);
    assert.deepEqual(items.map((r) => r.id), [ids.barCocktail]);

    const { data: recipes } = await client
      .from('app_recipe_presentation')
      .select('amount, preparation_notes')
      .eq('recipe_item_id', ids.barCocktail);
    assert.equal(recipes.length, 1);
    assert.equal(Number(recipes[0].amount), 2);
    assert.equal(recipes[0].preparation_notes, null);
  });

  test('a drink creator (35) edits the bar\'s drinks and recipes', async () => {
    const client = users.creator.client;
    const { data } = await client.from('items').update({ notes: 'tweaked' }).eq('id', ids.barCocktail).select('id');
    assert.equal(data.length, 1);

    const { data: recipe, error } = await client
      .from('recipes')
      .insert({ recipe_item_id: ids.barCocktail, ingredient_item_id: ids.legacyGlobal, sort_order: 9 })
      .select('id')
      .single();
    assert.ifError(error);
    const { data: deleted } = await client.from('recipes').delete().eq('id', recipe.id).select('id');
    assert.equal(deleted.length, 1);
  });

  test('a drink creator creates in their bar but not in another', async () => {
    const client = users.creator.client;
    const { error: ownBar } = await client
      .from('items')
      .insert({ name: `Creator new ${run}`, item_type: 'cocktail', bar_id: ids.barOne });
    assert.ifError(ownBar);
    const { error: otherBar } = await client
      .from('items')
      .insert({ name: `Creator elsewhere ${run}`, item_type: 'cocktail', bar_id: ids.barTwo });
    assert.ok(otherBar);
  });

  test('a drink creator sees the bar\'s drafts, cannot touch the shared catalog or bar settings', async () => {
    const client = users.creator.client;
    assert.equal((await client.from('drafts').select('id').eq('id', ids.ownerBarDraft)).data.length, 1);
    await client.from('items').update({ name: 'vandalised' }).eq('id', ids.legacyGlobal);
    assert.equal(await itemName(ids.legacyGlobal), `Legacy gin ${run}`);
    const { data } = await client.from('bars').update({ name: 'renamed' }).eq('id', ids.barOne).select('id');
    assert.deepEqual(data, []);
  });

  test('an admin (40) manages members with valid roles only', async () => {
    const client = users.owner.client;
    const { error: badRole } = await client.rpc('add_user_to_bar_by_email', {
      p_email: users.invitee.email, p_bar_id: ids.barOne, p_role_level: 99,
    });
    assert.ok(badRole);

    const { error } = await client.rpc('add_user_to_bar_by_email', {
      p_email: users.invitee.email, p_bar_id: ids.barOne, p_role_level: 10,
    });
    assert.ifError(error);

    const { data } = await client
      .from('user_bars')
      .update({ role_level: 20 })
      .eq('bar_id', ids.barOne)
      .eq('user_id', users.invitee.id)
      .select('role_level');
    assert.deepEqual(data, [{ role_level: 20 }]);
  });

  test('an admin still cannot move the shared catalog into their bar', async () => {
    const { error } = await users.owner.client.rpc('assign_item_to_bar', {
      p_item_id: ids.legacyGlobal, p_bar_id: ids.barOne,
    });
    assert.ok(error);
  });
});

describe('catalog admins', () => {
  test('edit legacy shared items, menus, templates and categories', async () => {
    const client = users.catalogAdmin.client;
    const { data: item } = await client.from('items').update({ notes: 'curated' }).eq('id', ids.legacyGlobal).select('id');
    assert.equal(item.length, 1);
    const { data: menu } = await client.from('menus').update({ is_active: true }).eq('id', ids.legacyMenu).select('id');
    assert.equal(menu.length, 1);
    const { data: template } = await client
      .from('menu_templates')
      .update({ description: 'curated' })
      .eq('id', ids.legacyTemplate)
      .select('id');
    assert.equal(template.length, 1);
    const { error } = await client.from('categories').insert({ name: `Curated ${run}` });
    assert.ifError(error);
  });

  test('do not see inside bars they are not members of', async () => {
    const { data } = await users.catalogAdmin.client.from('items').select('id').eq('id', ids.barCocktail);
    assert.deepEqual(data, []);
  });
});

describe('AI quota', () => {
  test('allows calls up to the daily limit, then refuses', async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await service.rpc('consume_ai_quota', {
        p_user_id: users.invitee.id, p_fn: 'test', p_daily_limit: 2,
      });
      assert.ifError(error);
      results.push(data);
    }
    assert.deepEqual(results, [true, true, false]);
  });
});
