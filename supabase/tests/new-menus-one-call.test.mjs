// Discover's New menus in one call (20261206670000_new_menus_one_call):
// current_menus_of_bars answers for many bars at once, only menus on now,
// only the first drink, and a hidden bar's menu stays hidden.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run new menus tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

before(async () => {
  await db.connect();
  ids.open = (await insert('profiles', { kind: 'bar', handle: `newmenus.${run}`, display_name: `Newmenus ${run}`, is_public: true })).id;
  ids.hidden = (await insert('profiles', { kind: 'bar', handle: `hiddenmenus.${run}`, display_name: `Hiddenmenus ${run}`, is_public: false })).id;
  const drink = (name, bar) => insert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: bar });
  const first = await drink('First', ids.open);
  const second = await drink('Second', ids.open);
  const secret = await drink('Secret', ids.hidden);
  const on = await insert('profile_menu_editions', { profile_id: ids.open, name: `On ${run}`, year: 2026, month: 10, is_current: true });
  const old = await insert('profile_menu_editions', { profile_id: ids.open, name: `Old ${run}`, year: 2020, month: 1, end_year: 2021, end_month: 1 });
  const hidden = await insert('profile_menu_editions', { profile_id: ids.hidden, name: `Secret ${run}`, year: 2026, month: 10, is_current: true });
  await insert('profile_menu_edition_drinks', { edition_id: on.id, item_id: first.id, sort_order: 0 });
  await insert('profile_menu_edition_drinks', { edition_id: on.id, item_id: second.id, sort_order: 1 });
  await insert('profile_menu_edition_drinks', { edition_id: old.id, item_id: second.id, sort_order: 0 });
  await insert('profile_menu_edition_drinks', { edition_id: hidden.id, item_id: secret.id, sort_order: 0 });
  ids.first = first.id;
  ids.on = on.id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.end();
});

describe('current_menus_of_bars', () => {
  test('gives each visible bar its menus on now, with only the first drink', async () => {
    const { data, error } = await anon.rpc('current_menus_of_bars', { p_profile_ids: [ids.open, ids.hidden] });
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(data[0].profile_id, ids.open);
    assert.equal(data[0].id, ids.on);
    assert.deepEqual(data[0].drinks.map((d) => d.id), [ids.first]);
  });

  test('no bars, no rows', async () => {
    const { data, error } = await anon.rpc('current_menus_of_bars', { p_profile_ids: [] });
    assert.ifError(error);
    assert.deepEqual(data, []);
  });
});
