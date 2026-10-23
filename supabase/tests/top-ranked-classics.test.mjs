// The classics most people rank (supabase/migrations/20261103500000_top_ranked_classics.sql).
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run top ranked classics tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const made = [];
// A classic shows once it has the rankers a score needs (private.ranking_min_rankers).
const MIN = 20;

async function makeUser(label, signIn = false) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const user = { id: data.user.id };
  made.push(user);
  if (signIn) {
    user.client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error: signInError } = await user.client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw signInError;
  }
  return user;
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const confirmAge = (userId) => db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [userId]);

// Fixture rankings go straight in: what's under test is the count, not who may rank.
const rank = (userId, item_id, ranked_as_item_id, venue_profile_id = null) =>
  db.query(
    "INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key) VALUES ($1, $2, $3, $4, 'loved', 0)",
    [userId, item_id, ranked_as_item_id, venue_profile_id]
  );

const counts = async (client, limit = 200) => {
  const { data, error } = await client.rpc('top_ranked_classics', { p_limit: limit });
  if (error) throw error;
  return data;
};

before(async () => {
  await db.connect();
  const people = [];
  for (let i = 0; i < MIN; i++) people.push(await makeUser(`ranker${i}`));
  users.signedIn = await makeUser('reader', true);
  users.staff = await makeUser('staff');
  users.young = await makeUser('young');
  users.secret = await makeUser('secret');
  for (const u of [...people, users.staff, users.secret]) await confirmAge(u.id);

  ids.bar = (await serviceInsert('bars', { name: `Top Classics Bar ${run}` })).id;
  ids.barProfile = (await serviceInsert('profiles', { kind: 'bar', handle: `topclassics${run}`, display_name: `Top Classics Bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.privateBar = (await serviceInsert('bars', { name: `Private Classics Bar ${run}` })).id;
  ids.privateProfile = (await serviceInsert('profiles', { kind: 'bar', handle: `privclassics${run}`, display_name: `Private Classics Bar ${run}`, bar_id: ids.privateBar, is_public: true })).id;
  // A venue's page follows its bar's setting.
  await db.query("UPDATE public.bars SET page_visibility = 'private' WHERE id = $1", [ids.privateBar]);
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 30)', [users.staff.id, ids.bar]);

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.classic = await item({ name: `Top Classic ${run}`, is_catalog: true });
  ids.short = await item({ name: `Nearly Classic ${run}`, is_catalog: true });
  ids.riff = await item({ name: `Bar's Top Classic ${run}`, bar_id: ids.bar, riff_of_id: ids.classic, origin: 'Classic' });
  ids.privateRiff = await item({ name: `Private Top Classic ${run}`, bar_id: ids.privateBar, riff_of_id: ids.classic, origin: 'Classic' });

  // MIN - 1 people rank the classic itself. The last ranks the bar's version
  // as the classic, and the classic too: still one person.
  for (const u of people.slice(0, MIN - 1)) await rank(u.id, ids.classic, ids.classic);
  const last = people[MIN - 1];
  await rank(last.id, ids.riff, ids.classic, ids.barProfile);
  await rank(last.id, ids.classic, ids.classic);
  // A bar's drink ranked as itself is never a classic.
  await rank(last.id, ids.riff, ids.riff, ids.barProfile);
  // Not counted: staff at their own bar, no confirmed age, a private page.
  await rank(users.staff.id, ids.riff, ids.classic, ids.barProfile);
  await rank(users.young.id, ids.classic, ids.classic);
  await rank(users.secret.id, ids.privateRiff, ids.classic, ids.privateProfile);
  // One short of the rankers a score needs.
  for (const u of people.slice(0, MIN - 1)) await rank(u.id, ids.short, ids.short);
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of made) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('top_ranked_classics', () => {
  test('counts each person once per classic: the classic itself and a bar’s drink ranked as it', async () => {
    const row = (await counts(anon)).find((r) => r.item_id === ids.classic);
    // Not the staff member, the one with no confirmed age, or the private page's guest.
    assert.deepEqual(row, { item_id: ids.classic, rankers: MIN });
  });

  test('leaves out a classic short of the rankers a score needs, and a bar’s own drink', async () => {
    const rows = await counts(anon);
    assert.ok(!rows.some((r) => r.item_id === ids.short), 'one short of the minimum');
    assert.ok(!rows.some((r) => r.item_id === ids.riff || r.item_id === ids.privateRiff), 'not a catalog classic');
  });

  test('returns a count per classic and nothing else, most ranked first, signed in or out', async () => {
    const rows = await counts(users.signedIn.client);
    assert.ok(rows.some((r) => r.item_id === ids.classic));
    for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['item_id', 'rankers']);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].rankers >= rows[i].rankers);
  });

  test('a limit brings the tie at its last row, caps at 200 and reads nothing at zero or below', async () => {
    const top = await counts(anon, 1);
    assert.ok(top.length >= 1 && top.every((r) => r.rankers === top[0].rankers), 'one row, and every classic tied with it');
    const all = await counts(anon, 100000);
    assert.ok(all.slice(200).every((r) => r.rankers === all[199].rankers), 'past 200, only the tie');
    assert.deepEqual(await counts(anon, 0), []);
    assert.deepEqual(await counts(anon, -5), []);
  });
});
