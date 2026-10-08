// People's photos on a drink page
// (supabase/migrations/20261008500100_drink_photos.sql).
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
  throw new Error(`Refusing to run drink photo tests against a non-local API: ${status.API_URL}`);
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

const confirmAge = (userId) =>
  db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'GB', 18, now())", [userId]);

/** An image row the way the app records an upload. */
async function image(client, name) {
  const url = `${status.API_URL}/storage/v1/object/public/drinks/cocktails/${run}/${name}.jpg`;
  const { data, error } = await client.from('images').insert({ url }).select('id').single();
  assert.ifError(error);
  return data.id;
}

const post = (client, row) => client.from('drink_photos').insert(row).select('id').single();
const photos = async (client, itemId = ids.classic) => {
  const { data, error } = await client.rpc('get_drink_photos', { p_item_id: itemId });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['poster', 'reader', 'young', 'staff', 'moderator']) users[label] = await makeUser(label);
  for (const label of ['poster', 'reader', 'staff']) await confirmAge(users[label].id);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  ids.bar = (await serviceInsert('bars', { name: `Photo Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.staff.id, bar_id: ids.bar, role_level: 30 });
  ids.posterProfile = (await serviceInsert('profiles', { kind: 'person', handle: `poster${run}`, display_name: `Poster ${run}`, user_id: users.poster.id, is_public: true })).id;

  ids.classic = (await serviceInsert('items', { item_type: 'cocktail', name: `Photo Classic ${run}` })).id;
  ids.other = (await serviceInsert('items', { item_type: 'cocktail', name: `Other Classic ${run}` })).id;
  ids.venueDrink = (await serviceInsert('items', { item_type: 'cocktail', name: `House Secret ${run}`, bar_id: ids.bar })).id;

  const entry = (client, item_id) =>
    client.from('rank_entries').insert({ item_id, ranked_as_item_id: item_id, sentiment: 'loved', rank_key: 0 }).select('id').single();
  ids.posterEntry = (await entry(users.poster.client, ids.classic)).data.id;
  ids.posterOtherEntry = (await entry(users.poster.client, ids.other)).data.id;
  ids.readerEntry = (await entry(users.reader.client, ids.classic)).data.id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.reports WHERE item_id IN (SELECT id FROM public.items WHERE name LIKE $1)', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('posting a photo', () => {
  test('credited to the poster, with their score when they attach their ranking', async () => {
    const withScore = await post(users.poster.client, { item_id: ids.classic, image_id: await image(users.poster.client, 'scored'), rank_entry_id: ids.posterEntry });
    assert.ifError(withScore.error);
    ids.scored = withScore.data.id;
    const plain = await post(users.poster.client, { item_id: ids.classic, image_id: await image(users.poster.client, 'plain') });
    assert.ifError(plain.error);
    ids.plain = plain.data.id;

    const seen = await photos(users.reader.client);
    assert.deepEqual(seen.map((p) => p.id).sort(), [ids.scored, ids.plain].sort());
    const scored = seen.find((p) => p.id === ids.scored);
    assert.equal(scored.poster_name, `Poster ${run}`);
    assert.equal(scored.poster_handle, `poster${run}`);
    assert.equal(Number(scored.score), 10, 'the only loved drink in their list');
    assert.equal(scored.is_mine, false);
    assert.equal(seen.find((p) => p.id === ids.plain).score, null, 'no ranking attached, no score');
    assert.ok((await photos(users.poster.client)).every((p) => p.is_mine));
  });

  test('a score only comes from your own ranking of this drink', async () => {
    const theirs = await post(users.poster.client, { item_id: ids.classic, image_id: await image(users.poster.client, 'theirs'), rank_entry_id: ids.readerEntry });
    assert.ok(theirs.error, "someone else's ranking is refused");
    const otherDrink = await post(users.poster.client, { item_id: ids.classic, image_id: await image(users.poster.client, 'wrong'), rank_entry_id: ids.posterOtherEntry });
    assert.ok(otherDrink.error, 'a ranking of another drink is refused');
  });

  test('as yourself, age-confirmed, on a drink you can see', async () => {
    const young = await post(users.young.client, { item_id: ids.classic, image_id: await image(users.young.client, 'young') });
    assert.ok(young.error, 'no confirmed age, no photo');
    const asSomeoneElse = await post(users.reader.client, { item_id: ids.classic, user_id: users.poster.id, image_id: await image(users.reader.client, 'forged') });
    assert.ok(asSomeoneElse.error, "can't post as someone else");
    const hidden = await post(users.reader.client, { item_id: ids.venueDrink, image_id: await image(users.reader.client, 'venue') });
    assert.ok(hidden.error, "can't post to a bar's drink you can't see");
    const premoderated = await post(users.reader.client, { item_id: ids.classic, moderated_at: new Date().toISOString(), image_id: await image(users.reader.client, 'pre') });
    assert.ok(premoderated.error);
  });

  test("a bar's private drink: its team sees the photos, nobody else does", async () => {
    const staffPhoto = await post(users.staff.client, { item_id: ids.venueDrink, image_id: await image(users.staff.client, 'staff') });
    assert.ifError(staffPhoto.error);
    assert.equal((await photos(users.staff.client, ids.venueDrink)).length, 1);
    assert.deepEqual(await photos(users.reader.client, ids.venueDrink), []);
  });

  test('signed-out visitors get nothing', async () => {
    assert.ok((await anon.rpc('get_drink_photos', { p_item_id: ids.classic })).error);
    const { data } = await anon.from('drink_photos').select('id');
    assert.deepEqual(data ?? [], []);
  });
});

describe('owning and moderating a photo', () => {
  test("only the poster or a moderator deletes it, and the poster can't hide or restore it", async () => {
    const byReader = await users.reader.client.from('drink_photos').delete().eq('id', ids.plain).select('id');
    assert.deepEqual(byReader.data ?? [], []);
    const hideOwn = await users.poster.client.from('drink_photos').update({ moderated_at: new Date().toISOString() }).eq('id', ids.plain).select('id');
    assert.deepEqual(hideOwn.data ?? [], [], 'no update policy for posters');
    const byPoster = await users.poster.client.from('drink_photos').delete().eq('id', ids.plain).select('id');
    assert.equal(byPoster.data.length, 1);
  });

  test('blocking hides photos both ways', async () => {
    assert.ifError((await users.reader.client.from('user_blocks').insert({ blocked_id: users.poster.id })).error);
    assert.deepEqual(await photos(users.reader.client), []);
    assert.ok((await photos(users.poster.client)).every((p) => p.is_mine), "the blocked person doesn't see the blocker's photos either");
    assert.ifError((await users.reader.client.from('user_blocks').delete().eq('blocked_id', users.poster.id)).error);
  });

  test('reported, queued with its picture, and hidden by a moderator', async () => {
    const report = await users.reader.client.from('reports').insert({ target_kind: 'photo', photo_id: ids.scored, item_id: ids.classic, reason: 'sexual' }).select('id').single();
    assert.ifError(report.error);
    const again = await users.reader.client.from('reports').insert({ target_kind: 'photo', photo_id: ids.scored, item_id: ids.classic, reason: 'spam' });
    assert.equal(again.error?.code, '23505', 'one open report per photo');
    const mismatched = await users.reader.client.from('reports').insert({ target_kind: 'photo', photo_id: ids.scored, item_id: ids.other, reason: 'spam' });
    assert.ok(mismatched.error, 'the photo must be on the drink named');

    const { data: queue, error } = await users.moderator.client.rpc('get_report_queue', { p_open: true, p_limit: 200 });
    assert.ifError(error);
    const queued = queue.find((r) => r.id === report.data.id);
    assert.equal(queued.photo_id, ids.scored);
    assert.match(queued.photo_url, /scored\.jpg$/);
    assert.equal(queued.target_name, `Photo Classic ${run}`);
    assert.equal(queued.target_detail, `Photo by @poster${run}`);

    const resolved = await users.moderator.client.rpc('resolve_report', { p_report_id: report.data.id, p_status: 'actioned', p_resolution: 'Removed.', p_hide: true });
    assert.ifError(resolved.error);
    assert.deepEqual(await photos(users.reader.client), []);
    assert.deepEqual(await photos(users.poster.client), [], 'hidden for its poster too');
    const restore = await users.poster.client.rpc('set_content_hidden', { p_kind: 'photo', p_id: ids.scored, p_hidden: false });
    assert.ok(restore.error, 'only moderators restore');
  });
});
