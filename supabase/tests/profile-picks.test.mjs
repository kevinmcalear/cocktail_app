// What a public profile shows, section by section and item by item
// (20261010710000_profile_picks.sql): All, Picked or None for each section,
// a pick on each drink, bar or original, a top four, and dates only when the
// person shows them. The gates of shared-rankings.test.mjs still hold.
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run profile picks tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: {}, entries: {} };

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

const drinks = async () => {
  const { data, error } = await users.reader.client.rpc('get_profile_drinks', { p_profile_id: ids.profile });
  assert.ifError(error);
  return data;
};
const names = async () => (await drinks()).map((r) => r.name.replace(` ${run}`, '')).sort();
const bars = async () => {
  const { data, error } = await users.reader.client.rpc('get_profile_bars', { p_profile_id: ids.profile });
  assert.ifError(error);
  return data;
};

/** The ranker's own writes, through RLS like the app. */
const mine = (patch) => users.ranker.client.from('profiles').update(patch).eq('id', ids.profile).select('had_mode, bars_mode, made_mode, shares_rankings, shares_bars, shares_made');
const pick = (entry, on_profile, profile_pin = null) => users.ranker.client.from('rank_entries').update({ on_profile, profile_pin }).eq('id', ids.entries[entry]).select('id');
const pickBar = (shown) =>
  users.ranker.client.from('profile_picks').upsert({ profile_id: ids.profile, section: 'bars', target_id: ids.bar, shown }, { onConflict: 'profile_id,section,target_id' });

before(async () => {
  await db.connect();
  for (const label of ['ranker', 'reader', 'other']) users[label] = await makeUser(label);
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [users.ranker.id]);
  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `pkbar${run}`, display_name: `Pick Bar ${run}`, is_public: true })).id;
  ids.otherBar = (await serviceInsert('profiles', { kind: 'bar', handle: `pkother${run}`, display_name: `Other Bar ${run}`, is_public: true })).id;
  // Made by the person, as the app does, so the defaults are a new person's.
  const { data, error } = await users.ranker.client
    .from('profiles')
    .insert({ kind: 'person', handle: `picker${run}`, display_name: `Picker ${run}`, user_id: users.ranker.id, is_public: true })
    .select('id')
    .single();
  assert.ifError(error);
  ids.profile = data.id;

  for (const name of ['Martini', 'Negroni', 'Daiquiri']) ids.items[name] = (await serviceInsert('items', { item_type: 'cocktail', name: `${name} ${run}` })).id;
  const entry = (name, venue, sentiment, rank_key) => ({ item_id: ids.items[name], ranked_as_item_id: ids.items[name], venue_profile_id: venue, sentiment, rank_key, had_on: '2026-09-12' });
  const { data: rows, error: rankError } = await users.ranker.client
    .from('rank_entries')
    .insert([entry('Martini', ids.bar, 'loved', 0), entry('Negroni', ids.bar, 'fine', 0), entry('Daiquiri', ids.otherBar, 'loved', 0)])
    .select('id, item_id');
  assert.ifError(rankError);
  for (const r of rows) ids.entries[Object.keys(ids.items).find((k) => ids.items[k] === r.item_id)] = r.id;
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}%`]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}%`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a new person', () => {
  test('starts on Picked for what they’ve had and their bars, All for what they made, dates off', async () => {
    const { rows } = await db.query('SELECT had_mode, bars_mode, made_mode, shows_dates, shares_rankings, shares_bars, shares_made FROM public.profiles WHERE id = $1', [ids.profile]);
    assert.deepEqual(rows[0], { had_mode: 'picked', bars_mode: 'picked', made_mode: 'all', shows_dates: false, shares_rankings: false, shares_bars: false, shares_made: true });
    assert.deepEqual(await drinks(), [], 'nothing until they pick it');
    assert.deepEqual(await bars(), []);
  });

  test('anyone reads the modes, to know which tabs to show', async () => {
    const { data, error } = await anon.from('profiles').select('had_mode, bars_mode, made_mode').eq('id', ids.profile).single();
    assert.ifError(error);
    assert.deepEqual(data, { had_mode: 'picked', bars_mode: 'picked', made_mode: 'all' });
  });
});

describe('drinks they’ve had', () => {
  test('Picked: only the ones they pick, without dates until they show them', async () => {
    assert.ifError((await pick('Martini', true)).error);
    assert.deepEqual(await names(), ['Martini']);
    const [martini] = await drinks();
    assert.equal(martini.had_on, null);
    assert.equal(martini.created_at, null);
    assert.ifError((await mine({ shows_dates: true })).error);
    assert.equal((await drinks())[0].had_on, '2026-09-12');
    assert.ifError((await mine({ shows_dates: false })).error);
  });

  test('All: every one but those they hide', async () => {
    assert.ifError((await pick('Negroni', false)).error);
    assert.ifError((await mine({ had_mode: 'all' })).error);
    assert.deepEqual(await names(), ['Daiquiri', 'Martini']);
  });

  test('None: nothing, and their picks are back when it returns', async () => {
    assert.ifError((await mine({ had_mode: 'none' })).error);
    assert.deepEqual(await drinks(), []);
    assert.ifError((await mine({ had_mode: 'picked' })).error);
    assert.deepEqual(await names(), ['Martini']);
  });

  test('a top four: pinned drinks come back with their place, one drink per place, only shown ones', async () => {
    assert.ifError((await pick('Martini', true, 1)).error);
    assert.equal((await drinks())[0].pin, 1);
    assert.equal((await pick('Daiquiri', true, 1)).error?.code, '23505');
    assert.equal((await pick('Daiquiri', false, 2)).error?.code, '23514');
    assert.equal((await pick('Daiquiri', true, 5)).error?.code, '23514');
  });

  test('nobody else picks for them', async () => {
    const { data } = await users.other.client.from('rank_entries').update({ on_profile: true }).eq('id', ids.entries.Negroni).select('id');
    assert.deepEqual(data, []);
  });
});

describe('bars they’ve been to', () => {
  test('Picked: only a bar they pick, and its best drink only when that drink shows', async () => {
    assert.ifError((await mine({ bars_mode: 'picked' })).error);
    assert.ifError((await pickBar(true)).error);
    const rows = await bars();
    assert.deepEqual(rows.map((r) => [r.venue_id, r.drinks, r.best_name]), [[ids.bar, 2, `Martini ${run}`]]);
  });

  test('a hidden bar is never named, even beside a drink', async () => {
    assert.ifError((await mine({ had_mode: 'all', bars_mode: 'all' })).error);
    assert.ifError((await pickBar(false)).error);
    assert.deepEqual((await bars()).map((r) => r.venue_id), [ids.otherBar]);
    const martini = (await drinks()).find((r) => r.name === `Martini ${run}`);
    assert.equal(martini.venue_id, null);
    assert.equal(martini.at_bar, true);
    assert.ok(!JSON.stringify(await drinks()).includes('Pick Bar'), 'the hidden bar is never named');
  });

  test('their bar picks are theirs alone', async () => {
    const { data: own } = await users.ranker.client.from('profile_picks').select('target_id').eq('section', 'bars');
    assert.deepEqual(own.map((r) => r.target_id), [ids.bar]);
    for (const client of [anon, users.reader.client]) {
      const { data } = await client.from('profile_picks').select('target_id').eq('profile_id', ids.profile).eq('section', 'bars');
      assert.deepEqual(data ?? [], []);
    }
    const { error } = await users.other.client.from('profile_picks').insert({ profile_id: ids.profile, section: 'bars', target_id: ids.otherBar, shown: false });
    assert.ok(error, 'nobody else writes them');
  });
});

describe('drinks they made', () => {
  test('anyone reads which originals a profile shows or hides', async () => {
    assert.ifError((await users.ranker.client.from('profile_picks').insert({ profile_id: ids.profile, section: 'originals', target_id: ids.items.Negroni, shown: false })).error);
    const { data, error } = await anon.from('profile_picks').select('target_id, shown').eq('profile_id', ids.profile).eq('section', 'originals');
    assert.ifError(error);
    assert.deepEqual(data, [{ target_id: ids.items.Negroni, shown: false }]);
  });
});

describe('app builds from before the modes', () => {
  test('their switches still work: on is All, off is None, and they read back that way', async () => {
    assert.ifError((await mine({ had_mode: 'picked', bars_mode: 'picked' })).error);
    const on = await users.ranker.client.from('profiles').update({ shares_rankings: true }).eq('id', ids.profile).select('had_mode, shares_rankings');
    assert.deepEqual(on.data, [{ had_mode: 'all', shares_rankings: true }]);
    const off = await users.ranker.client.from('profiles').update({ shares_made: false }).eq('id', ids.profile).select('made_mode, shares_made');
    assert.deepEqual(off.data, [{ made_mode: 'none', shares_made: false }]);
    const picked = await mine({ had_mode: 'picked' });
    assert.equal(picked.data[0].shares_rankings, false, 'a picked section reads as off to an old build');
  });
});
