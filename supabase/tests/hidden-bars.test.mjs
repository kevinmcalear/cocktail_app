// Tests for 20261020200000_hidden_bars: a person can hide a bar from their
// Discover. Their rows are theirs alone; a hidden bar leaves their map,
// drinks list and Top bars (and nobody else's), while a search that names
// it, and the bar's own page, still find it.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Fixtures are named with a per-run id, sit in open sea near 46 S, 151 W (no
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
  throw new Error(`Refusing to run hidden bars tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const city = `Hideville ${run}`;
const bar = (label, extra = {}) => ({
  kind: 'bar', handle: `${label.toLowerCase()}.${run}`, display_name: `${label} ${run}`, is_public: true,
  city, country_code: 'NZ', latitude: -46, longitude: -151, ...extra,
});
const ids = {};
const users = {};
const drinks = {};

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
  const rows = await insert('profiles', [bar('Keep'), bar('Gone', { longitude: -151.001 })]);
  for (const r of rows) ids[r.display_name.replace(` ${run}`, '')] = r.id;
  const person = await insert('profiles', [{ kind: 'person', handle: `someone.${run}`, display_name: `Someone ${run}`, is_public: true }]);
  ids.person = person[0].id;
  const drink = async (name, barId) => (await insert('items', [{ item_type: 'cocktail', name: `${name} ${run}`, origin_bar_profile_id: barId }]))[0].id;
  drinks.keep = await drink('Hide Test Sour', ids.Keep);
  drinks.gone = await drink('Hide Test Fizz', ids.Gone);
  await db.query('SELECT private.refresh_discover_facts($1::uuid[])', [[drinks.keep, drinks.gone]]);
  users.hider = await makeUser('hider');
  users.other = await makeUser('other');
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`% ${run}`]);
  await service.from('profiles').delete().in('id', Object.values(ids));
  for (const u of [users.hider, users.other]) if (u) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

const names = (data, key = 'display_name') => data.map((r) => r[key].replace(` ${run}`, ''));

describe('hidden_bars rows', () => {
  test('a person hides a bar for themselves; nobody else sees the row', async () => {
    const { error } = await users.hider.client.from('hidden_bars').insert({ profile_id: ids.Gone });
    assert.ifError(error);
    const mine = await users.hider.client.from('hidden_bars').select('profile_id');
    assert.deepEqual(mine.data.map((r) => r.profile_id), [ids.Gone]);
    const theirs = await users.other.client.from('hidden_bars').select('profile_id');
    assert.deepEqual(theirs.data, [], 'another person reads none of it');
    const signedOut = await anon.from('hidden_bars').select('profile_id');
    assert.ok(signedOut.error || signedOut.data.length === 0, 'signed out reads nothing');
  });

  test('only bar pages, only for yourself, and no editing', async () => {
    const person = await users.hider.client.from('hidden_bars').insert({ profile_id: ids.person });
    assert.ok(person.error, 'a person profile cannot be hidden here (Block is for people)');
    const forOther = await users.hider.client.from('hidden_bars').insert({ user_id: users.other.id, profile_id: ids.Keep });
    assert.ok(forOther.error, 'no rows for someone else');
    const signedOut = await anon.from('hidden_bars').insert({ profile_id: ids.Keep });
    assert.ok(signedOut.error, 'signed out cannot hide');
    const edit = await users.hider.client.from('hidden_bars').update({ profile_id: ids.Keep }).eq('profile_id', ids.Gone).select();
    assert.ok(edit.error || edit.data.length === 0, 'rows are added and removed, never changed');
    const stolen = await users.other.client.from('hidden_bars').delete().eq('profile_id', ids.Gone).select();
    assert.ok(stolen.error || stolen.data.length === 0, 'another person cannot remove it');
  });
});

describe('Discover respects it', () => {
  test('Top bars: gone for the hider, still there for everyone else', async () => {
    const list = async (client) => {
      const { data, error } = await client.rpc('discover_top_bars', { p_country_code: 'NZ', p_city: city, p_limit: 50 });
      assert.ifError(error);
      return names(data).sort();
    };
    assert.deepEqual(await list(users.hider.client), ['Keep']);
    assert.deepEqual(await list(users.other.client), ['Gone', 'Keep']);
    assert.deepEqual(await list(anon), ['Gone', 'Keep']);
  });

  test('the map: gone while browsing, found by a search that names it', async () => {
    const area = async (client, extra = {}) => {
      const { data, error } = await client.rpc('discover_bars', { p_country_code: 'NZ', p_city: city, ...extra });
      assert.ifError(error);
      return names(data).sort();
    };
    assert.deepEqual(await area(users.hider.client), ['Keep']);
    assert.deepEqual(await area(users.other.client), ['Gone', 'Keep']);
    assert.ok((await area(users.hider.client, { p_query: `Gone ${run}` })).includes('Gone'), 'its name finds it');
    assert.ok(!(await area(users.hider.client, { p_query: `hide test ${run}` })).includes('Gone'), 'a search for its drinks does not');
  });

  test('the drinks list: its drinks are gone, except on the bar\'s own page', async () => {
    const list = async (client, extra = {}) => {
      const { data, error } = await client.rpc('discover_list', { p_country_code: 'NZ', p_city: city, p_query: `hide test ${run}`, ...extra });
      assert.ifError(error);
      return data.map((r) => r.id).sort();
    };
    assert.deepEqual(await list(users.hider.client), [drinks.keep]);
    assert.deepEqual(await list(users.other.client), [drinks.gone, drinks.keep].sort());
    assert.deepEqual(await list(users.hider.client, { p_bar_id: ids.Gone }), [drinks.gone]);
  });

  test('showing it again puts it back', async () => {
    const { error } = await users.hider.client.from('hidden_bars').delete().eq('profile_id', ids.Gone);
    assert.ifError(error);
    const { data } = await users.hider.client.rpc('discover_top_bars', { p_country_code: 'NZ', p_city: city, p_limit: 50 });
    assert.deepEqual(names(data).sort(), ['Gone', 'Keep']);
  });

  test('the readers keep their grants and how they run', async () => {
    const { rows } = await db.query(
      `SELECT p.proname, p.prosecdef,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname IN ('public', 'private') AND p.proname IN ('bar_relevance', 'discover_bars', 'discover_list')
       ORDER BY p.proname`
    );
    assert.deepEqual(rows, [
      { proname: 'bar_relevance', prosecdef: true, anon: false, authenticated: true },
      { proname: 'discover_bars', prosecdef: false, anon: false, authenticated: true },
      { proname: 'discover_list', prosecdef: false, anon: false, authenticated: true },
    ]);
  });
});
