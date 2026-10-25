// Security tests for 20261114100000_save_venue_menus: a staffed bar's own
// menu can be saved to Collection by its menu id, only when its bar page
// shows it (started, kind menu, public page), only for yourself and past the
// age check; my_saved_venue_menus lists only your own, and only while the
// page still shows them. Saving a researched menu by edition still works.
//
//   supabase start && supabase db reset
//   node --test supabase/tests/save-venue-menus.test.mjs
//
// Every fixture is named with a per-run id and removed afterwards.

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
  throw new Error(`Refusing to run save venue menu tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const DAY = 86_400_000;
const at = (days) => new Date(Date.now() + days * DAY).toISOString();

async function makeUser(label, { adult = true } = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  if (adult) await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
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

const menu = (barId, name, extra = {}) => serviceInsert('menus', { bar_id: barId, name: `${name} ${run}`, ...extra });
const save = (who, menuId) => users[who].client.from('saved_menu_editions').insert({ menu_id: menuId });

before(async () => {
  await db.connect();
  users.guest = await makeUser('guest');
  users.other = await makeUser('other');
  users.minor = await makeUser('minor', { adult: false });
  ids.bar = (await serviceInsert('bars', { name: `Rye House ${run}` })).id;
  ids.hiddenBar = (await serviceInsert('bars', { name: `Back Room ${run}` })).id;
  const profile = (handle, barId, isPublic) =>
    serviceInsert('profiles', { kind: 'bar', handle: `${handle}.${run}`, display_name: `${handle} ${run}`, bar_id: barId, is_public: isPublic });
  ids.profile = (await profile('ryehouse', ids.bar, true)).id;
  await profile('backroom', ids.hiddenBar, false);
  ids.drink = (await serviceInsert('items', { name: `Smoke and Fig ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.live = (await menu(ids.bar, 'Field Notes', { starts_at: at(-30) })).id;
  await serviceInsert('menu_drinks', { menu_id: ids.live, item_id: ids.drink, sort_order: 0 });
  ids.draft = (await menu(ids.bar, 'Winter draft')).id;
  ids.rnd = (await menu(ids.bar, 'Martini trials', { kind: 'rnd' })).id;
  ids.hiddenLive = (await menu(ids.hiddenBar, 'Back Room menu', { starts_at: at(-3) })).id;
  ids.edition = (await serviceInsert('profile_menu_editions', { profile_id: ids.profile, name: `Paper Moon ${run}`, year: 2023 })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('saving a venue menu', () => {
  test('a menu on a public bar page is saved by its menu id, once, and listed with its bar and drinks', async () => {
    assert.ifError((await save('guest', ids.live)).error);
    const again = await users.guest.client.from('saved_menu_editions').upsert({ menu_id: ids.live }, { onConflict: 'user_id,menu_id', ignoreDuplicates: true });
    assert.ifError(again.error);
    const { data, error } = await users.guest.client.rpc('my_saved_venue_menus');
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(data[0].menu_id, ids.live);
    assert.equal(data[0].name, `Field Notes ${run}`);
    assert.equal(data[0].profile_id, ids.profile);
    assert.equal(data[0].is_current, true);
    assert.deepEqual(data[0].drinks.map((d) => d.id), [ids.drink]);
  });

  test('a researched menu is still saved by edition, beside it', async () => {
    assert.ifError((await users.guest.client.from('saved_menu_editions').insert({ edition_id: ids.edition })).error);
    const { data } = await users.guest.client.from('saved_menu_editions').select('edition_id, menu_id');
    assert.equal(data.length, 2);
  });

  test("a draft, R&D, a hidden bar's menu, or no age check: refused", async () => {
    for (const menuId of [ids.draft, ids.rnd, ids.hiddenLive]) assert.ok((await save('other', menuId)).error, 'not on a page they can see');
    assert.ok((await save('minor', ids.live)).error, 'no age check');
  });

  test('both or neither kind of menu on one row: refused', async () => {
    assert.ok((await users.other.client.from('saved_menu_editions').insert({ menu_id: ids.live, edition_id: ids.edition })).error);
    assert.ok((await users.other.client.from('saved_menu_editions').insert({})).error);
  });

  test("someone else's list: never read, never written", async () => {
    assert.ok((await users.other.client.from('saved_menu_editions').insert({ menu_id: ids.live, user_id: users.guest.id })).error);
    const theirs = await users.other.client.rpc('my_saved_venue_menus');
    assert.ifError(theirs.error);
    assert.deepEqual(theirs.data, []);
    assert.deepEqual((await users.other.client.from('saved_menu_editions').select('menu_id')).data, []);
    const signedOut = await anon.rpc('my_saved_venue_menus');
    assert.ok(signedOut.error, 'signed out cannot call it');
  });

  test('a menu that stops showing drops out of the list, and comes back with it', async () => {
    await service.from('menus').update({ starts_at: null }).eq('id', ids.live);
    assert.deepEqual((await users.guest.client.rpc('my_saved_venue_menus')).data, []);
    await service.from('menus').update({ starts_at: at(-30) }).eq('id', ids.live);
    assert.equal((await users.guest.client.rpc('my_saved_venue_menus')).data.length, 1);
  });

  test('let go of it: the row goes', async () => {
    assert.ifError((await users.guest.client.from('saved_menu_editions').delete().eq('menu_id', ids.live)).error);
    assert.deepEqual((await users.guest.client.rpc('my_saved_venue_menus')).data, []);
  });
});
