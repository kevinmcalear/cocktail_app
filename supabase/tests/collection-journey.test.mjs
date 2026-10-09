// Row-level security for the Collection tables (20261010600000): hearts as
// collected_items for drinks nobody published, the made_drinks log, saved bar
// menus and loved bars. Runs through the real API as real users, and signed
// out.
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
  throw new Error(`Refusing to run collection tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label, { adult = true } = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  if (adult) {
    await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
  }
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

before(async () => {
  await db.connect();
  users.home = await makeUser('home');
  users.other = await makeUser('other');
  users.busy = await makeUser('busy');
  users.minor = await makeUser('minor', { adult: false });

  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.hiddenBar = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  ids.barProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `rye${run}`, display_name: `Little Rye ${run}`, bar_id: ids.bar, is_public: true })
  ).id;
  ids.hiddenProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `moth${run}`, display_name: `Pale Moth ${run}`, bar_id: ids.hiddenBar, is_public: false })
  ).id;
  ids.personProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', user_id: users.other.id, is_public: true })
  ).id;

  // A catalog classic nobody published, and a bar's own drink a guest can't read.
  ids.classic = (await serviceInsert('items', { name: `Paper Plane ${run}`, item_type: 'cocktail', created_by: null })).id;
  ids.secret = (await serviceInsert('items', { name: `House Secret ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;

  ids.edition = (await serviceInsert('profile_menu_editions', { profile_id: ids.barProfile, name: `Autumn ${run}`, year: 2026 })).id;
  ids.hiddenEdition = (await serviceInsert('profile_menu_editions', { profile_id: ids.hiddenProfile, name: `Night Garden ${run}`, year: 2026 })).id;
});

after(async () => {
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await service.from('profile_menu_editions').delete().in('id', [ids.edition, ids.hiddenEdition]);
  await service.from('items').delete().in('id', [ids.classic, ids.secret]);
  await service.from('profiles').delete().in('id', [ids.barProfile, ids.hiddenProfile, ids.personProfile]);
  await service.from('bars').delete().in('id', [ids.bar, ids.hiddenBar]);
  await db.end();
});

describe('hearts as collected_items', () => {
  test('a drink nobody published can be collected, and keeps its name', async () => {
    const { data, error } = await users.home.client.from('collected_items').insert({ item_id: ids.classic }).select('name').single();
    assert.ifError(error);
    assert.equal(data.name, `Paper Plane ${run}`);
  });

  test("a drink the collector can't read can't be collected, and its name doesn't leak", async () => {
    const { error } = await users.home.client.from('collected_items').insert({ item_id: ids.secret });
    assert.ok(error);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.collected_items WHERE item_id = $1', [ids.secret]);
    assert.equal(rows[0].n, 0);
  });
});

describe('made_drinks', () => {
  test('the owner logs a drink they made, with swaps and a note, and only they read it', async () => {
    const { error } = await users.home.client.from('made_drinks').insert({
      item_id: ids.classic,
      compared: 'same',
      swaps: [{ from: 'Amaro Nonino', to: 'Amaro Montenegro' }],
      note: 'Less bitter than theirs.',
    });
    assert.ifError(error);
    const mine = await users.home.client.from('made_drinks').select('item_id, swaps').eq('item_id', ids.classic);
    assert.ifError(mine.error);
    assert.equal(mine.data.length, 1);
    assert.deepEqual(mine.data[0].swaps, [{ from: 'Amaro Nonino', to: 'Amaro Montenegro' }]);
    assert.deepEqual((await users.other.client.from('made_drinks').select('id').eq('item_id', ids.classic)).data, []);
    const { data: anonRows, error: anonError } = await anon.from('made_drinks').select('id');
    assert.ok(anonError || !anonRows.length, 'anon reads nothing');
  });

  test("nobody logs a drink they can't read, for someone else, or without the age check", async () => {
    assert.ok((await users.home.client.from('made_drinks').insert({ item_id: ids.secret })).error);
    assert.ok((await users.other.client.from('made_drinks').insert({ item_id: ids.classic, user_id: users.home.id })).error);
    assert.ok((await users.minor.client.from('made_drinks').insert({ item_id: ids.classic })).error);
  });

  test('swaps must be a short list of from/to names', async () => {
    for (const swaps of [
      ['Cynar'],
      [{ from: 'Cynar' }],
      [{ from: 'Cynar', to: '' }],
      [{ from: 'Cynar', to: 'Montenegro', extra: true }],
      [{ from: 'Cynar', to: 'x'.repeat(81) }],
      Array.from({ length: 13 }, () => ({ from: 'a', to: 'b' })),
      { from: 'Cynar', to: 'Montenegro' },
    ]) {
      const { error } = await users.home.client.from('made_drinks').insert({ item_id: ids.classic, swaps });
      assert.ok(error, `rejected ${JSON.stringify(swaps).slice(0, 60)}`);
    }
  });

  test("a log links only the owner's own ranking", async () => {
    const own = await users.home.client
      .from('rank_entries')
      .insert({ item_id: ids.classic, ranked_as_item_id: ids.classic, venue_profile_id: null, sentiment: 'loved', rank_key: 0 })
      .select('id')
      .single();
    assert.ifError(own.error);
    const theirs = await users.other.client
      .from('rank_entries')
      .insert({ item_id: ids.classic, ranked_as_item_id: ids.classic, venue_profile_id: null, sentiment: 'fine', rank_key: 0 })
      .select('id')
      .single();
    assert.ifError(theirs.error);

    assert.ok((await users.home.client.from('made_drinks').insert({ item_id: ids.classic, rank_entry_id: theirs.data.id })).error);
    const linked = await users.home.client.from('made_drinks').insert({ item_id: ids.classic, rank_entry_id: own.data.id }).select('id').single();
    assert.ifError(linked.error);
    assert.ok((await users.home.client.from('made_drinks').update({ rank_entry_id: theirs.data.id }).eq('id', linked.data.id)).error);
  });

  test('the owner edits the note and date, but never the drink', async () => {
    const { data } = await users.home.client.from('made_drinks').select('id').eq('item_id', ids.classic).limit(1).single();
    assert.ifError((await users.home.client.from('made_drinks').update({ note: 'Better with a lemon twist.', made_on: '2026-10-01' }).eq('id', data.id)).error);
    assert.ok((await users.home.client.from('made_drinks').update({ item_id: ids.secret }).eq('id', data.id)).error);
    const edited = await users.other.client.from('made_drinks').update({ note: 'mine now' }).eq('id', data.id).select('id');
    assert.deepEqual(edited.data ?? [], []);
  });

  test('a day holds 50 logs at most', async () => {
    const rows = Array.from({ length: 50 }, () => ({ user_id: users.busy.id, item_id: ids.classic }));
    const { error } = await service.from('made_drinks').insert(rows);
    assert.ifError(error);
    const over = await users.busy.client.from('made_drinks').insert({ item_id: ids.classic });
    assert.match(over.error?.message ?? '', /50 drinks today/);
  });
});

describe('saved_menu_editions', () => {
  test("a bar's menu can be saved, privately", async () => {
    assert.ifError((await users.home.client.from('saved_menu_editions').insert({ edition_id: ids.edition })).error);
    const mine = await users.home.client.from('saved_menu_editions').select('edition_id');
    assert.deepEqual(mine.data, [{ edition_id: ids.edition }]);
    assert.deepEqual((await users.other.client.from('saved_menu_editions').select('edition_id')).data, []);
    const { data: anonRows, error: anonError } = await anon.from('saved_menu_editions').select('edition_id');
    assert.ok(anonError || !anonRows.length, 'anon reads nothing');
  });

  test("a menu on a page they can't see, someone else's list, or no age check: refused", async () => {
    assert.ok((await users.home.client.from('saved_menu_editions').insert({ edition_id: ids.hiddenEdition })).error);
    assert.ok((await users.other.client.from('saved_menu_editions').insert({ edition_id: ids.edition, user_id: users.home.id })).error);
    assert.ok((await users.minor.client.from('saved_menu_editions').insert({ edition_id: ids.edition })).error);
  });
});

describe('loved_bars', () => {
  test('a bar can be loved, privately, and unloved', async () => {
    assert.ifError((await users.home.client.from('loved_bars').insert({ profile_id: ids.barProfile })).error);
    assert.deepEqual((await users.home.client.from('loved_bars').select('profile_id')).data, [{ profile_id: ids.barProfile }]);
    assert.deepEqual((await users.other.client.from('loved_bars').select('profile_id')).data, []);
    const { data: anonRows, error: anonError } = await anon.from('loved_bars').select('profile_id');
    assert.ok(anonError || !anonRows.length, 'anon reads nothing');
    assert.ifError((await users.home.client.from('loved_bars').delete().eq('profile_id', ids.barProfile)).error);
    assert.deepEqual((await users.home.client.from('loved_bars').select('profile_id')).data, []);
  });

  test("only a bar's page they can see, and only for themselves", async () => {
    assert.ok((await users.home.client.from('loved_bars').insert({ profile_id: ids.personProfile })).error);
    assert.ok((await users.home.client.from('loved_bars').insert({ profile_id: ids.hiddenProfile })).error);
    assert.ok((await users.other.client.from('loved_bars').insert({ profile_id: ids.barProfile, user_id: users.home.id })).error);
  });
});
