// Menu dates (20261007153000_menu_edition_dates): a menu says when it was
// on; a drink's run on a bar's menus reads with the menus (signed out
// included, hidden bars hidden); search over bars' drinks puts current menus
// first and finds past ones; and menu_name_key matches names loosely for
// research loads.
//
//   supabase start && supabase db reset
//   npm run test:security
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
  throw new Error(`Refusing to run menu date tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
let reader;

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const drink = (name, profileId) =>
  serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: profileId });

before(async () => {
  await db.connect();
  const email = `reader-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  reader = { id: data.user.id, client: createClient(status.API_URL, status.ANON_KEY, clientOptions) };
  const signIn = await reader.client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;

  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `dates.${run}`, display_name: `Datebar ${run}`, is_public: true })).id;
  ids.hidden = (await serviceInsert('profiles', { kind: 'bar', handle: `hiddendates.${run}`, display_name: `Hidden ${run}`, is_public: false })).id;

  const past = await serviceInsert('profile_menu_editions', {
    profile_id: ids.bar, name: `Spring ${run}`, year: 2024, month: 3, end_year: 2025, end_month: 1,
  });
  const now = await serviceInsert('profile_menu_editions', { profile_id: ids.bar, name: `Autumn ${run}`, year: 2025, month: 9, is_current: true });
  const hidden = await serviceInsert('profile_menu_editions', { profile_id: ids.hidden, name: `Secret ${run}`, year: 2025, month: 1, is_current: true });

  ids.pastDrink = (await drink('Zebra Fizz', ids.bar)).id;
  ids.nowDrink = (await drink('Zebra Sour', ids.bar)).id;
  ids.bothDrink = (await drink('Zebra Martini', ids.bar)).id;
  ids.hiddenDrink = (await drink('Zebra Secret', ids.hidden)).id;
  const link = (edition_id, item_id, sort_order) => serviceInsert('profile_menu_edition_drinks', { edition_id, item_id, sort_order });
  await link(past.id, ids.pastDrink, 0);
  await link(past.id, ids.bothDrink, 1);
  await link(now.id, ids.nowDrink, 0);
  await link(now.id, ids.bothDrink, 1);
  await link(hidden.id, ids.hiddenDrink, 0);
  ids.now = now.id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  if (reader) await service.auth.admin.deleteUser(reader.id);
  await db.end();
});

describe('when a menu was on', () => {
  test('profile pages read the start, the end and whether it is on now', async () => {
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.bar });
    assert.ifError(error);
    const byName = Object.fromEntries(data.map((m) => [m.name, m]));
    assert.deepEqual(
      [byName[`Spring ${run}`].year, byName[`Spring ${run}`].month, byName[`Spring ${run}`].end_year, byName[`Spring ${run}`].end_month, byName[`Spring ${run}`].is_current],
      [2024, 3, 2025, 1, false]
    );
    assert.equal(byName[`Autumn ${run}`].is_current, true);
    assert.equal(byName[`Autumn ${run}`].end_year, null);
  });

  test('a current menu has no end, an end has a year, and nothing ends before it starts', async () => {
    const bad = [
      { name: `Both ${run}`, year: 2025, month: 1, end_year: 2025, end_month: 6, is_current: true },
      { name: `Monthonly ${run}`, year: 2025, month: 1, end_month: 6 },
      { name: `Backwards ${run}`, year: 2025, month: 6, end_year: 2025, end_month: 1 },
    ];
    for (const row of bad) {
      const { error } = await service.from('profile_menu_editions').insert({ profile_id: ids.bar, ...row });
      assert.equal(error?.code, '23514', row.name);
    }
    const sameYear = await service.from('profile_menu_editions').insert({ profile_id: ids.bar, name: `Short ${run}`, year: 2019, end_year: 2019 });
    assert.ifError(sameYear.error);
  });

  test("only app admins change the dates, not the bar's people or strangers", async () => {
    const edit = await reader.client.from('profile_menu_editions').update({ is_current: false, end_year: 2026 }).eq('id', ids.now).select();
    assert.deepEqual(edit.data ?? [], []);
    const { rows } = await db.query('SELECT is_current, end_year FROM public.profile_menu_editions WHERE id = $1', [ids.now]);
    assert.deepEqual(rows, [{ is_current: true, end_year: null }]);
  });

  test("the backfill closed Caretaker's Cottage's menus at the next one and left the latest on", async () => {
    const { rows } = await db.query(
      `SELECT e.name, e.end_year, e.end_month, e.is_current FROM public.profile_menu_editions e
       JOIN public.profiles p ON p.id = e.profile_id
       WHERE p.handle = 'caretakers.cottage' AND e.name IN ('Opening menu', 'June 2024 menu', 'September 2026 menu')
       ORDER BY e.year`
    );
    assert.deepEqual(rows, [
      { name: 'Opening menu', end_year: 2023, end_month: 2, is_current: false },
      // Until the Best of 2024 list (20261007190000_bar_history).
      { name: 'June 2024 menu', end_year: 2024, end_month: 12, is_current: false },
      { name: 'September 2026 menu', end_year: null, end_month: null, is_current: true },
    ]);
  });
});

describe("a drink's run", () => {
  test('reads signed out with the bar, from the first menu to the last, and on now when any menu is', async () => {
    const { data, error } = await anon
      .from('menu_drink_runs')
      .select('item_id, profile_id, edition_id, editions, start_year, start_month, end_year, end_month, is_current')
      .in('item_id', [ids.pastDrink, ids.nowDrink, ids.bothDrink, ids.hiddenDrink]);
    assert.ifError(error);
    const byId = Object.fromEntries(data.map((r) => [r.item_id, r]));
    assert.equal(byId[ids.hiddenDrink], undefined, "a hidden bar's drinks stay hidden");
    assert.deepEqual(
      [byId[ids.pastDrink].start_year, byId[ids.pastDrink].start_month, byId[ids.pastDrink].end_year, byId[ids.pastDrink].end_month, byId[ids.pastDrink].is_current],
      [2024, 3, 2025, 1, false]
    );
    assert.equal(byId[ids.nowDrink].is_current, true);
    const both = byId[ids.bothDrink];
    assert.deepEqual([both.editions, both.start_year, both.start_month, both.end_year, both.is_current], [2, 2024, 3, null, true]);
    assert.equal(both.edition_id, ids.now, 'it opens the menu on now');
    assert.equal(both.profile_id, ids.bar);
  });
});

describe("search over bars' drinks", () => {
  test('finds past drinks too, with drinks on a menu now first', async () => {
    const { data, error } = await reader.client.rpc('search_bar_drinks', { p_query: `zebra`, p_limit: 100 });
    assert.ifError(error);
    const ours = data.filter((r) => [ids.pastDrink, ids.nowDrink, ids.bothDrink, ids.hiddenDrink].includes(r.item_id));
    assert.deepEqual(
      ours.map((r) => r.item_id),
      [ids.bothDrink, ids.nowDrink, ids.pastDrink],
      'current first (by name), then past; the hidden bar is out'
    );
    const past = ours.find((r) => r.item_id === ids.pastDrink);
    assert.deepEqual([past.credit, past.end_year, past.end_month, past.is_current], [`Datebar ${run}`, 2025, 1, false]);
  });

  test("matches the bar's name, and treats % and _ as plain text", async () => {
    const byBar = await reader.client.rpc('search_bar_drinks', { p_query: `datebar ${run}` });
    assert.ifError(byBar.error);
    assert.equal(byBar.data.length, 3);
    const wild = await reader.client.rpc('search_bar_drinks', { p_query: '%' });
    assert.ifError(wild.error);
    assert.ok(wild.data.every((r) => r.item_id !== ids.pastDrink));
  });

  test('signed out, search is closed', async () => {
    const { error } = await anon.rpc('search_bar_drinks', { p_query: 'zebra' });
    assert.ok(error, 'anon cannot run it');
  });
});

describe('matching menu names to drinks', () => {
  test('menu_name_key ignores case, punctuation, spaces and a leading "The"', async () => {
    const { rows } = await db.query(
      `SELECT public.menu_name_key('Mr. Martinez') = public.menu_name_key('mr martinez') AS dots,
              public.menu_name_key('The Cloud') = public.menu_name_key('Cloud') AS the,
              public.menu_name_key('Orris Army & Navy') = public.menu_name_key('Orris Army + Navy') AS symbols,
              public.menu_name_key('Theory') = public.menu_name_key('ory') AS word,
              public.menu_name_key('Nature’s Radio') = public.menu_name_key('Nature''s Radio') AS curly,
              public.menu_name_key('Café Coldada') AS accent,
              public.menu_name_key('バター割り') AS japanese,
              public.menu_name_key('「バター割り」') AS quoted,
              public.menu_name_key('-=+') AS symbols_only,
              public.menu_name_key('-=+') = public.menu_name_key('+=-') AS symbols_collide`
    );
    assert.deepEqual(rows[0], {
      dots: true,
      the: true,
      symbols: true,
      word: false,
      curly: true,
      accent: 'cafécoldada',
      japanese: 'バター割り',
      quoted: 'バター割り',
      symbols_only: '-=+',
      symbols_collide: false,
    });
  });
});
