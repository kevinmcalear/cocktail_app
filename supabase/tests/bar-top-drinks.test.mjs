// A bar's drinks by how people rank them
// (supabase/migrations/20261007100000_bar_top_drinks.sql). Runs through the
// real API, signed out and signed in. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run bar top drinks tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const userIds = [];
let viewer;

async function makeUser(label, { signIn = false } = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  if (!signIn) return { id: data.user.id };
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

// Straight into the table: these tests check what the bar page reads; the
// rank_entries policies are covered in rank-published-drinks.test.mjs.
async function rank(userId, itemId, rankedAsId) {
  await db.query(
    `INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await db.query(
    `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key)
     VALUES ($1, $2, $3, $4, 'loved', 1)`,
    [userId, itemId, rankedAsId, ids.profile]
  );
}

const topDrinks = async (client = anon, profileId = ids.profile) => {
  const { data, error } = await client.rpc('get_bar_top_drinks', { p_profile_id: profileId });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  viewer = await makeUser('viewer', { signIn: true });

  ids.bar = (await serviceInsert('bars', { name: `Top Shelf ${run}` })).id;
  ids.profile = (await serviceInsert('profiles', { kind: 'bar', handle: `topshelf${run}`, display_name: `Top Shelf ${run}`, bar_id: ids.bar, is_public: true })).id;

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.classic = await item({ name: `Gimlet ${run}`, is_catalog: true });
  // The bar's own gimlet, published with its menu description; one it keeps to itself.
  ids.riff = await item({ name: `House Gimlet ${run}`, bar_id: ids.bar, riff_of_id: ids.classic, origin: 'Classic' });
  await db.query("UPDATE public.items SET publish_mode = 'description' WHERE id = $1", [ids.riff]);
  ids.secret = await item({ name: `Secret Sour ${run}`, bar_id: ids.bar });
  // Signatures: shared drinks credited to the bar.
  const signature = (name) => item({ name: `${name} ${run}`, origin_bar_profile_id: ids.profile });
  ids.early = await signature('Early Bird');
  ids.onMenu = await signature('Menu Now');
  ids.oldMenu = await signature('Old Menu');
  ids.offMenu = await signature('Never Listed');
  ids.moderated = await signature('Taken Down');
  await db.query('UPDATE public.items SET moderated_at = now() WHERE id = $1', [ids.moderated]);

  const edition = async (year, drinks) => {
    const e = await serviceInsert('profile_menu_editions', { profile_id: ids.profile, name: `Menu ${year} ${run}`, year });
    for (const [i, itemId] of drinks.entries()) await serviceInsert('profile_menu_edition_drinks', { edition_id: e.id, item_id: itemId, sort_order: i });
  };
  await edition(2026, [ids.onMenu]);
  await edition(2019, [ids.oldMenu, ids.onMenu]);

  // 20 people loved the bar's gimlet and two more ranked the classic there:
  // one list, so one row. 21 ranked the secret sour, which no one outside
  // may see. Three ranked a signature (early), and so did a staff member.
  const people = [];
  for (let i = 0; i < 24; i++) people.push((await makeUser(`ranker${i}`)).id);
  for (const id of people.slice(0, 20)) await rank(id, ids.riff, ids.classic);
  for (const id of people.slice(20, 22)) await rank(id, ids.classic, ids.classic);
  for (const id of people.slice(0, 21)) await rank(id, ids.secret, ids.secret);
  for (const id of people.slice(21, 24)) await rank(id, ids.early, ids.early);
  const staff = await makeUser('staff');
  await serviceInsert('user_bars', { user_id: staff.id, bar_id: ids.bar, role_level: 20 });
  await rank(staff.id, ids.early, ids.early);
  await rank(staff.id, ids.moderated, ids.moderated);
  await db.query('SELECT private.refresh_rankings()');
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.query('SELECT private.refresh_rankings()');
  await db.end();
});

describe("a bar's top drinks", () => {
  test('signed out: ranked drinks with a score, then early ones, then ones nobody has ranked, current menu first', async () => {
    const rows = await topDrinks();
    assert.deepEqual(
      rows.map((r) => [r.item_id, r.position, r.rankers, r.menu]),
      [
        [ids.riff, 1, 22, null],
        [ids.early, null, 3, null],
        [ids.onMenu, null, 0, 'current'],
        [ids.oldMenu, null, 0, 'past'],
        [ids.offMenu, null, 0, null],
      ]
    );
    const [top, early] = rows;
    assert.equal(top.name, `House Gimlet ${run}`, "the bar's own version stands for the list, not the classic");
    assert.equal(top.ranked_as_name, `Gimlet ${run}`);
    assert.equal(top.bar_id, ids.bar);
    assert.equal(Number(top.score), 10);
    assert.equal(early.score, null, 'early rows carry no score');
    assert.equal(early.ranked_as_name, null);
  });

  test('never names a drink the bar keeps private or one taken down, however many ranked it', async () => {
    for (const client of [anon, viewer.client]) {
      const rows = await topDrinks(client);
      const shown = rows.map((r) => r.item_id);
      assert.ok(!shown.includes(ids.secret), 'private drink left out');
      assert.ok(!shown.includes(ids.moderated), 'moderated drink left out');
      assert.ok(!rows.some((r) => r.name.includes('Secret') || r.name.includes('Taken Down')));
    }
  });

  test('once the bar publishes the drink, it shows with its score', async () => {
    await db.query("UPDATE public.items SET publish_mode = 'description' WHERE id = $1", [ids.secret]);
    try {
      const rows = await topDrinks();
      const secret = rows.find((r) => r.item_id === ids.secret);
      assert.equal(secret?.rankers, 21);
      assert.equal(Number(secret?.score), 10);
    } finally {
      await db.query('UPDATE public.items SET publish_mode = NULL WHERE id = $1', [ids.secret]);
    }
  });

  test('a closed bar has no current menu', async () => {
    await db.query('UPDATE public.profiles SET is_closed = true WHERE id = $1', [ids.profile]);
    try {
      const rows = await topDrinks();
      assert.equal(rows.find((r) => r.item_id === ids.onMenu)?.menu, 'past');
    } finally {
      await db.query('UPDATE public.profiles SET is_closed = false WHERE id = $1', [ids.profile]);
    }
  });

  test('a hidden or taken-down bar returns nothing, and the limit holds', async () => {
    await db.query('UPDATE public.profiles SET is_public = false WHERE id = $1', [ids.profile]);
    assert.deepEqual(await topDrinks(), []);
    assert.deepEqual(await topDrinks(viewer.client), []);
    await db.query('UPDATE public.profiles SET is_public = true, moderated_at = now() WHERE id = $1', [ids.profile]);
    assert.deepEqual(await topDrinks(), []);
    await db.query('UPDATE public.profiles SET moderated_at = NULL WHERE id = $1', [ids.profile]);

    const { data } = await anon.rpc('get_bar_top_drinks', { p_profile_id: ids.profile, p_limit: 2 });
    assert.deepEqual(data.map((r) => r.item_id), [ids.riff, ids.early]);
  });

  test('the visibility helper is not callable from the API', async () => {
    const { error } = await viewer.client.schema('private').rpc('is_listed_drink', { p_item_id: ids.riff });
    assert.ok(error);
  });
});
