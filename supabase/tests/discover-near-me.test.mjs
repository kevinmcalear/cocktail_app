// Security and behaviour tests for 20260928210000_discover_near_me: adding
// bars, rankings around a point, bar scores and early lists. Runs through the
// real API as real users.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Every fixture is named with a per-run id and removed afterwards. Bars sit on
// made-up coordinates (open sea near 10 N, 20 E, and on the antimeridian) so
// other test files' bars never land in these areas.

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
  throw new Error(`Refusing to run discover tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const extraUserIds = [];

async function makeUser(label, { signIn = true } = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
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

// A bar someone visited, as the app sends it.
const venue = (name, lat, lng, extra = {}) => ({
  p_name: `${name} ${run}`,
  p_address_line: '1 Test Street',
  p_city: `Testville ${run}`,
  p_country_code: 'au',
  p_latitude: lat,
  p_longitude: lng,
  ...extra,
});

// Rank entries straight into the table: these tests check the aggregation;
// the rank_entries policies are covered in venue-platform.test.mjs. Shared
// scores count only people who've confirmed their age (20260930500900).
async function rank(userId, itemId, venueId, sentiment) {
  await db.query(
    `INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await db.query(
    `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key)
     VALUES ($1, $2, $2, $3, $4, 1)`,
    [userId, itemId, venueId, sentiment]
  );
}

before(async () => {
  await db.connect();
  for (const label of ['adder', 'other', 'barAdmin', 'catalogAdmin', 'limited']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);
  ids.bar = (await serviceInsert('bars', { name: `Harbour ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.barAdmin.id, bar_id: ids.bar, role_level: 40 });
  ids.martini = (await serviceInsert('items', { name: `Martini ${run}`, item_type: 'cocktail', created_by: null })).id;
  ids.negroni = (await serviceInsert('items', { name: `Negroni ${run}`, item_type: 'cocktail', created_by: null })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  for (const id of extraUserIds) await service.auth.admin.deleteUser(id);
  await db.query('SELECT private.refresh_rankings()');
  await db.end();
});

describe('adding a bar', () => {
  test('signed-in people add a public, unclaimed bar at the chosen point; signed-out visitors cannot', async () => {
    const { data, error } = await users.adder.client.rpc('add_venue', venue('Harbour Room', 10, 20, { p_postcode: '1234', p_locality: 'Quay' }));
    assert.ifError(error);
    assert.equal(data.kind, 'bar');
    assert.equal(data.is_public, true);
    assert.equal(data.is_claimed, false);
    assert.equal(data.created_by, users.adder.id);
    assert.equal(data.latitude, 10);
    assert.equal(data.longitude, 20);
    assert.match(data.handle, /^harbourroom[a-z0-9]*\.[0-9a-f]{5}$/);
    ids.harbour = data.id;

    const signedOut = await anon.rpc('add_venue', venue('Sneaky', 10.2, 20.2));
    assert.ok(signedOut.error, 'signed-out visitors cannot add bars');
  });

  test('the name, street, city, country and coordinates are required', async () => {
    const client = users.adder.client;
    for (const missing of [
      { p_name: '  ' },
      { p_address_line: '' },
      { p_city: null },
      { p_country_code: 'Australia' },
      { p_latitude: null },
      { p_longitude: 200 },
    ]) {
      const { error } = await client.rpc('add_venue', { ...venue('Incomplete', 10.3, 20.3), ...missing });
      assert.equal(error?.code, '22023', `refused without ${Object.keys(missing)[0]}`);
    }
  });

  test('the same name within 150 m is refused and points at the one already there', async () => {
    const client = users.other.client;
    const dupe = await client.rpc('add_venue', { ...venue('Harbour Room', 10.0004, 20), p_name: `the harbour room! ${run}` });
    assert.equal(dupe.error?.code, '23505');
    assert.equal(dupe.error?.details, ids.harbour);
    // Same name a few km away, or another name next door: both fine.
    const far = await client.rpc('add_venue', venue('Harbour Room', 10.05, 20));
    assert.ifError(far.error);
    const nextDoor = await client.rpc('add_venue', venue('Dock Bar', 10.0004, 20));
    assert.ifError(nextDoor.error);
    ids.farHarbour = far.data.id;
    ids.dock = nextDoor.data.id;
  });

  test('ten a day per person; moderators are not limited', async () => {
    for (let i = 0; i < 10; i++) {
      const { error } = await users.limited.client.rpc('add_venue', venue(`Limit ${i}`, 11 + i / 10, 21));
      assert.ifError(error);
    }
    const eleventh = await users.limited.client.rpc('add_venue', venue('Limit 10', 12.5, 21));
    assert.equal(eleventh.error?.code, '54000');
    // Someone else still can.
    assert.ifError((await users.other.client.rpc('add_venue', venue('Not limited', 12.6, 21))).error);

    await db.query(
      `UPDATE public.profiles SET created_by = $1 WHERE created_by = $2`,
      [users.catalogAdmin.id, users.limited.id]
    );
    assert.ifError((await users.catalogAdmin.client.rpc('add_venue', venue('Moderator adds', 12.7, 21))).error);
  });

  test('nobody but moderators edits or removes a bar someone added, and the direct insert is still moderators only', async () => {
    for (const client of [users.adder.client, users.other.client]) {
      const { data } = await client.from('profiles').update({ display_name: 'Hijacked' }).eq('id', ids.harbour).select('id');
      assert.deepEqual(data ?? [], [], 'no edit');
      const { data: gone } = await client.from('profiles').delete().eq('id', ids.harbour).select('id');
      assert.deepEqual(gone ?? [], [], 'no delete');
    }
    const direct = await users.adder.client.from('profiles').insert({ kind: 'bar', handle: `direct${run}`, display_name: 'Direct' });
    assert.ok(direct.error, 'unclaimed profiles still cannot be inserted directly');

    const hidden = await users.catalogAdmin.client.from('profiles').update({ is_public: false }).eq('id', ids.dock).select('id');
    assert.equal(hidden.data?.length, 1, 'moderators can hide one');
    const removed = await users.catalogAdmin.client.from('profiles').delete().eq('id', ids.dock).select('id');
    assert.equal(removed.data?.length, 1, 'moderators can remove one');
  });

  test('the bar claims a venue someone added, and a moderator approves it', async () => {
    const { data: claim, error } = await users.barAdmin.client.rpc('start_bar_claim', {
      p_profile_id: ids.farHarbour,
      p_method: 'phone',
      p_bar_id: ids.bar,
      p_note: 'Our bar',
    });
    assert.ifError(error);
    const { data: profile, error: approveError } = await users.catalogAdmin.client.rpc('approve_profile_claim', { p_claim_id: claim.id, p_code: claim.code });
    assert.ifError(approveError);
    assert.equal(profile.bar_id, ids.bar);
    // Now the bar edits it, and the person who added it still can't.
    const own = await users.barAdmin.client.from('profiles').update({ bio: 'Harbour views.' }).eq('id', ids.farHarbour).select('id');
    assert.equal(own.data?.length, 1);
    const adder = await users.other.client.from('profiles').update({ bio: 'nope' }).eq('id', ids.farHarbour).select('id');
    assert.deepEqual(adder.data ?? [], []);
  });

  test('signed-out visitors see an added bar but not who added it, and it can be ranked', async () => {
    const { data } = await anon.from('profiles').select('id, is_claimed').eq('id', ids.harbour).single();
    assert.equal(data.is_claimed, false);
    assert.ok((await anon.from('profiles').select('created_by').eq('id', ids.harbour)).error);
    // Ranking needs a confirmed age (20260930500600).
    assert.ifError((await users.other.client.rpc('confirm_age', { p_birth_date: '1990-01-01', p_country_code: 'AU' })).error);
    const { error } = await users.other.client
      .from('rank_entries')
      .insert({ item_id: ids.negroni, ranked_as_item_id: ids.negroni, venue_profile_id: ids.harbour, sentiment: 'fine', rank_key: 1 });
    assert.ifError(error);
    await db.query('DELETE FROM public.rank_entries WHERE user_id = $1', [users.other.id]);
  });
});

describe('near me, bar scores and early lists', () => {
  before(async () => {
    const add = async (name, lat, lng) => (await serviceInsert('profiles', {
      kind: 'bar', handle: `${name.toLowerCase()}${run}`, display_name: `${name} ${run}`, is_public: true,
      city: `Sealand ${run}`, country_code: 'AU', latitude: lat, longitude: lng,
    })).id;
    ids.a = await add('Anchor', 10.2, 20.2);
    ids.b = await add('Buoy', 10.21, 20.2); // about 1.1 km from Anchor
    ids.c = await add('Current', 10.7, 20.2); // about 55 km away
    ids.hidden = await add('Hidden', 10.2, 20.201);
    await db.query('UPDATE public.profiles SET is_public = false WHERE id = $1', [ids.hidden]);
    ids.east = await add('East', -17, 179.99);
    ids.d = await add('Driftwood', 10.205, 20.2); // nobody ranks anything here

    // One martini each, so every personal martini score is 10 and the
    // numbers below stay easy to check.
    const rankers = [];
    for (let i = 0; i < 28; i++) rankers.push((await makeUser(`ranker${i}`, { signIn: false })).id);
    extraUserIds.push(...rankers);
    // Anchor: 20 people loved its martini, 5 of them found its negroni fine.
    for (const id of rankers.slice(0, 20)) await rank(id, ids.martini, ids.a, 'loved');
    for (const id of rankers.slice(0, 5)) await rank(id, ids.negroni, ids.a, 'fine');
    // Buoy and the hidden bar: three people each, so early.
    for (const id of rankers.slice(20, 23)) await rank(id, ids.martini, ids.b, 'loved');
    for (const id of rankers.slice(23, 26)) await rank(id, ids.martini, ids.hidden, 'loved');
    await rank(rankers[26], ids.martini, ids.c, 'loved');
    await rank(rankers[27], ids.martini, ids.east, 'loved');
    await db.query('SELECT private.refresh_rankings()');
  });

  const near = { p_latitude: 10.2, p_longitude: 20.2, p_radius_km: 10 };

  test('best martini near a point: ranked bars with a score, early ones without, nothing private or out of range', async () => {
    const { data, error } = await anon.rpc('discover_drink_rankings', { p_ranked_as_item_id: ids.martini, ...near });
    assert.ifError(error);
    assert.deepEqual(data.map((r) => [r.venue_profile_id, r.position, r.is_early, r.rankers]), [
      [ids.a, 1, false, 20],
      [ids.b, null, true, 3],
    ]);
    assert.equal(Number(data[0].score), 10);
    assert.equal(data[1].score, null, 'early rows carry no score');
    assert.ok(data[1].distance_km > 1 && data[1].distance_km < 1.2, `Buoy is about 1.1 km away, got ${data[1].distance_km}`);

    const wider = await anon.rpc('discover_drink_rankings', { p_ranked_as_item_id: ids.martini, ...near, p_radius_km: 100 });
    assert.deepEqual(wider.data.map((r) => r.venue_profile_id).sort(), [ids.a, ids.b, ids.c].sort());

    const city = await anon.rpc('discover_drink_rankings', { p_ranked_as_item_id: ids.martini, p_city: `sealand ${run}`, p_country_code: 'au' });
    assert.equal(city.data.length, 4);
    assert.ok(city.data.every((r) => r.distance_km === null));
  });

  test('the box works across the antimeridian', async () => {
    const { data } = await anon.rpc('discover_drink_rankings', {
      p_ranked_as_item_id: ids.martini, p_latitude: -17, p_longitude: -179.99, p_radius_km: 5,
    });
    assert.deepEqual(data.map((r) => r.venue_profile_id), [ids.east]);
    assert.ok(data[0].distance_km < 2.2);
  });

  test('a bar score is its drinks\' scores weighted by rankers, once 20 different people have ranked there', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', near);
    assert.ifError(error);
    // A bar nobody has ranked is listed too, last, with no score.
    assert.deepEqual(data.map((r) => [r.venue_profile_id, r.position, r.is_early, r.rankers, r.drinks]), [
      [ids.a, 1, false, 20, 2],
      [ids.b, null, true, 3, 1],
      [ids.d, null, true, 0, 0],
    ]);
    // Martini 10 (20 rankers), negroni 6.6 (5): (200 + 33) / 25 = 9.32.
    assert.equal(Number(data[0].score), 9.3);
    assert.equal(data[1].score, null);

    const score = await anon.rpc('get_venue_score', { p_venue_profile_id: ids.a });
    assert.deepEqual(score.data.map((r) => [Number(r.score), r.rankers, r.drinks, r.is_early]), [[9.3, 20, 2, false]]);
    const early = await anon.rpc('get_venue_score', { p_venue_profile_id: ids.b });
    assert.deepEqual(early.data.map((r) => [r.score, r.rankers, r.is_early]), [[null, 3, true]]);
    const hidden = await anon.rpc('get_venue_score', { p_venue_profile_id: ids.hidden });
    assert.deepEqual(hidden.data, [], 'a private bar has no public score');
  });

  test('signed-out visitors get the aggregates only, never the tables or helpers behind them', async () => {
    assert.ok((await anon.from('rank_entries').select('id').limit(1)).data?.length !== 1);
    assert.ok((await anon.schema('private').from('venue_scores').select('*').limit(1)).error);
    for (const client of [anon, users.other.client]) {
      const { rows } = await db.query(
        `SELECT has_function_privilege($1, 'private.bars_in_area(double precision, double precision, double precision, text, text)', 'EXECUTE') AS area,
                has_table_privilege($1, 'private.venue_scores', 'SELECT') AS scores`,
        [client === anon ? 'anon' : 'authenticated']
      );
      assert.deepEqual(rows[0], { area: false, scores: false });
    }
    const bad = await anon.rpc('discover_top_bars', { p_latitude: 10 });
    assert.ok(bad.error, 'a point needs both coordinates');
  });
});
