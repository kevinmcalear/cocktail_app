// Security tests for 20261017600000_venue_owns_menu_history: once a bar has
// staff, its researched menus (profile_menu_editions) become its own menus,
// which its staff can edit and nobody else can. Bars with no staff keep them.
//
//   supabase start && supabase db reset
//   node --test supabase/tests/venue-menu-history.test.mjs
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
  throw new Error(`Refusing to run venue menu history tests against a non-local API: ${status.API_URL}`);
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

const barProfile = (name, barId) => ({ kind: 'bar', handle: `${name}.${run}`, display_name: `${name} ${run}`, bar_id: barId, is_public: true });

// A researched history: an opening menu with an end, a month on its own, and
// the one on now. Drinks are shared catalog cocktails credited to the bar.
async function seedHistory(profileId) {
  const drinks = [];
  for (const name of ['Cottage Martini', 'Pirate Material']) {
    drinks.push((await serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: profileId })).id);
  }
  const rows = [
    { name: `Opening menu ${run}`, year: 2022, month: 2, end_year: 2022, end_month: 4, theme: 'Weekly lists' },
    { name: `July menu ${run}`, year: 2023, month: 7 },
    { name: `September menu ${run}`, year: 2026, month: 9, is_current: true },
  ];
  for (const row of rows) {
    const edition = await serviceInsert('profile_menu_editions', { profile_id: profileId, source_url: 'https://example.test/menu', ...row });
    for (const [i, item] of drinks.entries()) {
      await serviceInsert('profile_menu_edition_drinks', { edition_id: edition.id, item_id: item, sort_order: 1 - i });
    }
  }
  return drinks;
}

const menusAt = async (barId) =>
  (
    await db.query(
      `SELECT m.id, m.name, m.description, m.created_by,
              to_char(m.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS starts,
              to_char(m.ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS ends,
              (SELECT array_agg(md.item_id ORDER BY md.sort_order)
                 FROM public.menu_drinks md JOIN public.menu_sections s ON s.id = md.menu_section_id
                WHERE md.menu_id = m.id) AS drinks
         FROM public.menus m WHERE m.bar_id = $1 ORDER BY m.starts_at`,
      [barId]
    )
  ).rows;

const editionsOf = async (profileId) =>
  (await db.query('SELECT count(*)::int AS n FROM public.profile_menu_editions WHERE profile_id = $1', [profileId])).rows[0].n;

before(async () => {
  await db.connect();
  for (const label of ['staff', 'otherStaff', 'stranger', 'claimant']) users[label] = await makeUser(label);
  ids.otherBar = (await serviceInsert('bars', { name: `Elsewhere ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.otherStaff.id, bar_id: ids.otherBar, role_level: 40 });

  // A bar on the map with no staff yet, then its first staff member.
  ids.bar = (await serviceInsert('bars', { name: `Cottage ${run}` })).id;
  ids.profile = (await serviceInsert('profiles', barProfile('cottage', ids.bar))).id;
  ids.drinks = await seedHistory(ids.profile);
  ids.editionsBeforeStaff = await editionsOf(ids.profile);
  await serviceInsert('user_bars', { user_id: users.staff.id, bar_id: ids.bar, role_level: 40 });

  // A researched page with no bar yet; a claim adds the bar and its admin,
  // then links the page (hand_over_claim's order).
  ids.claimProfile = (await serviceInsert('profiles', barProfile('claimed', null))).id;
  await seedHistory(ids.claimProfile);
  ids.claimBar = (await serviceInsert('bars', { name: `Claimed ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.claimant.id, bar_id: ids.claimBar, role_level: 40 });
  ids.claimEditionsBeforeLink = await editionsOf(ids.claimProfile);
  await db.query('UPDATE public.profiles SET bar_id = $1 WHERE id = $2', [ids.claimBar, ids.claimProfile]);

  // A bar with no staff at all.
  ids.quietBar = (await serviceInsert('bars', { name: `Quiet ${run}` })).id;
  ids.quietProfile = (await serviceInsert('profiles', barProfile('quiet', ids.quietBar))).id;
  await seedHistory(ids.quietProfile);
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

describe('a bar gets staff', () => {
  test('its researched menus become its own menus, dated, described and in order', async () => {
    assert.equal(ids.editionsBeforeStaff, 3);
    assert.equal(await editionsOf(ids.profile), 0);
    const menus = await menusAt(ids.bar);
    assert.deepEqual(
      menus.map(({ name, description, created_by, starts, ends }) => ({ name, description, created_by, starts, ends })),
      [
        { name: `Opening menu ${run}`, description: 'Weekly lists', created_by: null, starts: '2022-02-01', ends: '2022-04-30' },
        { name: `July menu ${run}`, description: null, created_by: null, starts: '2023-07-01', ends: '2023-07-31' },
        { name: `September menu ${run}`, description: null, created_by: null, starts: '2026-09-01', ends: null },
      ]
    );
    for (const m of menus) assert.deepEqual(m.drinks, [ids.drinks[1], ids.drinks[0]]);
  });

  test('a claimed page hands its menus over when it is linked to the bar', async () => {
    assert.equal(ids.claimEditionsBeforeLink, 3);
    assert.equal(await editionsOf(ids.claimProfile), 0);
    assert.equal((await menusAt(ids.claimBar)).length, 3);
  });

  test('a bar with no staff keeps its research history', async () => {
    assert.equal(await editionsOf(ids.quietProfile), 3);
    assert.equal((await menusAt(ids.quietBar)).length, 0);
  });

  test('the public page shows each menu once, now as the venue\'s', async () => {
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    assert.ifError(error);
    assert.equal(data.length, 3);
    assert.ok(data.every((m) => m.from_venue));
    const current = data.filter((m) => m.is_current).map((m) => m.name);
    assert.deepEqual(current, [`September menu ${run}`]);
    // The research's months, as before.
    const opening = data.find((m) => m.name === `Opening menu ${run}`);
    assert.deepEqual([opening.year, opening.month, opening.end_year, opening.end_month], [2022, 2, 2022, 4]);
  });
});

describe('who controls them', () => {
  test("the bar's staff see them in Menus and can rename, change the drinks and delete", async () => {
    const [opening, july] = await menusAt(ids.bar);
    const client = users.staff.client;
    const listed = await client.from('menus').select('id').eq('bar_id', ids.bar);
    assert.ifError(listed.error);
    assert.equal(listed.data.length, 3);

    const rename = await client.from('menus').update({ name: `Opening week ${run}` }).eq('id', opening.id).select('name');
    assert.ifError(rename.error);
    assert.deepEqual(rename.data, [{ name: `Opening week ${run}` }]);

    const drop = await client.from('menu_drinks').delete().eq('menu_id', opening.id).eq('item_id', ids.drinks[0]).select('item_id');
    assert.ifError(drop.error);
    assert.equal(drop.data.length, 1);

    const gone = await client.from('menus').delete().eq('id', july.id).select('id');
    assert.ifError(gone.error);
    assert.equal(gone.data.length, 1);
  });

  test('nobody else can change them', async () => {
    const current = (await menusAt(ids.bar)).find((m) => m.ends === null);
    for (const client of [anon, users.stranger.client, users.otherStaff.client]) {
      const edit = await client.from('menus').update({ name: 'Sneaky' }).eq('id', current.id).select();
      assert.deepEqual(edit.data ?? [], []);
      const drop = await client.from('menus').delete().eq('id', current.id).select();
      assert.deepEqual(drop.data ?? [], []);
    }
    const [{ name }] = (await db.query('SELECT name FROM public.menus WHERE id = $1', [current.id])).rows;
    assert.equal(name, `September menu ${run}`);
  });

  test('nobody can call the move themselves', async () => {
    for (const client of [anon, users.staff.client]) {
      const { error } = await client.schema('private').rpc('move_menu_history_to_venue', { p_bar_id: ids.quietBar });
      assert.ok(error);
    }
    assert.equal(await editionsOf(ids.quietProfile), 3);
  });
});
