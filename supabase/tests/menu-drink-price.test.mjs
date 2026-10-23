// A menu's own price for a drink (20261103530000_menu_drink_price.sql): the
// builder saves it with the menu through save_menu, an older app's save
// keeps it, only the menu's editors change it, and the bar page prints it
// before the drink's own. Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run menu price tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@menu-price-test.local`;
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

/** What the menu's rows hold now, by drink. */
async function prices() {
  const { data, error } = await service.from('menu_drinks').select('item_id, price').eq('menu_id', ids.menu);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.item_id, r.price]));
}

/** save_menu as the app calls it; `prices` left out is an older app. */
function save(client, itemIds, menuPrices) {
  return client.rpc('save_menu', {
    p_menu_id: ids.menu,
    p_name: `Winter ${run}`,
    p_cover_url: null,
    p_cover_position: 50,
    p_sections: [{ id: ids.section, name: 'Stirred', min_items: 0, max_items: null, allowed_types: ['cocktail'], item_ids: itemIds, ...(menuPrices ? { prices: menuPrices } : {}) }],
  });
}

before(async () => {
  users.admin = await makeUser('admin');
  users.stranger = await makeUser('stranger');
  ids.bar = (await insert('bars', { name: `Menu price bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `menuprice.${run}`, display_name: `Menu price bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.negroni = (await insert('items', { name: `Negroni ${run}`, item_type: 'cocktail', bar_id: ids.bar, price: '19' })).id;
  ids.collins = (await insert('items', { name: `Collins ${run}`, item_type: 'cocktail', bar_id: ids.bar, price: '17' })).id;
  ids.menu = (await insert('menus', { bar_id: ids.bar, name: `Winter ${run}`, starts_at: new Date(Date.now() - 86400000).toISOString() })).id;
  ids.section = (await insert('menu_sections', { menu_id: ids.menu, name: 'Stirred', sort_order: 0 })).id;
});

after(async () => {
  if (ids.menu) await service.from('menus').delete().eq('id', ids.menu);
  for (const id of [ids.negroni, ids.collins]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.profile) await service.from('profiles').delete().eq('id', ids.profile);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe("a menu's own price", () => {
  test('saves with the menu; blank is none', async () => {
    assert.ifError((await save(users.admin.client, [ids.negroni, ids.collins], [' 22 ', ''])).error);
    assert.deepEqual(await prices(), { [ids.negroni]: '22', [ids.collins]: null });
  });

  test("the drink's own price stays as it was", async () => {
    const { data } = await service.from('items').select('price').eq('id', ids.negroni).single();
    assert.equal(data.price, '19');
  });

  test("an older app's save keeps it, and moving the drink keeps it", async () => {
    assert.ifError((await save(users.admin.client, [ids.collins, ids.negroni])).error);
    assert.deepEqual(await prices(), { [ids.negroni]: '22', [ids.collins]: null });
  });

  test('clearing it goes back to none', async () => {
    assert.ifError((await save(users.admin.client, [ids.negroni, ids.collins], [null, 'MP'])).error);
    assert.deepEqual(await prices(), { [ids.negroni]: null, [ids.collins]: 'MP' });
  });

  test("only the menu's editors change it", async () => {
    const res = await users.stranger.client.from('menu_drinks').update({ price: '1' }).eq('menu_id', ids.menu).select('id');
    assert.ok(res.error || res.data.length === 0, 'a stranger changes nothing');
    assert.ok((await save(users.stranger.client, [ids.negroni, ids.collins], ['1', '1'])).error, "a stranger can't save the menu");
    const own = await users.admin.client.from('menu_drinks').update({ price: '23' }).eq('menu_id', ids.menu).eq('item_id', ids.negroni).select('price').single();
    assert.ifError(own.error);
    assert.equal(own.data.price, '23');
    assert.deepEqual(await prices(), { [ids.negroni]: '23', [ids.collins]: 'MP' });
  });

  test('keeps to a short typed price', async () => {
    assert.ok((await service.from('menu_drinks').update({ price: ' 22' }).eq('menu_id', ids.menu).eq('item_id', ids.negroni)).error, 'untrimmed is refused');
    assert.ok((await service.from('menu_drinks').update({ price: 'x'.repeat(41) }).eq('menu_id', ids.menu).eq('item_id', ids.negroni)).error, 'over 40 characters is refused');
  });

  test("the bar page prints the menu's price, else the drink's", async () => {
    await service.from('menu_drinks').update({ price: null }).eq('menu_id', ids.menu).eq('item_id', ids.collins);
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    assert.ifError(error);
    const menu = data.find((m) => m.id === ids.menu);
    assert.ok(menu, 'the menu on now is on the bar page');
    const byId = Object.fromEntries(menu.drinks.map((d) => [d.id, d.price]));
    assert.deepEqual(byId, { [ids.negroni]: '23', [ids.collins]: '17' });
  });
});
