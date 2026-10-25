// Asking to join a bar's team (find yourself, step 6): someone signed in asks
// a claimed bar's venue to let them in, and its team managers accept them as a
// Bartender or say no (supabase/migrations/20261113300000_venue_join_requests.sql).
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
  throw new Error(`Refusing to run join request tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const bars = [];
const pages = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

/** A venue and its claimed bar page, or (venue false) a bar page nobody has claimed. */
async function bar(key, venue = true) {
  const barId = venue ? (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`${key} ${run}`])).id : null;
  if (barId) bars.push(barId);
  const page = await one("INSERT INTO public.profiles (kind, handle, display_name, is_public, bar_id) VALUES ('bar', $1, $2, true, $3) RETURNING id", [
    `${key}${run}`.toLowerCase(),
    `${key} ${run}`,
    barId,
  ]);
  pages.push(page.id);
  ids[key] = { bar: barId, page: page.id };
}

const member = (who, key) => one('SELECT role_level FROM public.user_bars WHERE user_id = $1 AND bar_id = $2', [users[who].id, ids[key].bar]);
const ask = (who, key) => users[who].client.rpc('request_to_join_venue', { p_bar_profile_id: ids[key].page });

before(async () => {
  await db.connect();
  for (const label of ['ash', 'admin', 'bartender', 'stranger', 'eager']) users[label] = await makeUser(label);
  await bar('Moth');
  await bar('Rye');
  await bar('Unclaimed', false);
  for (let i = 0; i < 5; i++) await bar(`Many${i}`);
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 40), ($3, $2, 30)', [users.admin.id, ids.Moth.bar, users.bartender.id]);
});

after(async () => {
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [pages]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [bars]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('asking to join', () => {
  test('signed out has no execute, and nobody writes the table directly', async () => {
    assert.ok((await anon.rpc('request_to_join_venue', { p_bar_profile_id: ids.Moth.page })).error);
    const direct = await users.stranger.client.from('venue_join_requests').insert({ bar_id: ids.Moth.bar });
    assert.ok(direct.error, 'no direct insert');
    const { data } = await anon.from('venue_join_requests').select('id');
    assert.equal((data ?? []).length, 0);
  });

  test('only a claimed bar with a venue takes requests', async () => {
    const { error } = await ask('ash', 'Unclaimed');
    assert.match(error?.message ?? '', /isn't on Cocktail with a team yet/);
  });

  test('a member cannot ask, and asking twice returns the same request', async () => {
    assert.match((await ask('bartender', 'Moth')).error?.message ?? '', /already on this team/);
    const first = await ask('ash', 'Moth');
    assert.ifError(first.error);
    const again = await ask('ash', 'Moth');
    assert.equal(again.data.id, first.data.id);
    ids.ashAsk = first.data.id;
  });

  test('five waiting at once is the most', async () => {
    for (let i = 0; i < 5; i++) assert.ifError((await ask('eager', `Many${i}`)).error);
    assert.match((await ask('eager', 'Moth')).error?.message ?? '', /five teams already/);
  });
});

describe('who sees and answers', () => {
  test('the asker sees their own; the Admin sees who is asking; others see nothing', async () => {
    const own = await users.ash.client.from('venue_join_requests').select('id');
    assert.deepEqual(own.data.map((r) => r.id), [ids.ashAsk]);
    const list = await users.admin.client.rpc('join_requests', { p_bar_id: ids.Moth.bar });
    assert.ifError(list.error);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].user_id, users.ash.id);
    for (const who of ['bartender', 'stranger']) {
      const rows = await users[who].client.from('venue_join_requests').select('id').eq('bar_id', ids.Moth.bar);
      assert.equal(rows.data.length, 0, `${who} reads none`);
      const rpc = await users[who].client.rpc('join_requests', { p_bar_id: ids.Moth.bar });
      assert.equal(rpc.data.length, 0, `${who} lists none`);
    }
  });

  test('a Bartender and a stranger cannot answer', async () => {
    for (const who of ['bartender', 'stranger', 'ash']) {
      const { error } = await users[who].client.rpc('answer_join_request', { p_id: ids.ashAsk, p_accept: true });
      assert.match(error?.message ?? '', /isn't waiting on you/, who);
    }
    assert.equal(await member('ash', 'Moth'), undefined);
  });

  test('yes makes them a Bartender and clears the request', async () => {
    assert.ifError((await users.admin.client.rpc('answer_join_request', { p_id: ids.ashAsk, p_accept: true })).error);
    assert.equal((await member('ash', 'Moth')).role_level, 30);
    assert.equal(await one('SELECT id FROM public.venue_join_requests WHERE id = $1', [ids.ashAsk]), undefined);
  });

  test('no keeps it declined, and the same person cannot ask again', async () => {
    const asked = await ask('stranger', 'Moth');
    assert.ifError(asked.error);
    assert.ifError((await users.admin.client.rpc('answer_join_request', { p_id: asked.data.id, p_accept: false })).error);
    assert.equal(await member('stranger', 'Moth'), undefined);
    assert.match((await ask('stranger', 'Moth')).error?.message ?? '', /said no last time/);
    const list = await users.admin.client.rpc('join_requests', { p_bar_id: ids.Moth.bar });
    assert.equal(list.data.length, 0, 'declined requests leave the list');
  });

  test('the asker can withdraw a waiting request, but not someone else', async () => {
    const asked = await ask('ash', 'Rye');
    assert.ifError(asked.error);
    await users.stranger.client.rpc('withdraw_join_request', { p_id: asked.data.id });
    assert.ok(await one('SELECT id FROM public.venue_join_requests WHERE id = $1', [asked.data.id]));
    await users.ash.client.rpc('withdraw_join_request', { p_id: asked.data.id });
    assert.equal(await one('SELECT id FROM public.venue_join_requests WHERE id = $1', [asked.data.id]), undefined);
  });
});
