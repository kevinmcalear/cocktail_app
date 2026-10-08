// Daily limits on rankings, ranking comparisons and picture uploads
// (supabase/migrations/20261010110000_daily_limits_rankings_uploads.sql).
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
  throw new Error(`Refusing to run daily limit tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const uploaded = { drinks: [], avatars: [] };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
  return { id: data.user.id, client };
}

/** Today's events of a kind, as if they had already happened. */
const prefill = (kind, userId, count) =>
  db.query('INSERT INTO private.rate_events (kind, user_id) SELECT $1, $2 FROM generate_series(1, $3)', [kind, userId, count]);

/** Today's uploads to a bucket, as if they had already happened (rows only, no files). */
const prefillUploads = (bucket, folder, userId, count) =>
  db.query(
    `INSERT INTO storage.objects (bucket_id, name, owner_id)
     SELECT $1, $2 || '/prefill-' || n || '.png', $3 FROM generate_series(1, $4) n`,
    [bucket, folder, userId, count]
  );

const rank = (who, itemId, extra = {}) =>
  users[who].client.from('rank_entries').upsert({ item_id: itemId, ranked_as_item_id: itemId, sentiment: 'loved', rank_key: 0, ...extra }).select('id').single();

before(async () => {
  await db.connect();
  for (const label of ['ranker', 'fresh', 'uploader', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);
  const drink = async (name) =>
    (await db.query("INSERT INTO public.items (item_type, name) VALUES ('cocktail', $1) RETURNING id", [`${name} ${run}`])).rows[0].id;
  ids.a = await drink('Limit Sour');
  ids.b = await drink('Limit Fizz');
  ids.c = await drink('Limit Flip');
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  if (uploaded.drinks.length) await service.storage.from('drinks').remove(uploaded.drinks);
  if (uploaded.avatars.length) await service.storage.from('avatars').remove(uploaded.avatars);
  await db.query('BEGIN');
  await db.query("SET LOCAL storage.allow_delete_query = 'true'");
  await db.query("DELETE FROM storage.objects WHERE name LIKE '%/prefill-%' AND owner_id = ANY($1)", [Object.values(users).map((u) => u.id)]);
  await db.query('COMMIT');
  await db.query('DELETE FROM private.rate_events WHERE user_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.catalogAdmin?.id]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('rankings', () => {
  test('each new ranking is counted, and moving one already ranked is not', async () => {
    const first = await rank('fresh', ids.a);
    assert.ifError(first.error);
    const moved = await rank('fresh', ids.a, { id: first.data.id, rank_key: 1 });
    assert.ifError(moved.error);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM private.rate_events WHERE kind = 'rank' AND user_id = $1", [users.fresh.id]);
    assert.equal(rows[0].n, 1);
  });

  test('300 new rankings a day, then a message; moving an old one still works', async () => {
    const kept = await rank('ranker', ids.b);
    assert.ifError(kept.error);
    await prefill('rank', users.ranker.id, 299);
    const over = await rank('ranker', ids.c);
    assert.equal(over.error?.code, 'P0001');
    assert.match(over.error.message, /ranked 300 drinks today/);
    const moved = await rank('ranker', ids.b, { id: kept.data.id, rank_key: 2 });
    assert.ifError(moved.error);
  });

  test('deleting a ranking does not hand the allowance back', async () => {
    const { data } = await users.ranker.client.from('rank_entries').select('id').eq('item_id', ids.b).single();
    await users.ranker.client.from('rank_entries').delete().eq('id', data.id);
    const again = await rank('ranker', ids.b);
    assert.equal(again.error?.code, 'P0001');
  });

  test('3,000 comparisons a day', async () => {
    // Comparisons are between two entries on the same list.
    const one = await rank('fresh', ids.b, { ranked_as_item_id: ids.a });
    assert.ifError(one.error);
    const { data: entries } = await users.fresh.client.from('rank_entries').select('id, item_id').in('item_id', [ids.a, ids.b]);
    const [w, l] = [entries.find((e) => e.item_id === ids.a).id, entries.find((e) => e.item_id === ids.b).id];
    const ok = await users.fresh.client.from('rank_comparisons').insert({ winner_entry_id: w, loser_entry_id: l });
    assert.ifError(ok.error);
    await prefill('rank_comparison', users.fresh.id, 2999);
    const over = await users.fresh.client.from('rank_comparisons').insert({ winner_entry_id: w, loser_entry_id: l });
    assert.equal(over.error?.code, 'P0001');
  });
});

describe('uploads', () => {
  test('300 pictures a day to the drinks bucket', async () => {
    const folder = `cocktails/limits-${run}`;
    const path = `${folder}/first.png`;
    const first = await users.uploader.client.storage.from('drinks').upload(path, png, { contentType: 'image/png', upsert: false });
    assert.ifError(first.error);
    uploaded.drinks.push(path);
    await prefillUploads('drinks', folder, users.uploader.id, 299);
    const over = await users.uploader.client.storage.from('drinks').upload(`${folder}/over.png`, png, { contentType: 'image/png', upsert: false });
    assert.ok(over.error, 'the 301st upload is refused');
  });

  test('catalog admins are not limited', async () => {
    const folder = `cocktails/limits-admin-${run}`;
    await prefillUploads('drinks', folder, users.catalogAdmin.id, 300);
    const path = `${folder}/more.png`;
    const { error } = await users.catalogAdmin.client.storage.from('drinks').upload(path, png, { contentType: 'image/png', upsert: false });
    assert.ifError(error);
    uploaded.drinks.push(path);
  });

  test('30 avatar uploads a day', async () => {
    const folder = users.uploader.id;
    const path = `${folder}/me.png`;
    const first = await users.uploader.client.storage.from('avatars').upload(path, png, { contentType: 'image/png', upsert: true });
    assert.ifError(first.error);
    uploaded.avatars.push(path);
    await prefillUploads('avatars', folder, users.uploader.id, 29);
    const over = await users.uploader.client.storage.from('avatars').upload(`${folder}/again.png`, png, { contentType: 'image/png', upsert: false });
    assert.ok(over.error, 'the 31st upload is refused');
  });
});
