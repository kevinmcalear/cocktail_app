// One had record and one Want list (had-want-one, keep-collection): every
// time someone had a drink is a row in drinks_had, everything they mean to
// get to a row in want_list. Old builds keep writing collected_items,
// made_drinks, rank_entries and loved_bars, and triggers keep both sides in
// step, both ways, without looping. Nobody reads another person's hads or
// wants from the tables; a profile's shown makes come through
// get_profile_made, which applies had_mode and shows_dates. Runs through the
// real API as real users, and signed out.
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL) || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run had and want tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

async function makeUser(label, { aged = true } = {}) {
  const email = `${label}-${run}@had-want-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  if (aged) await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const one = async (sql, args) => (await db.query(sql, args)).rows[0];
const all = async (sql, args) => (await db.query(sql, args)).rows;
// had_on as text: node-pg reads a date as local midnight.
const hadsOf = (userId) => all('SELECT *, had_on::text AS day FROM public.drinks_had WHERE user_id = $1 ORDER BY created_at, id', [userId]);
const wantsOf = (userId) => all('SELECT * FROM public.want_list WHERE user_id = $1 ORDER BY wanted_at, id', [userId]);

/** What an old build's RankSheet sends: an upsert of the whole entry, by id when re-ranking. */
async function rank(client, fields) {
  const { data, error } = await client.from('rank_entries').upsert(fields).select('id').single();
  assert.ifError(error);
  return data.id;
}

/** A shown or unshown make, the way an old build's MadeSheet logs one. */
async function made(client, row) {
  const { data, error } = await client.from('made_drinks').insert(row).select('id').single();
  assert.ifError(error);
  return data.id;
}

const onProfile = async (client, profileId) => {
  const { data, error } = await client.rpc('get_profile_made', { p_profile_id: profileId });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['owner', 'reader', 'blocked', 'newApp']) users[label] = await makeUser(label);
  ids.ownerProfile = (await insert('profiles', { kind: 'person', handle: `hwowner${run}`, display_name: `Owner ${run}`, user_id: users.owner.id, is_public: true })).id;
  await insert('profiles', { kind: 'person', handle: `hwreader${run}`, display_name: `Reader ${run}`, user_id: users.reader.id, is_public: true });
  await insert('user_blocks', { blocker_id: users.owner.id, blocked_id: users.blocked.id });
  ids.barX = (await insert('profiles', { kind: 'bar', handle: `hwbarx${run}`, display_name: `Bar X ${run}`, is_public: true })).id;
  ids.barY = (await insert('profiles', { kind: 'bar', handle: `hwbary${run}`, display_name: `Bar Y ${run}`, is_public: true })).id;
  for (const name of ['negroni', 'martini', 'sour', 'collins']) {
    ids[name] = (await insert('items', { item_type: 'cocktail', name: `HW ${name} ${run}` })).id;
  }
});

after(async () => {
  const like = `%${run}%`;
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  await db.end();
});

describe('backfill', () => {
  test('old rows become hads and wants, once', async () => {
    const legacy = randomUUID();
    await db.query('BEGIN');
    try {
      // Rows as they stood before the migration: written with triggers off.
      await db.query('SET LOCAL session_replication_role = replica');
      await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [legacy, `legacy-${run}@had-want-test.local`]);
      const home = randomUUID();
      const atBar = randomUUID();
      await db.query(
        `INSERT INTO public.rank_entries (id, user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key, had_on) VALUES
           ($1, $3, $4, $4, NULL, 'loved', 1, '2026-07-01'), ($2, $3, $4, $4, $5, 'fine', 2, '2026-07-01')`,
        [home, atBar, legacy, ids.negroni, ids.barX]
      );
      await db.query(
        `INSERT INTO public.made_drinks (user_id, item_id, made_on, rank_entry_id, note, on_profile, compared, swaps) VALUES
           ($1, $2, '2026-07-01', $3, 'At home', true, 'better', '[{"from":"gin","to":"genever"}]'), ($1, $2, '2026-06-01', NULL, NULL, false, NULL, '[]')`,
        [legacy, ids.negroni, home]
      );
      await db.query(
        `INSERT INTO public.collected_items (user_id, item_id, name, bar_name, had_on, note) VALUES
           ($1, $2, 'Remembered name', 'Remembered bar', '2026-05-01', 'Lovely'), ($1, NULL, 'A drink that went', NULL, NULL, NULL)`,
        [legacy, ids.martini]
      );
      await db.query('INSERT INTO public.loved_bars (user_id, profile_id) VALUES ($1, $2), ($1, $3)', [legacy, ids.barX, ids.barY]);
      await db.query('SET LOCAL session_replication_role = origin');

      await db.query('SELECT * FROM private.backfill_had_and_want()');
      const hads = await hadsOf(legacy);
      const makes = hads.filter((h) => h.source === 'made');
      assert.equal(makes.length, 2, 'every make is a had');
      const shown = makes.find((h) => h.on_profile);
      assert.equal(shown.note, 'At home');
      assert.equal(shown.compared, 'better');
      assert.equal(shown.rank_entry_id, home);
      assert.ok(shown.at_home && shown.made_drink_id);
      const ranks = hads.filter((h) => h.source === 'rank');
      assert.deepEqual(ranks.map((h) => h.rank_entry_id), [atBar], 'the home ranking that day is the make; the bar visit is its own had');
      assert.equal(ranks[0].venue_profile_id, ids.barX);
      assert.equal(ranks[0].at_home, false);
      assert.equal(ranks[0].bar_name, `Bar X ${run}`);
      const [memory] = hads.filter((h) => h.source === 'memory');
      assert.equal(`${memory.name}|${memory.bar_name}|${memory.note}`, 'Remembered name|Remembered bar|Lovely', 'a memory as remembered');
      assert.equal(memory.on_profile, false);

      const wants = await wantsOf(legacy);
      assert.equal(wants.filter((w) => w.kind === 'drink').length, 2, 'every kept drink is wanted, one that went by its name');
      assert.ok(wants.some((w) => w.kind === 'drink' && w.item_id === null && w.name === 'A drink that went'));
      assert.deepEqual(wants.filter((w) => w.kind === 'bar').map((w) => w.venue_profile_id), [ids.barY], 'a loved bar been to is not wanted');

      // A second run adds nothing for them (it is also the check run before the drop PR).
      await db.query('SELECT * FROM private.backfill_had_and_want()');
      assert.equal((await hadsOf(legacy)).length, hads.length);
      assert.equal((await wantsOf(legacy)).length, wants.length);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

describe('old builds write the old tables', () => {
  test('a ranking is a had; a re-rank on a new day is another', async () => {
    const { client, id } = users.owner;
    const entry = { item_id: ids.negroni, ranked_as_item_id: ids.negroni, venue_profile_id: ids.barX, sentiment: 'loved', rank_key: 1, had_on: '2026-10-01' };
    ids.barEntry = await rank(client, entry);
    let hads = (await hadsOf(id)).filter((h) => h.rank_entry_id === ids.barEntry);
    assert.equal(hads.length, 1);
    assert.equal(hads[0].source, 'rank');
    assert.equal(hads[0].bar_name, `Bar X ${run}`);
    await rank(client, { ...entry, id: ids.barEntry });
    assert.equal((await hadsOf(id)).filter((h) => h.rank_entry_id === ids.barEntry).length, 1, 'same day: nothing new');
    await rank(client, { ...entry, id: ids.barEntry, had_on: '2026-10-05' });
    hads = (await hadsOf(id)).filter((h) => h.rank_entry_id === ids.barEntry);
    assert.deepEqual(hads.map((h) => h.day).sort(), ['2026-10-01', '2026-10-05']);
  });

  test("MadeSheet's rank-then-log is one had, carrying the make", async () => {
    const { client, id } = users.owner;
    ids.homeEntry = await rank(client, { item_id: ids.negroni, ranked_as_item_id: ids.negroni, venue_profile_id: null, sentiment: 'fine', rank_key: 2, had_on: '2026-10-03' });
    ids.made1 = await made(client, { item_id: ids.negroni, made_on: '2026-10-03', rank_entry_id: ids.homeEntry, note: 'Less smoke', on_profile: true, compared: 'better' });
    const hads = (await hadsOf(id)).filter((h) => h.rank_entry_id === ids.homeEntry);
    assert.equal(hads.length, 1, 'the make took over the ranking’s had');
    assert.equal(hads[0].source, 'made');
    assert.equal(hads[0].made_drink_id, ids.made1);
    assert.equal(hads[0].note, 'Less smoke');
    assert.equal(hads[0].on_profile, true);

    assert.ifError((await client.from('made_drinks').update({ note: 'More smoke' }).eq('id', ids.made1)).error);
    assert.equal((await one('SELECT note FROM public.drinks_had WHERE made_drink_id = $1', [ids.made1])).note, 'More smoke');
  });

  test('deleting a make keeps the had its ranking still dates, and deletes one it does not', async () => {
    const { client, id } = users.owner;
    const loose = await made(client, { item_id: ids.martini, made_on: '2026-09-01' });
    assert.ok(await one('SELECT id FROM public.drinks_had WHERE made_drink_id = $1', [loose]));
    assert.ifError((await client.from('made_drinks').delete().eq('id', loose)).error);
    assert.equal((await hadsOf(id)).filter((h) => h.item_id === ids.martini && h.source === 'made').length, 0, 'a make on its own goes');

    const dated = await made(client, { item_id: ids.negroni, made_on: '2026-10-05', rank_entry_id: ids.barEntry });
    await rank(client, { id: ids.homeEntry, item_id: ids.negroni, ranked_as_item_id: ids.negroni, venue_profile_id: null, sentiment: 'fine', rank_key: 2, had_on: '2026-10-07' });
    const sameDay = await made(client, { item_id: ids.negroni, made_on: '2026-10-07', rank_entry_id: ids.homeEntry });
    assert.ifError((await client.from('made_drinks').delete().in('id', [dated, sameDay])).error);
    assert.deepEqual(
      (await hadsOf(id)).filter((h) => h.rank_entry_id === ids.barEntry).map((h) => `${h.source} ${h.day}`).sort(),
      ['rank 2026-10-01', 'rank 2026-10-05'],
      'a make linked to the bar ranking goes; the visits stay'
    );
    const kept = await one('SELECT * FROM public.drinks_had WHERE rank_entry_id = $1 AND had_on = $2', [ids.homeEntry, '2026-10-07']);
    assert.equal(kept.source, 'rank', 'the ranking keeps its had');
    assert.equal(kept.made_drink_id, null);
  });

  test('a kept drink is a want; its date and note are a memory; removing it removes both', async () => {
    const { client, id } = users.owner;
    const { data, error } = await client.from('collected_items').insert({ item_id: ids.sour }).select('id').single();
    assert.ifError(error);
    ids.col = data.id;
    const want = await one('SELECT * FROM public.want_list WHERE collected_item_id = $1', [ids.col]);
    assert.equal(want.kind, 'drink');
    assert.equal(want.name, `HW sour ${run}`);

    assert.ifError((await client.from('collected_items').update({ had_on: '2026-09-20', note: 'At a wedding' }).eq('id', ids.col)).error);
    const memory = await one('SELECT * FROM public.drinks_had WHERE collected_item_id = $1', [ids.col]);
    assert.equal(memory.source, 'memory');
    assert.equal(memory.note, 'At a wedding');
    assert.ifError((await client.from('collected_items').update({ had_on: null, note: null }).eq('id', ids.col)).error);
    assert.equal(await one('SELECT id FROM public.drinks_had WHERE collected_item_id = $1', [ids.col]), undefined, 'cleared');

    assert.ifError((await client.from('collected_items').update({ note: 'Again' }).eq('id', ids.col)).error);
    assert.ifError((await client.from('collected_items').delete().eq('id', ids.col)).error);
    assert.equal((await wantsOf(id)).filter((w) => w.item_id === ids.sour).length, 0);
    assert.equal((await hadsOf(id)).filter((h) => h.item_id === ids.sour).length, 0, '"Your date and note go with it"');
  });

  test('a loved bar not been to is wanted; been to, hidden or unloved is not', async () => {
    const { client, id } = users.owner;
    assert.ifError((await client.from('loved_bars').upsert([{ profile_id: ids.barX }, { profile_id: ids.barY }], { onConflict: 'user_id,profile_id', ignoreDuplicates: true })).error);
    const bars = async () => (await wantsOf(id)).filter((w) => w.kind === 'bar').map((w) => w.venue_profile_id);
    assert.deepEqual(await bars(), [ids.barY], 'Bar X was ranked there: been');
    // An old build's hide: hidden, then unloved.
    assert.ifError((await client.from('hidden_bars').upsert({ profile_id: ids.barY }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true })).error);
    assert.deepEqual(await bars(), []);
    assert.ifError((await client.from('loved_bars').delete().eq('profile_id', ids.barY)).error);
    // Unhide: loved again, wanted again.
    assert.ifError((await client.from('hidden_bars').delete().eq('profile_id', ids.barY)).error);
    assert.ifError((await client.from('loved_bars').upsert({ profile_id: ids.barY }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true })).error);
    assert.deepEqual(await bars(), [ids.barY]);
    assert.ifError((await client.from('loved_bars').delete().eq('profile_id', ids.barY)).error);
    assert.deepEqual(await bars(), []);
    assert.ifError((await client.from('loved_bars').delete().eq('profile_id', ids.barX)).error);
  });
});

describe('the new app writes the new tables', () => {
  test('a wanted drink is kept in Collection for old builds; removing the want keeps the memory', async () => {
    const { client, id } = users.newApp;
    const { data, error } = await client.from('want_list').insert({ kind: 'drink', item_id: ids.collins }).select('id, collected_item_id, name').single();
    assert.ifError(error);
    const col = await one('SELECT * FROM public.collected_items WHERE user_id = $1 AND item_id = $2', [id, ids.collins]);
    assert.ok(col, 'a Collection row for old builds');
    assert.equal(col.name, `HW collins ${run}`);
    assert.equal(data.name, `HW collins ${run}`);
    const dupe = await client.from('want_list').upsert({ kind: 'drink', item_id: ids.collins }, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
    assert.ifError(dupe.error);
    assert.equal((await wantsOf(id)).length, 1, 'wanting it twice is one want');

    // An old build on the same account adds a memory; the new app edits it.
    assert.ifError((await client.from('collected_items').update({ note: 'From the old build' }).eq('id', col.id)).error);
    const memory = await one('SELECT id FROM public.drinks_had WHERE collected_item_id = $1', [col.id]);
    assert.ifError((await client.from('drinks_had').update({ note: 'Edited in 2.0' }).eq('id', memory.id)).error);
    assert.equal((await one('SELECT note FROM public.collected_items WHERE id = $1', [col.id])).note, 'Edited in 2.0');

    assert.ifError((await client.from('want_list').delete().eq('id', data.id)).error);
    assert.equal(await one('SELECT id FROM public.collected_items WHERE id = $1', [col.id]), undefined, 'the Collection row goes');
    const kept = await one('SELECT * FROM public.drinks_had WHERE id = $1', [memory.id]);
    assert.equal(kept.note, 'Edited in 2.0', 'the memory stays');
    assert.equal(kept.collected_item_id, null);
  });

  test('a bar to go to is loved for old builds with alerts off; a followed bar stays followed', async () => {
    const { client, id } = users.newApp;
    assert.ifError((await client.from('want_list').insert({ kind: 'bar', venue_profile_id: ids.barY })).error);
    assert.equal((await one('SELECT alerts FROM public.loved_bars WHERE user_id = $1 AND profile_id = $2', [id, ids.barY])).alerts, 'none');
    assert.ifError((await client.from('want_list').delete().eq('venue_profile_id', ids.barY)).error);
    assert.equal(await one('SELECT 1 FROM public.loved_bars WHERE user_id = $1 AND profile_id = $2', [id, ids.barY]), undefined);

    assert.ifError((await client.from('loved_bars').insert({ profile_id: ids.barY })).error);
    assert.ifError((await client.from('want_list').delete().eq('venue_profile_id', ids.barY)).error);
    assert.ok(await one('SELECT 1 FROM public.loved_bars WHERE user_id = $1 AND profile_id = $2', [id, ids.barY]), 'followed with alerts: stays');
    assert.ifError((await client.from('loved_bars').delete().eq('profile_id', ids.barY)).error);

    assert.ifError((await client.from('hidden_bars').insert({ profile_id: ids.barX })).error);
    assert.ok((await client.from('want_list').insert({ kind: 'bar', venue_profile_id: ids.barX })).error, 'a hidden bar is not wanted');
    assert.ifError((await client.from('hidden_bars').delete().eq('profile_id', ids.barX)).error);
  });

  test('a make is logged in made_drinks too, folds its ranking’s had for that day, and moves rank had_on on', async () => {
    const { client, id } = users.newApp;
    // Rank it at home first, as old builds do.
    const entry = await rank(client, { item_id: ids.martini, ranked_as_item_id: ids.martini, venue_profile_id: null, sentiment: 'loved', rank_key: 1, had_on: '2026-10-10' });
    const { data, error } = await client
      .from('drinks_had')
      .insert({ item_id: ids.martini, had_on: '2026-10-10', at_home: true, source: 'made', rank_entry_id: entry, note: 'New app', on_profile: true })
      .select('id, name, made_drink_id')
      .single();
    assert.ifError(error);
    assert.equal(data.name, `HW martini ${run}`, 'the name is filled from the drink');
    const had = await one('SELECT * FROM public.drinks_had WHERE id = $1', [data.id]);
    const log = await one('SELECT * FROM public.made_drinks WHERE id = $1', [had.made_drink_id]);
    assert.equal(log.note, 'New app');
    assert.equal(log.on_profile, true);
    assert.equal((await hadsOf(id)).filter((h) => h.rank_entry_id === entry).length, 1, 'one had for that evening');

    assert.ifError((await client.from('drinks_had').update({ note: 'Changed', had_on: '2026-10-12' }).eq('id', data.id)).error);
    assert.equal((await one('SELECT note FROM public.made_drinks WHERE id = $1', [log.id])).note, 'Changed');
    assert.equal((await one("SELECT to_char(had_on, 'YYYY-MM-DD') AS d FROM public.rank_entries WHERE id = $1", [entry])).d, '2026-10-12', 'old builds see the newest day');

    assert.ifError((await client.from('drinks_had').delete().eq('id', data.id)).error);
    assert.equal(await one('SELECT id FROM public.made_drinks WHERE id = $1', [log.id]), undefined);
  });
});

describe('no loops', () => {
  test('each side matches the other, and rewriting rows changes no counts', async () => {
    const { client, id } = users.owner;
    ids.shown = await made(client, { item_id: ids.collins, made_on: '2026-10-15', note: 'Shown', on_profile: true });
    ids.unshown = await made(client, { item_id: ids.collins, made_on: '2026-10-16', note: 'Mine' });
    const { error } = await client.from('collected_items').insert({ item_id: ids.martini });
    assert.ifError(error);

    const counts = async () =>
      one(
        `SELECT (SELECT count(*) FROM public.drinks_had WHERE user_id = $1) AS hads,
                (SELECT count(*) FROM public.want_list WHERE user_id = $1) AS wants,
                (SELECT count(*) FROM public.made_drinks WHERE user_id = $1) AS makes,
                (SELECT count(*) FROM public.collected_items WHERE user_id = $1) AS kept,
                (SELECT count(*) FROM public.made_drinks m WHERE m.user_id = $1
                   AND (SELECT count(*) FROM public.drinks_had h WHERE h.made_drink_id = m.id) <> 1) AS makes_unmatched,
                (SELECT count(*) FROM public.collected_items c WHERE c.user_id = $1
                   AND NOT EXISTS (SELECT 1 FROM public.want_list w WHERE w.collected_item_id = c.id)) AS kept_unmatched`,
        [id]
      );
    const before = await counts();
    assert.equal(Number(before.makes_unmatched), 0, 'every make has its had');
    assert.equal(Number(before.kept_unmatched), 0, 'every kept drink has its want');

    assert.ifError((await client.from('made_drinks').update({ note: 'Shown' }).eq('id', ids.shown)).error);
    assert.ifError((await client.from('drinks_had').update({ note: 'Shown' }).eq('made_drink_id', ids.shown)).error);
    assert.ifError((await client.from('collected_items').update({ had_on: null, note: null }).eq('user_id', id)).error);
    await rank(client, { id: ids.barEntry, item_id: ids.negroni, ranked_as_item_id: ids.negroni, venue_profile_id: ids.barX, sentiment: 'loved', rank_key: 1, had_on: '2026-10-05' });
    assert.deepEqual(await counts(), before);
  });
});

describe('privacy', () => {
  test('the owner reads all of theirs', async () => {
    const { client, id } = users.owner;
    const { data: hads, error } = await client.from('drinks_had').select('id');
    assert.ifError(error);
    assert.equal(hads.length, (await hadsOf(id)).length);
    const { data: wants } = await client.from('want_list').select('id');
    assert.equal(wants.length, (await wantsOf(id)).length);
  });

  test('nobody else reads them from the tables, signed in or out', async () => {
    for (const client of [users.reader.client, users.blocked.client]) {
      for (const table of ['drinks_had', 'want_list', 'made_drinks']) {
        const { data, error } = await client.from(table).select('id').eq('user_id', users.owner.id);
        assert.ifError(error);
        assert.deepEqual(data, [], `${table} is the owner's own`);
      }
    }
    for (const table of ['drinks_had', 'want_list', 'made_drinks']) {
      const { data, error } = await anon.from(table).select('id').limit(1);
      assert.ok(error || data.length === 0, `anon reads no ${table}`);
      assert.ok(error, `anon has no grant on ${table}`);
    }
  });

  test('get_profile_made shows shown makes only, with the day only when they show dates', async () => {
    const shown = await one('SELECT id FROM public.drinks_had WHERE made_drink_id = $1', [ids.shown]);
    for (const client of [users.reader.client, anon]) {
      const rows = await onProfile(client, ids.ownerProfile);
      assert.ok(rows.some((r) => r.id === ids.shown && r.had_id === shown.id), 'id stays the make’s, had_id the new row’s');
      assert.ok(!rows.some((r) => r.id === ids.unshown), 'an unshown make stays private');
      assert.ok(rows.every((r) => r.made_on === null), 'no day unless they show dates');
      assert.ok(rows.every((r) => !('user_id' in r)));
    }
    await db.query('UPDATE public.profiles SET shows_dates = true WHERE id = $1', [ids.ownerProfile]);
    assert.ok((await onProfile(users.reader.client, ids.ownerProfile)).every((r) => r.made_on !== null));
    await db.query('UPDATE public.profiles SET shows_dates = false WHERE id = $1', [ids.ownerProfile]);
  });

  test('had_mode none, a private profile or a block hides them all', async () => {
    await db.query("UPDATE public.profiles SET had_mode = 'none' WHERE id = $1", [ids.ownerProfile]);
    assert.deepEqual(await onProfile(users.reader.client, ids.ownerProfile), []);
    assert.deepEqual(await onProfile(anon, ids.ownerProfile), []);
    await db.query("UPDATE public.profiles SET had_mode = 'picked', is_public = false WHERE id = $1", [ids.ownerProfile]);
    assert.deepEqual(await onProfile(users.reader.client, ids.ownerProfile), []);
    await db.query('UPDATE public.profiles SET is_public = true WHERE id = $1', [ids.ownerProfile]);
    assert.deepEqual(await onProfile(users.blocked.client, ids.ownerProfile), [], 'nobody on either side of a block');
    assert.ok((await onProfile(users.reader.client, ids.ownerProfile)).length > 0);
  });

  test('only a make can be shown', async () => {
    const { client } = users.owner;
    const memory = await client.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: false, source: 'memory', on_profile: true });
    assert.ok(memory.error);
    const ranked = await one("SELECT id FROM public.drinks_had WHERE user_id = $1 AND source = 'rank' LIMIT 1", [users.owner.id]);
    assert.ok((await client.from('drinks_had').update({ on_profile: true }).eq('id', ranked.id)).error);
  });
});

describe("nobody writes another's rows", () => {
  test('updates and deletes by someone else change nothing', async () => {
    const before = await hadsOf(users.owner.id);
    const wantsBefore = await wantsOf(users.owner.id);
    const { client } = users.reader;
    const edit = await client.from('drinks_had').update({ note: 'mine now' }).eq('user_id', users.owner.id).select('id');
    assert.ifError(edit.error);
    assert.deepEqual(edit.data, []);
    assert.ifError((await client.from('drinks_had').delete().eq('user_id', users.owner.id)).error);
    assert.ifError((await client.from('want_list').delete().eq('user_id', users.owner.id)).error);
    assert.deepEqual(await hadsOf(users.owner.id), before);
    assert.deepEqual(await wantsOf(users.owner.id), wantsBefore);
  });

  test("nobody saves a row as someone else, a ranking's had directly, or the copy links", async () => {
    const { client } = users.reader;
    assert.ok((await client.from('drinks_had').insert({ user_id: users.owner.id, item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'made' })).error);
    assert.ok((await client.from('want_list').insert({ user_id: users.owner.id, kind: 'drink', item_id: ids.negroni })).error);
    assert.ok((await client.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'rank' })).error);
    assert.ok((await client.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'made', made_drink_id: randomUUID() })).error);
    const theirs = await one('SELECT id FROM public.rank_entries WHERE user_id = $1 LIMIT 1', [users.owner.id]);
    assert.ok((await client.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'made', rank_entry_id: theirs.id })).error, "not with someone else's ranking");
    assert.ok((await anon.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'made' })).error);
    assert.ok((await anon.from('want_list').insert({ kind: 'drink', item_id: ids.negroni })).error);
  });

  test('someone without the age check saves nothing', async () => {
    users.minor = await makeUser('minor', { aged: false });
    assert.ok((await users.minor.client.from('drinks_had').insert({ item_id: ids.negroni, had_on: '2026-10-01', at_home: true, source: 'made' })).error);
    assert.ok((await users.minor.client.from('want_list').insert({ kind: 'drink', item_id: ids.negroni })).error);
  });
});
