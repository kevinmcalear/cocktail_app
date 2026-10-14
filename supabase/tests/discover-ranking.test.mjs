// Tests for 20261017000000_discover_bar_relevance: Discover orders unranked
// bars by what they have going for them (loved by the viewer, then
// relevance), never by name first, and drops stale ones off Top bars. The
// helpers behind it are private: app roles can't call them, and the public
// readers keep their grants and SECURITY DEFINER.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Fixtures are named with a per-run id, sit in open sea near 45 S, 150 W (no
// other test file's bars land there), and are removed afterwards.

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
  throw new Error(`Refusing to run discover ranking tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const city = `Rankville ${run}`;
const bar = (label, extra = {}) => ({
  kind: 'bar', handle: `${label.toLowerCase()}.${run}`, display_name: `${label} ${run}`, is_public: true,
  city, country_code: 'NZ', latitude: -45, longitude: -150, ...extra,
});
const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, rows) {
  const { data, error } = await service.from(table).insert(rows).select();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

before(async () => {
  await db.connect();
  // "1999" would lead alphabetically; nothing else is known about it. "Aaa"
  // and "Zed" are alike, except people love Zed. "Venue" is claimed;
  // "Menu" has a menu on now; "Stale" has only a 2015 menu and a 2014 award.
  const rows = await insert('profiles', [
    bar('1999'),
    bar('Aaa', { longitude: -150.001 }),
    bar('Zed', { longitude: -150.002 }),
    bar('Venue', { claimed_at: new Date().toISOString(), longitude: -150.003 }),
    bar('Menu', { longitude: -150.004 }),
    bar('Stale', { longitude: -150.005 }),
  ]);
  for (const r of rows) ids[r.display_name.replace(` ${run}`, '')] = r.id;
  await insert('profile_menu_editions', [
    { profile_id: ids.Menu, name: 'Autumn', year: 2026, month: 3, end_year: null, end_month: null, is_current: true },
    { profile_id: ids.Stale, name: 'Opening list', year: 2015, month: 5, end_year: 2016, end_month: 1, is_current: false },
  ]);
  await insert('profile_awards', [{ profile_id: ids.Stale, award: 'Test Awards', year: 2014, title: 'Best New Bar' }]);

  users.lover = await makeUser('lover');
  users.other = await makeUser('other');
  users.fans = [await makeUser('fan1'), await makeUser('fan2')];
  // The lover loves the stale bar; two fans love Zed (service role: loving needs an age check the test skips).
  await insert('loved_bars', [
    { user_id: users.lover.id, profile_id: ids.Stale },
    ...users.fans.map((u) => ({ user_id: u.id, profile_id: ids.Zed })),
  ]);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`% ${run}`]);
  await service.from('profiles').delete().in('id', Object.values(ids));
  for (const u of [users.lover, users.other, ...(users.fans ?? [])]) if (u) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

const names = (data) => data.map((r) => r.display_name.replace(` ${run}`, ''));

describe('Discover bar order', () => {
  test('a city list goes by relevance, not by name; a stale bar is left off', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', { p_country_code: 'NZ', p_city: city, p_limit: 50 });
    assert.ifError(error);
    // Venue (claimed) 40, Menu (on now) 20, Zed (2 people love it) 6, then Aaa and 1999 by name.
    assert.deepEqual(names(data), ['Venue', 'Menu', 'Zed', '1999', 'Aaa']);
    assert.ok(data.every((r) => r.is_early && r.position === null && r.score === null));
    // The row shape is unchanged: no relevance, love count or loved flag comes back.
    assert.deepEqual(Object.keys(data[0]).sort(), [
      'city', 'display_name', 'distance_km', 'drinks', 'handle', 'is_early', 'latitude', 'locality', 'longitude',
      'position', 'rankers', 'score', 'venue_profile_id',
    ]);
  });

  test('near me, relevance still leads and distance only breaks ties', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', { p_latitude: -45, p_longitude: -150, p_radius_km: 2 });
    assert.ifError(error);
    // 1999 (0 m) and Aaa (80 m) tie on relevance, so the nearer one goes first.
    assert.deepEqual(names(data), ['Venue', 'Menu', 'Zed', '1999', 'Aaa']);
  });

  test('a bar you love leads your list, even a stale one, and only yours', async () => {
    const mine = await users.lover.client.rpc('discover_top_bars', { p_country_code: 'NZ', p_city: city });
    assert.ifError(mine.error);
    assert.deepEqual(names(mine.data), ['Stale', 'Venue', 'Menu', 'Zed', '1999', 'Aaa']);
    const theirs = await users.other.client.rpc('discover_top_bars', { p_country_code: 'NZ', p_city: city });
    assert.ifError(theirs.error);
    assert.deepEqual(names(theirs.data), ['Venue', 'Menu', 'Zed', '1999', 'Aaa']);
  });

  test('the stale bar keeps its page and stays on the map', async () => {
    const page = await anon.from('profiles').select('handle').eq('id', ids.Stale).single();
    assert.ifError(page.error);
    const pins = await users.other.client.rpc('discover_bars', { p_west: -150.01, p_south: -45.01, p_east: -149.99, p_north: -44.99 });
    assert.ifError(pins.error);
    assert.ok(pins.data.some((r) => r.id === ids.Stale));
  });
});

describe('who can call what', () => {
  test('the relevance helpers are private: signed out never; signed in only through discover_list', async () => {
    const { rows } = await db.query(
      `SELECT r.rolname,
              has_function_privilege(r.rolname, 'private.bar_relevance(uuid[])', 'EXECUTE') AS relevance,
              has_function_privilege(r.rolname, 'private.bar_stale_after()', 'EXECUTE') AS stale_after
       FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated') ORDER BY r.rolname`
    );
    // discover_list runs as its caller, so signed-in people need relevance; the API exposes only public.
    assert.deepEqual(rows, [
      { rolname: 'anon', relevance: false, stale_after: false },
      { rolname: 'authenticated', relevance: true, stale_after: false },
    ]);
    const { rows: def } = await db.query(`SELECT prosecdef FROM pg_proc WHERE oid = 'private.bar_relevance(uuid[])'::regprocedure`);
    assert.equal(def[0].prosecdef, true, 'counts every love, so it runs as definer');
    const viaApi = await users.other.client.schema('private').rpc('bar_relevance', { p_ids: [ids.Zed] });
    assert.ok(viaApi.error, 'the API does not serve the private schema');
    // Public bar pages only: a private page gets no row.
    const hidden = await insert('profiles', [bar('Hidden', { is_public: false, longitude: -150.006 })]);
    ids.Hidden = hidden[0].id;
    const { rows: seen } = await db.query('SELECT id FROM private.bar_relevance($1::uuid[])', [[ids.Hidden, ids.Zed]]);
    assert.deepEqual(seen.map((r) => r.id), [ids.Zed]);
  });

  test('the drinks list puts a stronger bar\'s drinks before alike drinks elsewhere, and your loved bar\'s first', async () => {
    // Two plain drinks named so the old order (by name) would put Aaa's first.
    const drink = async (name, barId) => (await insert('items', [{ item_type: 'cocktail', name: `${name} ${run}`, origin_bar_profile_id: barId }]))[0].id;
    const atAaa = await drink('A Plain Drink', ids.Aaa);
    const atVenue = await drink('Z Plain Drink', ids.Venue);
    const atStale = await drink('M Plain Drink', ids.Stale);
    await db.query('SELECT private.refresh_discover_facts($1::uuid[])', [[atAaa, atVenue, atStale]]);
    const list = async (client) => {
      const { data, error } = await client.rpc('discover_list', { p_country_code: 'NZ', p_city: city, p_query: `plain drink ${run}` });
      assert.ifError(error);
      return data.map((r) => r.id);
    };
    assert.deepEqual(await list(users.other.client), [atVenue, atAaa, atStale], 'claimed venue, then the rest, then stale');
    assert.deepEqual(await list(users.lover.client), [atStale, atVenue, atAaa], 'the lover\'s bar first');
  });

  test('Top bars and Best <drink> keep their grants and run as definer', async () => {
    const { rows } = await db.query(
      `SELECT p.proname, p.prosecdef,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('discover_top_bars', 'discover_drink_rankings')
       ORDER BY p.proname`
    );
    assert.deepEqual(rows, [
      { proname: 'discover_drink_rankings', prosecdef: true, anon: true, authenticated: true },
      { proname: 'discover_top_bars', prosecdef: true, anon: true, authenticated: true },
    ]);
  });
});
