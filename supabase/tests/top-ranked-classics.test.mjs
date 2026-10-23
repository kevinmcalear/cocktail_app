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

// Fixture rankings go straight in: what's under test is the count, not who may rank.
const rank = (who, item_id, ranked_as_item_id, venue_profile_id = null) =>
  db.query(
    "INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key) VALUES ($1, $2, $3, $4, 'loved', 0)",
    [users[who].id, item_id, ranked_as_item_id, venue_profile_id]
  );

const counts = async (client, limit = 200) => {
  const { data, error } = await client.rpc('top_ranked_classics', { p_limit: limit });
  if (error) throw error;
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['home', 'guest', 'regular', 'young']) users[label] = await makeUser(label);
  for (const label of ['home', 'guest', 'regular']) {
    await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [users[label].id]);
  }

  ids.bar = (await serviceInsert('bars', { name: `Top Classics Bar ${run}` })).id;
  ids.barProfile = (await serviceInsert('profiles', { kind: 'bar', handle: `topclassics${run}`, display_name: `Top Classics Bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.classic = await item({ name: `Top Classic ${run}`, is_catalog: true });
  ids.riff = await item({ name: `Bar's Top Classic ${run}`, bar_id: ids.bar, riff_of_id: ids.classic, origin: 'Classic' });
  ids.original = await item({ name: `Bar Original ${run}`, bar_id: ids.bar });

  // One person ranks the classic itself, one ranks the bar's version as it,
  // one does both (still one person), and one without a confirmed age does both.
  await rank('home', ids.classic, ids.classic);
  await rank('guest', ids.riff, ids.classic, ids.barProfile);
  await rank('regular', ids.classic, ids.classic);
  await rank('regular', ids.riff, ids.classic, ids.barProfile);
  await rank('young', ids.classic, ids.classic);
  await rank('young', ids.riff, ids.classic, ids.barProfile);
  // A bar original is ranked as itself: never a classic.
  await rank('guest', ids.original, ids.original, ids.barProfile);
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('top_ranked_classics', () => {
  test('counts each person once per classic, the classic itself and a bar’s drink ranked as it', async () => {
    const row = (await counts(anon)).find((r) => r.item_id === ids.classic);
    // home, guest and regular; young has no confirmed age, so isn't counted.
    assert.deepEqual(row, { item_id: ids.classic, rankers: 3 });
  });

  test('lists only catalog classics, never a bar’s own drink', async () => {
    const rows = await counts(anon);
    assert.ok(!rows.some((r) => r.item_id === ids.riff || r.item_id === ids.original));
  });

  test('returns a count per classic and nothing else, most ranked first', async () => {
    const rows = await counts(users.home.client);
    assert.ok(rows.length > 0);
    for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['item_id', 'rankers']);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].rankers >= rows[i].rankers);
  });

  test('caps the rows at 200 and reads nothing for a zero or negative limit', async () => {
    assert.ok((await counts(anon, 100000)).length <= 200);
    assert.deepEqual(await counts(anon, 0), []);
    assert.deepEqual(await counts(anon, -5), []);
  });
});
