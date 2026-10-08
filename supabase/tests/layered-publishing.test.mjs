// Layered publishing, memories, and private personal drinks
// (supabase/migrations/20260930500400_layered_publishing_and_memories.sql).
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
  throw new Error(`Refusing to run publishing tests against a non-local API: ${status.API_URL}`);
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

const published = async (client, key) => {
  const { data, error } = await client.from('published_items').select('id, publish_mode, is_reference').eq('id', ids.items[key]);
  assert.ifError(error);
  return data[0] ?? null;
};

const specRows = async (client, key) => {
  const { data, error } = await client
    .from('app_recipe_presentation')
    .select('display_ingredient_id, amount')
    .eq('recipe_item_id', ids.items[key])
    .order('sort_order');
  assert.ifError(error);
  return data;
};

const thirtyYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  await db.connect();
  for (const label of ['openAdmin', 'openMaker', 'closedAdmin', 'homeUser', 'stranger', 'collector']) {
    users[label] = await makeUser(label);
  }

  // An open bar (everything public with its spec unless a drink says otherwise)
  // and a closed one that publishes one menu as descriptions.
  ids.openBar = (await serviceInsert('bars', { name: `Open House ${run}` })).id;
  ids.closedBar = (await serviceInsert('bars', { name: `Speakeasy ${run}` })).id;
  ids.noProfileBar = (await serviceInsert('bars', { name: `Nobody Knows ${run}` })).id;
  for (const [label, bar, role] of [
    ['openAdmin', ids.openBar, 40],
    ['openMaker', ids.openBar, 35],
    ['closedAdmin', ids.closedBar, 40],
    ['closedAdmin', ids.noProfileBar, 40],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: bar, role_level: role });
  }
  for (const [bar, handle, name] of [
    [ids.openBar, `open${run}`, `Open House ${run}`],
    [ids.closedBar, `speak${run}`, `Speakeasy ${run}`],
  ]) {
    await serviceInsert('profiles', { kind: 'bar', handle, display_name: name, bar_id: bar, is_public: true });
  }
  await serviceInsert('profiles', { kind: 'person', handle: `home${run}`, display_name: 'Home', user_id: users.homeUser.id, is_public: true });

  // Set through SQL: the service role skips the publish guards, like a migration would.
  await db.query("UPDATE public.bars SET default_publish_mode = 'spec' WHERE id = $1", [ids.openBar]);

  const item = async (row) => (await serviceInsert('items', row)).id;
  ids.items = {};
  ids.items.lemon = await item({ name: `Lemon ${run}`, item_type: 'ingredient' });
  ids.items.honey = await item({ name: `Honey ${run}`, item_type: 'ingredient' });
  ids.items.houseSyrup = await item({ name: `House syrup ${run}`, item_type: 'ingredient', bar_id: ids.openBar });
  ids.items.secretSyrup = await item({ name: `Secret syrup ${run}`, item_type: 'ingredient', bar_id: ids.openBar, publish_mode: 'private' });
  ids.items.openDrink = await item({ name: `Open Sour ${run}`, item_type: 'cocktail', bar_id: ids.openBar, description: 'Public.' });
  ids.items.hiddenDrink = await item({ name: `Hidden Sour ${run}`, item_type: 'cocktail', bar_id: ids.openBar, publish_mode: 'private' });
  ids.items.onMenu = await item({ name: `Menu Fizz ${run}`, item_type: 'cocktail', bar_id: ids.closedBar });
  ids.items.offMenu = await item({ name: `Back Room ${run}`, item_type: 'cocktail', bar_id: ids.closedBar });
  ids.items.menuButPrivate = await item({ name: `Menu Secret ${run}`, item_type: 'cocktail', bar_id: ids.closedBar, publish_mode: 'private' });
  ids.items.homeDrink = await item({ name: `Kitchen Sour ${run}`, item_type: 'cocktail', created_by: users.homeUser.id });
  ids.items.homeIngredient = await item({ name: `Kitchen shrub ${run}`, item_type: 'ingredient', created_by: users.homeUser.id });

  for (const [drink, rows] of [
    ['openDrink', [
      { ingredient_item_id: ids.items.houseSyrup, amount: 20, unit: 'ml' },
      { ingredient_item_id: ids.items.secretSyrup, amount: 10, unit: 'ml' },
    ]],
    ['houseSyrup', [{ ingredient_item_id: ids.items.honey, amount: 1, unit: 'part' }]],
    ['secretSyrup', [{ ingredient_item_id: ids.items.honey, amount: 3, unit: 'part' }]],
    ['onMenu', [{ ingredient_item_id: ids.items.lemon, amount: 25, unit: 'ml' }]],
    ['homeDrink', [{ ingredient_item_id: ids.items.lemon, amount: 30, unit: 'ml' }]],
  ]) {
    for (const [sort_order, row] of rows.entries()) {
      await serviceInsert('recipes', { recipe_item_id: ids.items[drink], sort_order, ...row });
    }
  }

  ids.menu = (await serviceInsert('menus', { name: `Garden menu ${run}`, bar_id: ids.closedBar })).id;
  for (const key of ['onMenu', 'menuButPrivate']) {
    await serviceInsert('menu_drinks', { menu_id: ids.menu, item_id: ids.items[key] });
  }
  await db.query("UPDATE public.menus SET publish_mode = 'description' WHERE id = $1", [ids.menu]);

  const { error } = await users.collector.client.rpc('confirm_age', { p_birth_date: thirtyYearsAgo(), p_country_code: 'AU' });
  if (error) throw error;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('layered publishing', () => {
  test('an open bar publishes its drinks with the spec, except one set to private', async () => {
    assert.equal((await published(anon, 'openDrink'))?.publish_mode, 'spec');
    assert.equal((await specRows(anon, 'openDrink')).length, 2);
    assert.equal(await published(anon, 'hiddenDrink'), null);
  });

  test('down to the ingredient: the secret syrup is named in the spec, but its own recipe stays private', async () => {
    const rows = await specRows(anon, 'openDrink');
    assert.ok(rows.some((r) => r.display_ingredient_id === ids.items.secretSyrup));
    assert.equal((await published(anon, 'secretSyrup'))?.is_reference, true);
    assert.deepEqual(await specRows(anon, 'secretSyrup'), []);
    // The house syrup follows the bar's default, so its recipe is public.
    assert.equal((await specRows(anon, 'houseSyrup')).length, 1);
  });

  test('a closed bar publishes one menu as descriptions: only its drinks, and not a drink set to private', async () => {
    assert.equal((await published(anon, 'onMenu'))?.publish_mode, 'description');
    assert.deepEqual(await specRows(anon, 'onMenu'), []);
    assert.equal(await published(anon, 'offMenu'), null);
    assert.equal(await published(anon, 'menuButPrivate'), null);
  });

  test('a bar admin can open the bar; a Drink Creator and a bar with no public profile cannot', async () => {
    const byMaker = await users.openMaker.client
      .from('bars').update({ default_publish_mode: 'description' }).eq('id', ids.openBar).select('id');
    assert.deepEqual(byMaker.data ?? [], []);
    const noProfile = await users.closedAdmin.client
      .from('bars').update({ default_publish_mode: 'spec' }).eq('id', ids.noProfileBar);
    assert.match(noProfile.error?.message ?? '', /public profile/);
    const byAdmin = await users.closedAdmin.client
      .from('bars').update({ default_publish_mode: 'description' }).eq('id', ids.closedBar).select('id');
    assert.ifError(byAdmin.error);
    assert.equal(byAdmin.data.length, 1);
    assert.equal((await published(anon, 'offMenu'))?.publish_mode, 'description');
    await db.query("UPDATE public.bars SET default_publish_mode = 'private' WHERE id = $1", [ids.closedBar]);
  });

  test('only the bar\'s publishers set a menu\'s mode, and home menus aren\'t published', async () => {
    await users.openMaker.client.from('menus').update({ publish_mode: 'spec' }).eq('id', ids.menu);
    const { rows } = await db.query('SELECT publish_mode FROM public.menus WHERE id = $1', [ids.menu]);
    assert.equal(rows[0].publish_mode, 'description');
    const home = await users.homeUser.client
      .from('menus').insert({ name: `My party ${run}`, publish_mode: 'description' });
    assert.match(home.error?.message ?? '', /Only a bar's menus/);
  });
});

describe('personal drinks are private until published', () => {
  test('only the creator reads their drink and its spec, and their own ingredients (20261008830000)', async () => {
    const byStranger = await users.stranger.client.from('items').select('id').eq('id', ids.items.homeDrink);
    assert.deepEqual(byStranger.data, []);
    assert.deepEqual(await specRows(users.stranger.client, 'homeDrink'), []);
    const byOwner = await users.homeUser.client.from('items').select('id').eq('id', ids.items.homeDrink);
    assert.equal(byOwner.data.length, 1);
    assert.equal((await specRows(users.homeUser.client, 'homeDrink')).length, 1);
    const theirs = await users.stranger.client.from('items').select('id').eq('id', ids.items.homeIngredient);
    assert.deepEqual(theirs.data, []);
    const mine = await users.homeUser.client.from('items').select('id').eq('id', ids.items.homeIngredient);
    assert.equal(mine.data.length, 1);
  });

  test('once published with its spec, everyone can read it', async () => {
    const { error } = await users.homeUser.client.from('items').update({ publish_mode: 'spec' }).eq('id', ids.items.homeDrink);
    assert.ifError(error);
    const byStranger = await users.stranger.client.from('items').select('id').eq('id', ids.items.homeDrink);
    assert.equal(byStranger.data.length, 1);
    assert.equal((await specRows(users.stranger.client, 'homeDrink')).length, 1);
    assert.equal((await published(anon, 'homeDrink'))?.publish_mode, 'spec');
  });
});

describe('memories', () => {
  test('a collected drink keeps its name and bar after the bar makes it private, and after it is deleted', async () => {
    const collect = await users.collector.client
      .from('collected_items').insert({ item_id: ids.items.openDrink }).select('id, name, bar_name').single();
    assert.ifError(collect.error);
    assert.equal(collect.data.name, `Open Sour ${run}`);
    assert.equal(collect.data.bar_name, `Open House ${run}`);

    const hide = await users.openAdmin.client.from('items').update({ publish_mode: 'private' }).eq('id', ids.items.openDrink);
    assert.ifError(hide.error);
    assert.equal(await published(users.collector.client, 'openDrink'), null);
    const kept = await users.collector.client.from('collected_items').select('name, item_id').eq('id', collect.data.id).single();
    assert.equal(kept.data.name, `Open Sour ${run}`);

    await db.query('DELETE FROM public.items WHERE id = $1', [ids.items.openDrink]);
    const orphan = await users.collector.client.from('collected_items').select('name, item_id').eq('id', collect.data.id).single();
    assert.equal(orphan.data.item_id, null);
    assert.equal(orphan.data.name, `Open Sour ${run}`);
  });

  test('collectors add when they had it and a note, but can\'t rewrite the memory', async () => {
    const { data } = await users.collector.client.from('collected_items').select('id').limit(1).single();
    const note = await users.collector.client
      .from('collected_items').update({ had_on: '2026-09-27', note: 'Birthday, the one with the smoke.' }).eq('id', data.id);
    assert.ifError(note.error);
    const rename = await users.collector.client.from('collected_items').update({ name: 'Something else' }).eq('id', data.id);
    assert.ok(rename.error, 'renaming a memory should be refused');
    const byStranger = await users.stranger.client.from('collected_items').select('id').eq('id', data.id);
    assert.deepEqual(byStranger.data, []);
  });

  // 20260930500700_release_memories.sql
  test('a collected release keeps its name and bar after the bar takes it down, and after it is deleted', async () => {
    const release = await serviceInsert('releases', { bar_id: ids.closedBar, name: `Garden release ${run}`, release_date: '2026-09-27' });
    await serviceInsert('release_items', { release_id: release.id, bar_id: ids.closedBar, item_id: ids.items.onMenu });
    await db.query("UPDATE public.releases SET published_at = now() - interval '5 minutes' WHERE id = $1", [release.id]);

    const collect = await users.collector.client
      .from('collected_releases').insert({ release_id: release.id }).select('id, name, bar_name, release_date').single();
    assert.ifError(collect.error);
    assert.equal(collect.data.name, `Garden release ${run}`);
    assert.equal(collect.data.bar_name, `Speakeasy ${run}`);
    assert.equal(collect.data.release_date, '2026-09-27');
    const rename = await users.collector.client.from('collected_releases').update({ name: 'Something else' }).eq('id', collect.data.id);
    assert.ok(rename.error, 'renaming a release memory should be refused');

    await db.query('UPDATE public.releases SET published_at = NULL WHERE id = $1', [release.id]);
    const live = await users.collector.client.from('releases').select('id').eq('id', release.id);
    assert.deepEqual(live.data, []);
    await db.query('DELETE FROM public.releases WHERE id = $1', [release.id]);
    const kept = await users.collector.client.from('collected_releases').select('name, release_id').eq('id', collect.data.id).single();
    assert.equal(kept.data.release_id, null);
    assert.equal(kept.data.name, `Garden release ${run}`);
  });
});

// 20260930500800_home_menus_hold_published_drinks.sql
describe('home menus', () => {
  test('a home menu holds a drink another bar published, but not one it keeps private', async () => {
    const client = users.collector.client;
    const menu = await client.from('menus').insert({ name: `Friday at ours ${run}`, created_by: users.collector.id }).select('id').single();
    assert.ifError(menu.error);
    const save = (itemIds) => client.rpc('save_menu', {
      p_menu_id: menu.data.id, p_name: `Friday at ours ${run}`, p_cover_url: null, p_cover_position: 50,
      p_sections: [{ name: 'Drinks', min_items: 1, max_items: null, allowed_types: ['cocktail'], item_ids: itemIds }],
    });

    assert.ifError((await save([ids.items.onMenu])).error);
    const drinks = await client.from('menu_drinks').select('item_id').eq('menu_id', menu.data.id);
    assert.deepEqual(drinks.data.map((d) => d.item_id), [ids.items.onMenu]);

    const hidden = await save([ids.items.hiddenDrink]);
    assert.match(hidden.error?.message ?? '', /not found/);
  });

  test('a venue menu still only holds drinks the editor can read', async () => {
    const venueMenu = await users.openAdmin.client
      .from('menus').insert({ name: `Open menu ${run}`, bar_id: ids.openBar, created_by: users.openAdmin.id }).select('id').single();
    assert.ifError(venueMenu.error);
    const save = await users.openAdmin.client.rpc('save_menu', {
      p_menu_id: venueMenu.data.id, p_name: `Open menu ${run}`, p_cover_url: null, p_cover_position: 50,
      p_sections: [{ name: 'Drinks', min_items: 1, max_items: null, allowed_types: ['cocktail'], item_ids: [ids.items.onMenu] }],
    });
    assert.match(save.error?.message ?? '', /not found/);
  });
});
