// Showing the drinks you've had, and the bars you had them at, on your profile
// (supabase/migrations/20261001220000_shared_rankings.sql,
// 20261009970000_profile_sharing_choices.sql).
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
  throw new Error(`Refusing to run shared ranking tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
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

/** The drinks a reader gets for the ranker's profile. */
const drinks = async (client, profileId = ids.rankerProfile) => {
  const { data, error } = await client.rpc('get_profile_drinks', { p_profile_id: profileId });
  assert.ifError(error);
  return data;
};
const names = (rows) => rows.map((r) => r.name).sort();

/** The bars a reader gets for the ranker's profile. */
const bars = async (client, profileId = ids.rankerProfile) => {
  const { data, error } = await client.rpc('get_profile_bars', { p_profile_id: profileId });
  assert.ifError(error);
  return data;
};

const share = (patch) => users.ranker.client.from('profiles').update(patch).eq('id', ids.rankerProfile).select('shares_rankings, shares_bars, shares_made');
const setSharing = (on) => share({ shares_rankings: on, shares_bars: on });

before(async () => {
  await db.connect();
  for (const label of ['ranker', 'reader', 'unconfirmed']) users[label] = await makeUser(label);
  await confirmAge(users.ranker.id);

  // An open bar (publishes its drinks), a private bar the ranker works at, and a bar whose profile gets hidden.
  ids.openBar = (await serviceInsert('bars', { name: `Open Bar ${run}` })).id;
  ids.staffBar = (await serviceInsert('bars', { name: `Staff Bar ${run}` })).id;
  await db.query("UPDATE public.bars SET default_publish_mode = 'description' WHERE id = $1", [ids.openBar]);
  await serviceInsert('user_bars', { user_id: users.ranker.id, bar_id: ids.staffBar, role_level: 30 });
  const bar = (handle, name, barId) => serviceInsert('profiles', { kind: 'bar', handle: `${handle}${run}`, display_name: `${name} ${run}`, bar_id: barId, is_public: true, locality: 'Fitzroy', city: 'Melbourne' });
  ids.openBarProfile = (await bar('open', 'Open Bar', ids.openBar)).id;
  ids.staffBarProfile = (await bar('staff', 'Staff Bar', ids.staffBar)).id;
  ids.goneBarProfile = (await bar('gone', 'Gone Bar', null)).id;

  ids.rankerProfile = (await serviceInsert('profiles', { kind: 'person', handle: `ranker${run}`, display_name: `Ranker ${run}`, user_id: users.ranker.id, is_public: true })).id;
  ids.unconfirmedProfile = (await serviceInsert('profiles', { kind: 'person', handle: `young${run}`, display_name: `Unconfirmed ${run}`, user_id: users.unconfirmed.id, is_public: true, shares_rankings: true })).id;

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.items.classic = await item({ name: `Classic ${run}` });
  ids.items.published = await item({ name: `Open Fizz ${run}`, bar_id: ids.openBar });
  ids.items.staffRiff = await item({ name: `Staff Secret ${run}`, bar_id: ids.staffBar, riff_of_id: ids.items.classic });
  ids.items.staffOriginal = await item({ name: `Staff Original ${run}`, bar_id: ids.staffBar });
  ids.items.ownPrivate = await item({ name: `Kitchen Negroni ${run}`, created_by: users.ranker.id });
  ids.items.signature = await item({ name: `Gone Signature ${run}`, origin_bar_profile_id: ids.goneBarProfile });

  // The ranker's lists, written through the app's own path (RLS), the open
  // bar's published drink too (20261006130000).
  const entry = (item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key) => ({ item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key, had_on: '2026-09-12' });
  const { classic, published, staffRiff, staffOriginal, ownPrivate, signature } = ids.items;
  const { error } = await users.ranker.client.from('rank_entries').insert([
    entry(staffRiff, classic, ids.staffBarProfile, 'loved', 0), // 10.0, shown as the classic
    entry(classic, classic, null, 'loved', 1), // 8.4 (second of two loved), at home
    entry(staffOriginal, staffOriginal, ids.staffBarProfile, 'fine', 0), // never named
    entry(ownPrivate, ownPrivate, null, 'disliked', 0), // never named
    entry(signature, signature, ids.goneBarProfile, 'fine', 0),
    entry(published, published, ids.openBarProfile, 'loved', 0),
  ]);
  assert.ifError(error);
  const young = await db.query(
    "INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, sentiment, rank_key) VALUES ($1, $2, $2, 'loved', 0)",
    [users.unconfirmed.id, classic]
  );
  assert.equal(young.rowCount, 1);
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('showing the drinks you’ve had', () => {
  test('off by default: nobody else gets anything, and the tables stay the owner’s', async () => {
    assert.deepEqual(await drinks(users.reader.client), []);
    assert.deepEqual(await drinks(users.ranker.client), [], 'the owner reads their own list from rank_entry_scores, not from here');
    assert.deepEqual(await bars(users.reader.client), []);
    for (const table of ['rank_entries', 'rank_entry_scores']) {
      const { data } = await users.reader.client.from(table).select('id').eq('user_id', users.ranker.id);
      assert.deepEqual(data ?? [], [], `a reader gets no ${table} rows`);
    }
  });

  test('signed-out visitors can’t call either, shared or not', async () => {
    for (const fn of ['get_profile_drinks', 'get_profile_bars']) {
      const { data, error } = await anon.rpc(fn, { p_profile_id: ids.rankerProfile });
      assert.ok(error, `anon is refused ${fn}`);
      assert.equal(data, null);
    }
  });

  test('only the owner turns sharing on, and only on a person’s profile', async () => {
    const byReader = await users.reader.client.from('profiles').update({ shares_rankings: true }).eq('id', ids.rankerProfile).select('id');
    assert.deepEqual(byReader.data ?? [], []);
    assert.deepEqual(await drinks(users.reader.client), []);

    await assert.rejects(db.query('UPDATE public.profiles SET shares_rankings = true WHERE id = $1', [ids.openBarProfile]), /profiles_shares_rankings_person/);
    await assert.rejects(db.query('UPDATE public.profiles SET shares_bars = true WHERE id = $1', [ids.openBarProfile]), /profiles_shares_bars_person/);
    await assert.rejects(db.query('UPDATE public.profiles SET shares_made = false WHERE id = $1', [ids.openBarProfile]), /profiles_shares_made_person/);

    const on = await setSharing(true);
    assert.ifError(on.error);
    assert.equal(on.data[0].shares_rankings, true);
    // The flag itself is readable signed out, with the rest of the public profile.
    const seen = await anon.from('profiles').select('shares_rankings, shares_bars, shares_made').eq('id', ids.rankerProfile).single();
    assert.ifError(seen.error);
    assert.deepEqual(seen.data, { shares_rankings: true, shares_bars: true, shares_made: true });
  });

  test('a reader sees the drinks that can be named, with scores from the whole list', async () => {
    const rows = await drinks(users.reader.client);
    assert.deepEqual(names(rows), [`Classic ${run}`, `Classic ${run}`, `Gone Signature ${run}`, `Open Fizz ${run}`]);

    // The bar's unpublished riff shows as the classic it was ranked as, at the bar, and opens the classic.
    const riff = rows.find((r) => r.venue_id === ids.staffBarProfile);
    assert.equal(riff.name, `Classic ${run}`);
    assert.equal(riff.item_id, ids.items.classic);
    assert.equal(riff.list_name, null);
    assert.equal(Number(riff.score), 10);
    assert.equal(riff.venue_name, `Staff Bar ${run}`);
    assert.equal(riff.venue_locality, 'Fitzroy');

    // Made at home: no bar. Second of two loved in the list.
    const home = rows.find((r) => r.venue_id === null);
    assert.equal(home.item_id, ids.items.classic);
    assert.equal(Number(home.score), 8.4);
    assert.equal(home.had_on, '2026-09-12');

    const published = rows.find((r) => r.name === `Open Fizz ${run}`);
    assert.equal(published.venue_handle, `open${run}`);
    assert.equal(published.sentiment, 'loved');

    // Never named: the bar's unpublished original and the ranker's own private drink.
    const everything = JSON.stringify(rows);
    for (const secret of ['Staff Secret', 'Staff Original', 'Kitchen Negroni']) assert.ok(!everything.includes(secret), `${secret} stays private`);
    assert.ok(!rows.some((r) => 'user_id' in r), 'no user ids');
  });

  test('bars: one row per public bar with the average there, best drink named only with drinks shared', async () => {
    const rows = await bars(users.reader.client);
    // Staff Bar: the riff (10) and the unpublished original, which is left out as it is from the drinks.
    assert.deepEqual(
      rows.map((r) => [r.venue_name, r.drinks, Number(r.average), r.best_name]),
      [
        [`Open Bar ${run}`, 1, 10, `Open Fizz ${run}`],
        [`Staff Bar ${run}`, 1, 10, `Classic ${run}`],
        [`Gone Bar ${run}`, 1, Number(rows.find((r) => r.venue_name === `Gone Bar ${run}`).average), `Gone Signature ${run}`],
      ].sort((a, b) => b[2] - a[2] || b[1] - a[1] || a[0].localeCompare(b[0]))
    );
    assert.ok(!rows.some((r) => r.venue_id === null), 'home is not a bar');

    // Bars without drinks: the tally stays, no drink is named, and the drinks list is empty.
    assert.ifError((await share({ shares_rankings: false })).error);
    const only = await bars(users.reader.client);
    assert.equal(only.length, 3);
    assert.ok(only.every((r) => r.best_name === null && r.best_score === null));
    assert.deepEqual(await drinks(users.reader.client), []);

    // Drinks without bars: every drink still shows, but no bar is named; a bar drink says it was at a bar.
    assert.ifError((await share({ shares_rankings: true, shares_bars: false })).error);
    assert.deepEqual(await bars(users.reader.client), []);
    const unplaced = await drinks(users.reader.client);
    assert.equal(unplaced.length, 4);
    assert.ok(unplaced.every((r) => r.venue_id === null && r.venue_name === null && r.venue_handle === null));
    assert.deepEqual(unplaced.map((r) => r.at_bar).sort(), [false, true, true, true]);
    assert.ok(!JSON.stringify(unplaced).includes('Bar '), 'no bar names anywhere');

    assert.ifError((await setSharing(true)).error);
  });

  test('a bar whose profile is hidden or private takes its entries with it', async () => {
    await db.query('UPDATE public.profiles SET moderated_at = now() WHERE id = $1', [ids.goneBarProfile]);
    assert.ok(!names(await drinks(users.reader.client)).includes(`Gone Signature ${run}`));
    await db.query('UPDATE public.profiles SET moderated_at = NULL, is_public = false WHERE id = $1', [ids.goneBarProfile]);
    assert.ok(!names(await drinks(users.reader.client)).includes(`Gone Signature ${run}`));
    await db.query('UPDATE public.profiles SET is_public = true WHERE id = $1', [ids.goneBarProfile]);
    assert.ok(names(await drinks(users.reader.client)).includes(`Gone Signature ${run}`));
  });

  test('a block hides them in both directions', async () => {
    assert.ifError((await users.ranker.client.from('user_blocks').insert({ blocked_id: users.reader.id })).error);
    assert.deepEqual(await drinks(users.reader.client), []);
    assert.ifError((await users.ranker.client.from('user_blocks').delete().eq('blocked_id', users.reader.id)).error);

    assert.ifError((await users.reader.client.from('user_blocks').insert({ blocked_id: users.ranker.id })).error);
    assert.deepEqual(await drinks(users.reader.client), []);
    assert.ifError((await users.reader.client.from('user_blocks').delete().eq('blocked_id', users.ranker.id)).error);
    assert.equal((await drinks(users.reader.client)).length, 4);
  });

  test('a private profile, a moderation hold, or turning sharing off hides them straight away', async () => {
    const hide = (sql) => db.query(`UPDATE public.profiles SET ${sql} WHERE id = $1`, [ids.rankerProfile]);
    await hide('is_public = false');
    assert.deepEqual(await drinks(users.reader.client), []);
    await hide('is_public = true, moderated_at = now()');
    assert.deepEqual(await drinks(users.reader.client), []);
    await hide('moderated_at = NULL');
    assert.equal((await drinks(users.reader.client)).length, 4);

    assert.ifError((await setSharing(false)).error);
    assert.deepEqual(await drinks(users.reader.client), []);
    assert.deepEqual(await bars(users.reader.client), []);
  });

  test('someone who hasn’t confirmed their age shares nothing', async () => {
    assert.deepEqual(await drinks(users.reader.client, ids.unconfirmedProfile), []);
    await confirmAge(users.unconfirmed.id);
    assert.deepEqual(names(await drinks(users.reader.client, ids.unconfirmedProfile)), [`Classic ${run}`]);
  });

  test('a bar’s profile, or one that doesn’t exist, gives nothing', async () => {
    assert.deepEqual(await drinks(users.reader.client, ids.openBarProfile), []);
    assert.deepEqual(await drinks(users.reader.client, randomUUID()), []);
  });
});
