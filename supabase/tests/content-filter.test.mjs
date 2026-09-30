// Content filtering for text other people can see
// (supabase/migrations/20260930600000_content_filter.sql).
// Runs against the local stack only: `npm run test:security`.
//
// The refused words below are here because the test has to name them. They
// are the migration's list, written the ways people get around lists.
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
  throw new Error(`Refusing to run content filter tests against a non-local API: ${status.API_URL}`);
}

// Letters only, so the run id can't turn into words of its own.
const run = randomUUID().replace(/[^a-f]/g, '').slice(0, 6).padEnd(6, 'x');
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
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

const screened = async (text) => (await db.query('SELECT private.screen_text($1) AS word', [text])).rows[0].word;

// A refusal as the app sees it: P0001, the message it shows, the column.
function assertRefused({ error }, message, column) {
  assert.ok(error, 'expected the write to be refused');
  assert.equal(error.code, 'P0001');
  assert.equal(error.message, message);
  if (column) assert.equal(error.details, column);
}

const refusedSql = (sql, params, message) =>
  assert.rejects(db.query(sql, params), (e) => {
    assert.equal(e.code, 'P0001');
    assert.equal(e.message, message);
    return true;
  });

// Names real bars use, and the words a list mustn't catch.
const ORDINARY = [
  'Sex on the Beach',
  'Screwdriver',
  'Bloody Mary',
  'Slippery Nipple',
  'Cocktail',
  "Cock 'n' Bull",
  'Corpse Reviver No. 2',
  'Suffering Bastard',
  'Zombie',
  'A shot of Fernet',
  'Dick Bradsell',
  'Hanky Panky',
  'Negroni from Niger',
  'He sniggered into his Martini',
  'A niggardly pour',
  'The Therapist',
  'Scunthorpe Sour',
  'Fire retardant',
  'Pakistani chai punch',
  'Kill Devil rum',
  'Rapé snuff old fashioned',
  'Room 101',
  'Gin & tonic, 50/50',
  'Café brûlot',
  'Mezcal paloma 🌶️',
];

// The ways people write a listed word to slip past a list.
const EVASIONS = [
  ['nigger', 'NIGGER'],
  ['nigger', 'n i g g e r'],
  ['nigger', 'n.i.g.g.e.r'],
  ['nigger', 'n1gg3r'],
  ['nigger', 'n!gger'],
  ['nigger', 'niiiiggggerrr'],
  ['nigger', 'nígger'],
  ['nigger', 'nig​ger'],
  ['nigger', 'big.nigger.4a2'],
  ['faggot', 'Fagg0ts'],
  ['faggot', 'f@ggot'],
  ['tranny', 'tr4nny'],
  ['retard', 'Retards'],
  ['cunt', 'C U N T'],
  ['kike', 'k1ke'],
  ['kill yourself', 'K1LL Y0URSELF'],
  ['kill yourself', 'k i l l y o u r s e l f'],
  ['sieg heil', 's1eg h3il'],
];

before(async () => {
  await db.connect();
  for (const label of ['person', 'openAdmin', 'closedAdmin']) users[label] = await makeUser(label);

  ids.personProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `pat${run}`, display_name: `Pat ${run}`, user_id: users.person.id, is_public: true })
  ).id;

  // An open bar (everything public by default) and a closed one.
  ids.openBar = (await serviceInsert('bars', { name: `Open House ${run}` })).id;
  ids.closedBar = (await serviceInsert('bars', { name: `Speakeasy ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.openAdmin.id, bar_id: ids.openBar, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.closedAdmin.id, bar_id: ids.closedBar, role_level: 40 });
  ids.openProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `open${run}`, display_name: `Open House ${run}`, bar_id: ids.openBar, is_public: true })
  ).id;
  await serviceInsert('profiles', { kind: 'bar', handle: `speak${run}`, display_name: `Speakeasy ${run}`, bar_id: ids.closedBar, is_public: true });
  await db.query("UPDATE public.bars SET default_publish_mode = 'spec' WHERE id = $1", [ids.openBar]);

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.openDrink = await item({ name: `Open Sour ${run}`, bar_id: ids.openBar });
  ids.secretDrink = await item({ name: `Secret Sour ${run}`, bar_id: ids.openBar, publish_mode: 'private' });
  // Private while the bar is closed, so its name isn't checked yet.
  ids.badDrink = await item({ name: `Faggot Fizz ${run}`, bar_id: ids.closedBar });
  ids.goodDrink = await item({ name: `Garden Fizz ${run}`, bar_id: ids.closedBar });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.releases WHERE bar_id IN (SELECT id FROM public.bars WHERE name LIKE $1)', [like]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('the word list', () => {
  test('ordinary drink names and drinking words pass', async () => {
    for (const text of ORDINARY) assert.equal(await screened(text), null, text);
  });

  test('listed words are caught however they are written', async () => {
    for (const [word, text] of EVASIONS) assert.equal(await screened(text), word, text);
  });

  test('signed-in and signed-out callers cannot read the list or call the matcher', async () => {
    const { error } = await users.person.client.schema('private').from('screened_words').select('word');
    assert.ok(error);
    const { rows } = await db.query(
      "SELECT has_function_privilege('authenticated', 'private.screen_text(text)', 'EXECUTE') AS a, has_function_privilege('anon', 'private.screen_text(text)', 'EXECUTE') AS b"
    );
    assert.deepEqual(rows[0], { a: false, b: false });
  });
});

describe('profiles', () => {
  test('a person cannot put a listed word in their name, handle or bio', async () => {
    const profiles = users.person.client.from('profiles');
    assertRefused(
      await profiles.update({ display_name: 'N1gg3r' }).eq('id', ids.personProfile),
      "That name has a word we don't allow. Please change it.",
      'display_name'
    );
    assertRefused(
      await profiles.update({ handle: `big.nigger.${run}` }).eq('id', ids.personProfile),
      "That handle has a word we don't allow. Please change it.",
      'handle'
    );
    assertRefused(
      await profiles.update({ bio: 'Bartender. k i l l  y o u r s e l f' }).eq('id', ids.personProfile),
      "That bio has a word we don't allow. Please change it.",
      'bio'
    );
    const ok = await profiles.update({ display_name: `Pat the Screwdriver ${run}`, bio: 'Sex on the Beach, unironically.' }).eq('id', ids.personProfile);
    assert.ifError(ok.error);
  });

  test('adding a bar with a listed word in its name is refused', async () => {
    const { error } = await users.person.client.rpc('add_venue', {
      p_name: `Tranny Bar ${run}`,
      p_address_line: '1 Test Street',
      p_city: `Testville ${run}`,
      p_country_code: 'au',
      p_latitude: 11,
      p_longitude: 21,
    });
    assertRefused({ error }, "That name has a word we don't allow. Please change it.", 'display_name');
  });

  test('position titles are checked', async () => {
    const { error } = await users.person.client
      .from('profile_positions')
      .insert({ person_profile_id: ids.personProfile, bar_profile_id: ids.openProfile, title: 'Head retard' });
    assertRefused({ error }, "That title has a word we don't allow. Please change it.", 'title');
  });
});

describe('drinks', () => {
  test("a published drink's name and description are checked; a private one's are not", async () => {
    const items = users.openAdmin.client.from('items');
    assertRefused(
      await items.update({ name: `Kike Sour ${run}` }).eq('id', ids.openDrink),
      "That name has a word we don't allow. Please change it.",
      'name'
    );
    assertRefused(
      await items.update({ description: 'Tastes like a c.u.n.t' }).eq('id', ids.openDrink),
      "That description has a word we don't allow. Please change it.",
      'description'
    );
    assert.ifError((await items.update({ name: `Bloody Screwdriver ${run}`, description: 'Cock and bull.' }).eq('id', ids.openDrink)).error);

    // Private text is the bar's own business, until it's published.
    assert.ifError((await items.update({ name: `Faggot Sour ${run}` }).eq('id', ids.secretDrink)).error);
    assertRefused(
      await items.update({ publish_mode: 'spec' }).eq('id', ids.secretDrink),
      "That name has a word we don't allow. Please change it.",
      'name'
    );
  });

  test("opening a bar's default, or a menu, checks the drinks it would open", async () => {
    await refusedSql(
      "UPDATE public.bars SET default_publish_mode = 'description' WHERE id = $1",
      [ids.closedBar],
      `The drink "Faggot Fizz ${run}" has a word we don't allow in its name. Change it before publishing.`
    );

    const menu = (await serviceInsert('menus', { name: `Autumn ${run}`, bar_id: ids.closedBar })).id;
    await db.query('INSERT INTO public.menu_drinks (menu_id, item_id) VALUES ($1, $2), ($1, $3)', [menu, ids.goodDrink, ids.badDrink]);
    await refusedSql(
      "UPDATE public.menus SET publish_mode = 'description' WHERE id = $1",
      [menu],
      `The drink "Faggot Fizz ${run}" has a word we don't allow in its name. Change it before publishing.`
    );

    await db.query('DELETE FROM public.menu_drinks WHERE menu_id = $1 AND item_id = $2', [menu, ids.badDrink]);
    await db.query("UPDATE public.menus SET publish_mode = 'description' WHERE id = $1", [menu]);
    await refusedSql(
      'INSERT INTO public.menu_drinks (menu_id, item_id) VALUES ($1, $2)',
      [menu, ids.badDrink],
      `The drink "Faggot Fizz ${run}" has a word we don't allow in its name. Change it before publishing.`
    );
  });
});

describe('releases', () => {
  test('a draft can say anything; publishing checks its name and description', async () => {
    const release = (
      await serviceInsert('releases', { bar_id: ids.openBar, name: `Wetback Winter ${run}`, release_date: '2026-10-01' })
    ).id;
    await serviceInsert('release_items', { release_id: release, bar_id: ids.openBar, item_id: ids.openDrink });
    const releases = users.openAdmin.client.from('releases');
    assertRefused(
      await releases.update({ published_at: new Date().toISOString() }).eq('id', release),
      "That name has a word we don't allow. Please change it.",
      'name'
    );
    assert.ifError((await releases.update({ name: `Winter ${run}`, published_at: new Date().toISOString() }).eq('id', release)).error);
    assertRefused(
      await releases.update({ description: 'Heil Hitler' }).eq('id', release),
      "That description has a word we don't allow. Please change it.",
      'description'
    );
  });
});
