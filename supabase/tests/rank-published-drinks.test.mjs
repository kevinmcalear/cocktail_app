// Ranking a bar's published drink from outside the bar
// (supabase/migrations/20261006130000_rank_published_drinks.sql).
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
  throw new Error(`Refusing to run published ranking tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: {} };

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

const confirmAge = (userId) =>
  db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [userId]);

/** What the app's RankSheet writes: one entry, then its comparisons. */
const rank = (who, item_id, ranked_as_item_id, extra = {}) =>
  users[who].client
    .from('rank_entries')
    .insert({ item_id, ranked_as_item_id, venue_profile_id: ids.openBarProfile, sentiment: 'loved', rank_key: 0, had_on: '2026-10-06', ...extra })
    .select('id')
    .single();

before(async () => {
  await db.connect();
  for (const label of ['guest', 'young']) users[label] = await makeUser(label);
  await confirmAge(users.guest.id);

  // A bar that publishes its drinks (menu descriptions), and one that doesn't.
  ids.openBar = (await serviceInsert('bars', { name: `Open Bar ${run}` })).id;
  ids.closedBar = (await serviceInsert('bars', { name: `Quiet Bar ${run}` })).id;
  await db.query("UPDATE public.bars SET default_publish_mode = 'description' WHERE id = $1", [ids.openBar]);
  const bar = (handle, name, barId) => serviceInsert('profiles', { kind: 'bar', handle: `${handle}${run}`, display_name: `${name} ${run}`, bar_id: barId, is_public: true });
  ids.openBarProfile = (await bar('open', 'Open Bar', ids.openBar)).id;
  await bar('quiet', 'Quiet Bar', ids.closedBar);

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.items.classic = await item({ name: `Classic ${run}`, is_catalog: true });
  ids.items.original = await item({ name: `Open Original ${run}`, bar_id: ids.openBar });
  ids.items.riff = await item({ name: `Open Riff ${run}`, bar_id: ids.openBar, riff_of_id: ids.items.classic, origin: 'Classic' });
  ids.items.unpublished = await item({ name: `Open Secret ${run}`, bar_id: ids.openBar });
  await db.query("UPDATE public.items SET publish_mode = 'private' WHERE id = $1", [ids.items.unpublished]);
  ids.items.quiet = await item({ name: `Quiet Original ${run}`, bar_id: ids.closedBar });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('ranking a bar’s published drink as a guest', () => {
  test('the guest can’t read the bar’s drinks in items, only in published_items', async () => {
    const { data } = await users.guest.client.from('items').select('id').in('id', [ids.items.original, ids.items.riff]);
    assert.deepEqual(data, []);
    const pub = await users.guest.client.from('published_items').select('id').in('id', [ids.items.original, ids.items.riff]);
    assert.equal(pub.data.length, 2);
  });

  test('ranks a published original in its own list, and compares it', async () => {
    const first = await rank('guest', ids.items.original, ids.items.original);
    assert.ifError(first.error);
    const second = await rank('guest', ids.items.original, ids.items.original, { venue_profile_id: null, sentiment: 'fine' });
    assert.ifError(second.error);
    const { error } = await users.guest.client
      .from('rank_comparisons')
      .insert({ winner_entry_id: first.data.id, loser_entry_id: second.data.id, is_tie: false });
    assert.ifError(error);
  });

  test('ranks a published riff as the classic it’s a version of', async () => {
    const { error } = await rank('guest', ids.items.riff, ids.items.classic);
    assert.ifError(error);
    const { data } = await users.guest.client.from('rank_entry_scores').select('item_id, ranked_as_item_id').eq('item_id', ids.items.riff);
    assert.deepEqual(data, [{ item_id: ids.items.riff, ranked_as_item_id: ids.items.classic }]);
  });

  test('can’t rank a drink the bar keeps private, or put anything in its list', async () => {
    for (const [item, list] of [
      [ids.items.unpublished, ids.items.unpublished],
      [ids.items.quiet, ids.items.quiet],
      [ids.items.classic, ids.items.unpublished],
    ]) {
      const { error } = await rank('guest', item, list);
      assert.match(error?.message ?? '', /row-level security/, `${item} in ${list} should be refused`);
    }
  });

  test('still needs a confirmed age', async () => {
    const { error } = await rank('young', ids.items.original, ids.items.original);
    assert.match(error?.message ?? '', /row-level security/);
  });

  test('keeps the entry, readable and deletable, after the bar unpublishes', async () => {
    await db.query("UPDATE public.items SET publish_mode = 'private' WHERE id = $1", [ids.items.original]);
    const { data } = await users.guest.client.from('rank_entries').select('id').eq('item_id', ids.items.original);
    assert.equal(data.length, 2);
    const re = await rank('guest', ids.items.original, ids.items.original, { venue_profile_id: null, sentiment: 'disliked', rank_key: 1 });
    assert.match(re.error?.message ?? '', /row-level security/, 'no new entries once it’s private');
    const del = await users.guest.client.from('rank_entries').delete().eq('item_id', ids.items.original).select('id');
    assert.ifError(del.error);
    assert.equal(del.data.length, 2);
  });
});
