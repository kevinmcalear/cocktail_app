// Security tests for 20261016100000_public_venue_menus: a bar's own menu on
// now and its ended menus are public through get_menu_editions, read-only and
// signed out too. Drafts, menus scheduled but not started, one-night menus,
// R&D, a hidden bar's menus and a person's private drink never are, and the
// menu tables themselves stay closed.
//
//   supabase start && supabase db reset
//   node --test supabase/tests/public-venue-menus.test.mjs
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
  throw new Error(`Refusing to run public venue menu tests against a non-local API: ${status.API_URL}`);
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

const menu = (barId, name, extra = {}) => serviceInsert('menus', { bar_id: barId, name: `${name} ${run}`, ...extra });
const drink = (name, extra = {}) => serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', ...extra });
const onMenu = (menuId, itemId, sort, sectionId = null) =>
  serviceInsert('menu_drinks', { menu_id: menuId, item_id: itemId, sort_order: sort, menu_section_id: sectionId });

const names = (rows) => rows.map((r) => r.name).sort();

before(async () => {
  await db.connect();
  for (const label of ['staff', 'otherStaff', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Rye House ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Elsewhere ${run}` })).id;
  ids.hiddenBar = (await serviceInsert('bars', { name: `Back Room ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.staff.id, bar_id: ids.bar, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.staff.id, bar_id: ids.hiddenBar, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.otherStaff.id, bar_id: ids.otherBar, role_level: 40 });
  const profile = (handle, barId, isPublic) =>
    serviceInsert('profiles', { kind: 'bar', handle: `${handle}.${run}`, display_name: `${handle} ${run}`, bar_id: barId, is_public: isPublic });
  ids.profile = (await profile('ryehouse', ids.bar, true)).id;
  ids.hiddenProfile = (await profile('backroom', ids.hiddenBar, false)).id;

  // The bar's drinks, a shared catalog drink, a moderated one, and a person's own.
  ids.fig = (await drink('Smoke and Fig', { bar_id: ids.bar, price: '19' })).id;
  ids.highball = (await drink('Rye Garden Highball', { bar_id: ids.bar, price: ' ' })).id;
  ids.secret = (await drink('Secret Draft Sour', { bar_id: ids.bar, price: '17' })).id;
  ids.classic = (await drink('Catalog Martini')).id;
  ids.pulled = (await drink('Pulled Drink', { bar_id: ids.bar, moderated_at: new Date().toISOString() })).id;
  ids.personal = (await drink('Someone Home Drink', { created_by: users.stranger.id })).id;

  // On now, with two sections.
  ids.live = (await menu(ids.bar, 'Field Notes', { starts_at: at(-30), description: 'Autumn at the bar' })).id;
  const stirred = await serviceInsert('menu_sections', { menu_id: ids.live, name: 'Stirred', sort_order: 0 });
  const long = await serviceInsert('menu_sections', { menu_id: ids.live, name: 'Long', sort_order: 1 });
  await onMenu(ids.live, ids.highball, 0, long.id);
  await onMenu(ids.live, ids.fig, 0, stirred.id);
  await onMenu(ids.live, ids.classic, 1, stirred.id);
  await onMenu(ids.live, ids.pulled, 2, stirred.id);
  await onMenu(ids.live, ids.personal, 3, stirred.id);
  // Ended. Scheduled to end later counts as on now.
  ids.past = (await menu(ids.bar, 'Night Garden', { starts_at: '2024-03-01T00:00:00Z', ends_at: '2025-09-01T00:00:00Z' })).id;
  await onMenu(ids.past, ids.fig, 0);
  ids.ending = (await menu(ids.bar, 'Summer Bridge', { starts_at: at(-90), ends_at: at(5) })).id;
  // Never public.
  ids.draft = (await menu(ids.bar, 'Winter draft')).id;
  await onMenu(ids.draft, ids.secret, 0);
  ids.scheduled = (await menu(ids.bar, 'Next season', { starts_at: at(10) })).id;
  await onMenu(ids.scheduled, ids.secret, 0);
  ids.night = (await menu(ids.bar, 'One night only', { menu_date: at(-2).slice(0, 10) })).id;
  ids.rnd = (await menu(ids.bar, 'Martini trials', { kind: 'rnd' })).id;
  await onMenu(ids.rnd, ids.secret, 0);
  // A hidden bar's menu on now.
  ids.hiddenLive = (await menu(ids.hiddenBar, 'Back Room menu', { starts_at: at(-3) })).id;
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

const PUBLIC = [`Field Notes ${run}`, `Night Garden ${run}`, `Summer Bridge ${run}`].sort();

describe('who reads a venue menu', () => {
  for (const who of ['anon', 'stranger', 'otherStaff', 'staff']) {
    test(`${who} reads the menu on now and the ended ones, never a draft, a scheduled menu, a one-night menu or R&D`, async () => {
      const client = who === 'anon' ? anon : users[who].client;
      const { data, error } = await client.rpc('get_menu_editions', { p_profile_id: ids.profile });
      assert.ifError(error);
      assert.deepEqual(names(data), PUBLIC);
      assert.ok(data.every((m) => m.from_venue === true));
      const text = JSON.stringify(data);
      for (const hidden of ['Winter draft', 'Next season', 'One night only', 'Martini trials', 'Secret Draft Sour']) {
        assert.ok(!text.includes(hidden), `${hidden} stays hidden`);
      }
    });
  }

  test("a hidden bar's menu shows to its own staff only", async () => {
    for (const client of [anon, users.stranger.client, users.otherStaff.client]) {
      const { data, error } = await client.rpc('get_menu_editions', { p_profile_id: ids.hiddenProfile });
      assert.ifError(error);
      assert.deepEqual(data, []);
    }
    const own = await users.staff.client.rpc('get_menu_editions', { p_profile_id: ids.hiddenProfile });
    assert.ifError(own.error);
    assert.deepEqual(names(own.data), [`Back Room menu ${run}`]);
  });
});

describe('what a venue menu says', () => {
  test('the menu on now: its dates, its note, its drinks in section order with the venue’s prices', async () => {
    const { data } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    const live = data.find((m) => m.id === ids.live);
    assert.equal(live.is_current, true);
    assert.equal(live.end_year, null);
    assert.equal(live.theme, 'Autumn at the bar');
    assert.equal(live.source_url, null);
    // Moderated and personal drinks left off; a blank price is no price.
    assert.deepEqual(
      live.drinks.map((d) => [d.name, d.price, d.section]),
      [
        [`Smoke and Fig ${run}`, '19', 'Stirred'],
        [`Catalog Martini ${run}`, null, 'Stirred'],
        [`Rye Garden Highball ${run}`, null, 'Long'],
      ]
    );
  });

  test('an ended menu runs to the month before it came off; one ending later is still on', async () => {
    const { data } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    const past = data.find((m) => m.id === ids.past);
    assert.deepEqual([past.year, past.month, past.end_year, past.end_month, past.is_current], [2024, 3, 2025, 8, false]);
    assert.equal(data.find((m) => m.id === ids.ending).is_current, true);
  });
});

describe('the menu tables stay closed', () => {
  test('signed out, or at another bar, the menus and their drinks are not readable directly', async () => {
    for (const client of [anon, users.stranger.client, users.otherStaff.client]) {
      const menus = await client.from('menus').select('id').eq('bar_id', ids.bar);
      assert.deepEqual(menus.data ?? [], []);
      const drinks = await client.from('menu_drinks').select('id').in('menu_id', [ids.live, ids.draft]);
      assert.deepEqual(drinks.data ?? [], []);
      const items = await client.from('items').select('id').in('id', [ids.fig, ids.secret]);
      assert.deepEqual(items.data ?? [], []);
    }
  });

  test('nobody outside the bar edits its menus', async () => {
    for (const client of [anon, users.stranger.client, users.otherStaff.client]) {
      const edit = await client.from('menus').update({ name: `Renamed ${run}` }).eq('id', ids.live).select();
      assert.deepEqual(edit.data ?? [], []);
    }
    const { rows } = await db.query('SELECT name FROM public.menus WHERE id = $1', [ids.live]);
    assert.equal(rows[0].name, `Field Notes ${run}`);
  });
});
