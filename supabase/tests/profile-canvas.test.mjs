// Profiles as the canvas draws them (20261013400000_profile_canvas.sql): job
// dates and a Shown switch on every job, awards people send themselves
// (pending until a moderator confirms), Show my city, Say where I had it, the
// top four's oldest pin making room, and drinks on worked menus.
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
  throw new Error(`Refusing to run profile canvas tests against a non-local API: ${status.API_URL}`);
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

const bar = (handle) => serviceInsert('profiles', { kind: 'bar', handle: `${handle}${run}`, display_name: `${handle} ${run}`, is_public: true });
const award = (extra = {}) => ({ profile_id: ids.person, award: `Test Awards ${run}`, year: 2025, title: 'Bartender of the Year', source_url: 'https://example.com/winners', ...extra });
const titles = async (client) => {
  const { data, error } = await client.from('profile_awards').select('title, year').eq('profile_id', ids.person);
  assert.ifError(error);
  return data.map((a) => `${a.title} ${a.year}`).sort();
};

before(async () => {
  await db.connect();
  for (const label of ['person', 'stranger', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [users.person.id]);
  ids.bar = (await bar('canvasbar')).id;
  ids.oldBar = (await bar('canvasold')).id;
  ids.person = (
    await serviceInsert('profiles', { kind: 'person', handle: `canvasp${run}`, display_name: `Canvas ${run}`, user_id: users.person.id, is_public: true, city: 'Melbourne', locality: 'Fitzroy', had_mode: 'all', bars_mode: 'all' })
  ).id;
  ids.job = (await serviceInsert('profile_positions', { person_profile_id: ids.person, bar_profile_id: ids.bar, title: 'Head bartender', start_year: 2023 })).id;
  ids.researched = (await serviceInsert('profile_awards', award({ year: 2024, title: 'Researched Award' }))).id;
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}%`]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('jobs', () => {
  test('carry from and to months, and a current job has no end', async () => {
    const ok = await users.person.client.from('profile_positions').update({ start_year: 2023, start_month: 4 }).eq('id', ids.job).select('id');
    assert.ifError(ok.error);
    assert.equal(ok.data.length, 1);
    const ended = await users.person.client.from('profile_positions').update({ end_year: 2024 }).eq('id', ids.job);
    assert.ok(ended.error, 'a current job cannot end');
    const monthOnly = await users.person.client.from('profile_positions').update({ start_year: null, start_month: 4 }).eq('id', ids.job);
    assert.ok(monthOnly.error, 'a month needs its year');
    const past = await serviceInsert('profile_positions', { person_profile_id: ids.person, bar_profile_id: ids.oldBar, title: 'Bartender', is_current: false, start_year: 2019, end_year: 2023 });
    const backwards = await users.person.client.from('profile_positions').update({ end_year: 2018 }).eq('id', past.id);
    assert.ok(backwards.error, 'it cannot end before it starts');
  });

  test('the person hides their current job, and only they show it again', async () => {
    const read = async (client) => (await client.from('profile_positions').select('title').eq('person_profile_id', ids.person)).data.map((r) => r.title);
    assert.deepEqual(await read(anon), ['Head bartender']);
    assert.ifError((await users.person.client.from('profile_positions').update({ is_hidden: true }).eq('id', ids.job)).error);
    assert.deepEqual(await read(anon), []);
    assert.deepEqual(await read(users.stranger.client), []);
    assert.ok((await read(users.person.client)).includes('Head bartender'), 'the person still reads it');
    const moderator = await users.moderator.client.from('profile_positions').update({ is_hidden: false }).eq('id', ids.job);
    assert.ok(moderator.error, 'only the person shows it again');
    assert.ifError((await users.person.client.from('profile_positions').update({ is_hidden: false }).eq('id', ids.job)).error);
    assert.deepEqual(await read(anon), ['Head bartender']);
  });
});

describe('awards a person adds', () => {
  test('come in pending, theirs, and only they see them until a moderator confirms', async () => {
    const sent = await users.person.client
      .from('profile_awards')
      .insert(award({ status: 'confirmed', position: 3, is_finalist: true, bar_profile_id: ids.bar }))
      .select('id, status, added_by, position, is_finalist, bar_profile_id')
      .single();
    assert.ifError(sent.error);
    assert.equal(sent.data.status, 'pending', 'they cannot confirm their own');
    assert.equal(sent.data.added_by, users.person.id);
    assert.equal(sent.data.position, null);
    assert.equal(sent.data.bar_profile_id, ids.bar);
    ids.sent = sent.data.id;
    assert.deepEqual(await titles(anon), ['Researched Award 2024']);
    assert.deepEqual(await titles(users.stranger.client), ['Researched Award 2024']);
    assert.deepEqual(await titles(users.person.client), ['Bartender of the Year 2025', 'Researched Award 2024']);

    const confirm = await users.moderator.client.from('profile_awards').update({ status: 'confirmed' }).eq('id', ids.sent).select('id');
    assert.ifError(confirm.error);
    assert.equal(confirm.data.length, 1);
    assert.deepEqual(await titles(anon), ['Bartender of the Year 2025', 'Researched Award 2024']);
  });

  test('need a source, go only on their own profile, and only their pick changes after', async () => {
    const noSource = await users.person.client.from('profile_awards').insert(award({ year: 2023, source_url: null }));
    assert.ok(noSource.error);
    const onBar = await users.person.client.from('profile_awards').insert(award({ profile_id: ids.bar, year: 2023 }));
    assert.ok(onBar.error, 'not on a bar they do not run');
    const notABar = await users.person.client.from('profile_awards').insert(award({ year: 2022, bar_profile_id: ids.person }));
    assert.ok(notABar.error, 'the bar has to be a bar');
    const retitle = await users.person.client.from('profile_awards').update({ title: 'Something Else' }).eq('id', ids.sent);
    assert.ok(retitle.error, 'only a moderator changes one');
    const stranger = await users.stranger.client.from('profile_awards').update({ on_profile: false }).eq('id', ids.sent).select('id');
    assert.equal(stranger.data?.length ?? 0, 0);
  });

  test('show and hide by mode and pick', async () => {
    assert.ifError((await users.person.client.from('profile_awards').update({ on_profile: false }).eq('id', ids.researched)).error);
    assert.deepEqual(await titles(anon), ['Bartender of the Year 2025']);
    assert.ifError((await users.person.client.from('profiles').update({ awards_mode: 'picked' }).eq('id', ids.person)).error);
    assert.deepEqual(await titles(anon), []);
    assert.ifError((await users.person.client.from('profile_awards').update({ on_profile: true }).eq('id', ids.sent)).error);
    assert.deepEqual(await titles(anon), ['Bartender of the Year 2025']);
    assert.ifError((await users.person.client.from('profiles').update({ awards_mode: 'none' }).eq('id', ids.person)).error);
    assert.deepEqual(await titles(users.stranger.client), []);
    assert.ifError((await users.person.client.from('profiles').update({ awards_mode: 'all' }).eq('id', ids.person)).error);
  });

  test('they remove one they sent, not one we researched', async () => {
    const researched = await users.person.client.from('profile_awards').delete().eq('id', ids.researched).select('id');
    assert.equal(researched.data?.length ?? 0, 0);
    const sent = await users.person.client.from('profile_awards').delete().eq('id', ids.sent).select('id');
    assert.ifError(sent.error);
    assert.equal(sent.data.length, 1);
  });
});

describe('Show my city', () => {
  test('off takes the city off the public row, on puts it back', async () => {
    const place = async () => (await anon.from('profiles').select('city, locality').eq('id', ids.person).single()).data;
    assert.ifError((await users.person.client.from('profiles').update({ shows_city: false }).eq('id', ids.person)).error);
    assert.deepEqual(await place(), { city: null, locality: null });
    const hidden = await users.person.client.rpc('my_hidden_city');
    assert.ifError(hidden.error);
    assert.equal(hidden.data, 'Melbourne');
    assert.equal((await users.stranger.client.rpc('my_hidden_city')).data, null);
    assert.ifError((await users.person.client.from('profiles').update({ shows_city: true }).eq('id', ids.person)).error);
    assert.deepEqual(await place(), { city: 'Melbourne', locality: 'Fitzroy' });
  });
});

describe('drinks they’ve had', () => {
  before(async () => {
    for (const name of ['Martini', 'Negroni', 'Daiquiri', 'Gimlet', 'Sazerac']) ids.items[name] = (await serviceInsert('items', { item_type: 'cocktail', name: `${name} ${run}` })).id;
    const rows = Object.keys(ids.items).map((name) => ({ item_id: ids.items[name], ranked_as_item_id: ids.items[name], venue_profile_id: ids.bar, sentiment: 'loved', rank_key: 0 }));
    const { data, error } = await users.person.client.from('rank_entries').insert(rows).select('id, item_id');
    assert.ifError(error);
    for (const r of data) ids.entries[Object.keys(ids.items).find((k) => ids.items[k] === r.item_id)] = r.id;
  });

  test('Say where I had it off shows "At a bar" and never names the bar beside it', async () => {
    assert.ifError((await users.person.client.from('rank_entries').update({ says_where: false }).eq('id', ids.entries.Martini)).error);
    const { data, error } = await users.stranger.client.rpc('get_profile_drinks', { p_profile_id: ids.person });
    assert.ifError(error);
    const martini = data.find((r) => r.item_id === ids.items.Martini);
    assert.equal(martini.at_bar, true);
    assert.equal(martini.venue_id, null);
    assert.ok(data.filter((r) => r.item_id !== ids.items.Martini).every((r) => r.venue_id === ids.bar));
  });

  test('pinning a fifth makes room by unpinning the oldest', async () => {
    const pin = (name, on = true) => users.person.client.rpc('pin_profile_drink', { p_entry_id: ids.entries[name], p_pin: on });
    for (const name of ['Martini', 'Negroni', 'Daiquiri', 'Gimlet']) {
      const r = await pin(name);
      assert.ifError(r.error);
      assert.equal(r.data, null);
    }
    const fifth = await pin('Sazerac');
    assert.ifError(fifth.error);
    assert.equal(fifth.data, ids.entries.Martini, 'the oldest made room');
    const { rows } = await db.query('SELECT id, profile_pin, on_profile FROM public.rank_entries WHERE user_id = $1 AND profile_pin IS NOT NULL ORDER BY profile_pin', [users.person.id]);
    assert.deepEqual(rows.map((r) => r.id), ['Negroni', 'Daiquiri', 'Gimlet', 'Sazerac'].map((n) => ids.entries[n]));
    assert.ok(rows.every((r) => r.on_profile));
    assert.ifError((await pin('Daiquiri', false)).error);
    const after = await db.query('SELECT profile_pin FROM public.rank_entries WHERE user_id = $1 AND profile_pin IS NOT NULL ORDER BY profile_pin', [users.person.id]);
    assert.deepEqual(after.rows.map((r) => r.profile_pin), [1, 2, 3], 'unpinning closes the gap');
    const theirs = await users.stranger.client.rpc('pin_profile_drink', { p_entry_id: ids.entries.Negroni, p_pin: false });
    assert.ok(theirs.error, 'only your own drinks');
  });
});

describe('drinks on worked menus', () => {
  test('the person lists them; everyone reads them with the menu; nobody else writes', async () => {
    const menu = await serviceInsert('profile_worked_menus', { person_profile_id: ids.person, bar_profile_id: ids.oldBar, name: `Night Garden ${run}`, year: 2024 });
    const add = await users.person.client.from('profile_worked_menu_drinks').insert({ worked_menu_id: menu.id, item_id: ids.items.Negroni });
    assert.ifError(add.error);
    const stranger = await users.stranger.client.from('profile_worked_menu_drinks').insert({ worked_menu_id: menu.id, item_id: ids.items.Gimlet });
    assert.ok(stranger.error);
    const { data, error } = await anon.from('profile_worked_menu_drinks').select('item_id').eq('worked_menu_id', menu.id);
    assert.ifError(error);
    assert.deepEqual(data, [{ item_id: ids.items.Negroni }]);
  });
});
