// The staff link door for someone signed in who isn't on the team (boards
// Miss-door, Miss-door-desk; supabase/migrations/20261206320000_staff_link_door.sql):
// what the door may read, asking through the link, joining straight in when
// nobody approves, link off, and taking an ask back. The door takes the link's
// secret (bar_staff_links.token, 20261206300000): a wrong or replaced one is
// refused like a link that's off, and only the bar's Admins read it.
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
  throw new Error(`Refusing to run staff link door tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const bar = { id: null, slug: `door-${run}`, token: null };

async function makeUser(label, fullName) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: fullName ? { full_name: fullName } : {} });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const settings = (patch) =>
  db.query('UPDATE public.bars SET staff_link_on = $2, staff_link_approve = $3, staff_link_role = $4 WHERE id = $1', [bar.id, patch.on, patch.approve, patch.role]);
const door = async (who, token = bar.token) => (await users[who].client.rpc('staff_link_door', { p_token: token })).data?.[0];
const join = (who, token = bar.token) => users[who].client.rpc('join_by_staff_link', { p_token: token });
const tokenOf = async (id) => (await one('SELECT token FROM public.bar_staff_links WHERE bar_id = $1', [id]))?.token ?? null;
const roleOf = async (who) => (await one('SELECT role_level FROM public.user_bars WHERE user_id = $1 AND bar_id = $2', [users[who].id, bar.id]))?.role_level ?? null;

before(async () => {
  await db.connect();
  users.ana = await makeUser('ana', 'Ana Ruiz');
  users.sam = await makeUser('sam', 'Sam Whitlock');
  users.jo = await makeUser('jo', null);
  users.nope = await makeUser('nope', null);
  users.theo = await makeUser('theo', null);
  users.guess = await makeUser('guess', null);
  bar.id = (await one('INSERT INTO public.bars (name, slug) VALUES ($1, $2) RETURNING id', [`Door ${run}`, bar.slug])).id;
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 40)', [users.ana.id, bar.id]);
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 30)', [users.theo.id, bar.id]);
  bar.token = await tokenOf(bar.id);
});

after(async () => {
  await db.query('DELETE FROM public.bars WHERE id = $1', [bar.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('reading the door', () => {
  test('signed out has no execute', async () => {
    assert.ok((await anon.rpc('staff_link_door', { p_token: bar.token })).error);
    assert.ok((await anon.rpc('join_by_staff_link', { p_token: bar.token })).error);
  });

  test('the slug is not the link: the door reads nothing for it', async () => {
    await settings({ on: true, approve: true, role: 30 });
    assert.equal(await door('sam', bar.slug), undefined);
  });

  test('signed in: the settings, the Admin by first name, and your own name', async () => {
    await settings({ on: true, approve: true, role: 30 });
    const d = await door('sam');
    assert.equal(d.bar_id, bar.id);
    assert.equal(d.join_role, 30);
    assert.equal(d.approve, true);
    assert.equal(d.admin_name, 'Ana');
    assert.equal(d.admin_count, 1);
    assert.equal(d.me, 'Sam Whitlock');
  });

  test('link off: no Admin name', async () => {
    await settings({ on: false, approve: true, role: 30 });
    const d = await door('sam');
    assert.equal(d.link_on, false);
    assert.equal(d.admin_name, null);
  });
});

describe('through the link', () => {
  test('link off refuses', async () => {
    await settings({ on: false, approve: true, role: 30 });
    assert.match((await join('sam')).error?.message ?? '', /link is off/);
    assert.equal(await roleOf('sam'), null);
  });

  test('approval on asks, through the link, and Admins see it; asking again is the same ask', async () => {
    await settings({ on: true, approve: true, role: 20 });
    assert.equal((await join('sam')).data, 'asked');
    assert.equal((await join('sam')).data, 'asked');
    const list = await users.ana.client.rpc('join_requests', { p_bar_id: bar.id });
    assert.deepEqual(list.data.map((r) => [r.user_id, r.via_link]), [[users.sam.id, true]]);
    assert.equal(await roleOf('sam'), null, 'not on the team until an Admin says yes');
  });

  test('taking it back removes only your own waiting ask', async () => {
    await users.jo.client.rpc('take_back_join_request', { p_bar_id: bar.id });
    assert.equal((await users.ana.client.rpc('join_requests', { p_bar_id: bar.id })).data.length, 1, 'someone else can’t take it back');
    assert.ifError((await users.sam.client.rpc('take_back_join_request', { p_bar_id: bar.id })).error);
    assert.equal((await users.ana.client.rpc('join_requests', { p_bar_id: bar.id })).data.length, 0);
  });

  test('approval off joins straight in at the link’s role, and clears a waiting ask', async () => {
    assert.equal((await join('jo')).data, 'asked');
    await settings({ on: true, approve: false, role: 35 });
    assert.equal((await join('jo')).data, 'joined');
    assert.equal(await roleOf('jo'), 35);
    assert.equal((await users.ana.client.rpc('join_requests', { p_bar_id: bar.id })).data.length, 0);
    assert.equal((await join('jo')).data, 'joined', 'already on the team: no error');
  });

  test('a declined ask stays declined, whatever the settings', async () => {
    await settings({ on: true, approve: true, role: 30 });
    await join('nope');
    const ask = (await users.ana.client.rpc('join_requests', { p_bar_id: bar.id })).data.find((r) => r.user_id === users.nope.id);
    assert.ifError((await users.ana.client.rpc('answer_join_request', { p_id: ask.id, p_accept: false })).error);
    await users.nope.client.rpc('take_back_join_request', { p_bar_id: bar.id });
    await settings({ on: true, approve: false, role: 30 });
    assert.match((await join('nope')).error?.message ?? '', /said no last time/);
    assert.equal(await roleOf('nope'), null);
  });

  test('a bar with no Admin takes nobody', async () => {
    const slug = `noteam-${run}`;
    const id = (await one('INSERT INTO public.bars (name, slug) VALUES ($1, $2) RETURNING id', [`No team ${run}`, slug])).id;
    try {
      assert.match((await join('sam', await tokenOf(id))).error?.message ?? '', /no team on Cocktail/);
    } finally {
      await db.query('DELETE FROM public.bars WHERE id = $1', [id]);
    }
  });

  test('the link can never make an Admin', async () => {
    await assert.rejects(settings({ on: true, approve: false, role: 40 }));
  });
});

describe('the secret', () => {
  test('every bar has one: URL-safe, 144 bits', async () => {
    assert.match(bar.token, /^[A-Za-z0-9_-]{24}$/);
  });

  test('anon can’t read tokens', async () => {
    const { data } = await anon.from('bar_staff_links').select('token');
    assert.ok(!data?.length);
  });

  test('a member who isn’t an Admin can’t read tokens, or make a new link', async () => {
    const { data, error } = await users.theo.client.from('bar_staff_links').select('token').eq('bar_id', bar.id);
    assert.ifError(error);
    assert.deepEqual(data, []);
    assert.ok((await users.theo.client.rpc('new_staff_link', { p_bar_id: bar.id })).error);
    assert.equal(await tokenOf(bar.id), bar.token);
  });

  test('the bar’s Admin reads its token', async () => {
    const { data } = await users.ana.client.from('bar_staff_links').select('bar_id, token');
    assert.deepEqual(data, [{ bar_id: bar.id, token: bar.token }]);
  });

  test('a wrong token refuses, as link off, even with approval off', async () => {
    await settings({ on: true, approve: false, role: 30 });
    assert.equal(await door('guess', `${bar.token.slice(0, -1)}x`), undefined);
    assert.equal(await door('guess', bar.slug), undefined);
    assert.match((await join('guess', bar.slug)).error?.message ?? '', /link is off/);
    assert.match((await join('guess', 'x'.repeat(24))).error?.message ?? '', /link is off/);
    assert.equal(await roleOf('guess'), null);
  });

  test('a replaced token refuses; approval off with the new one joins', async () => {
    await settings({ on: true, approve: false, role: 30 });
    const old = bar.token;
    const made = await users.ana.client.rpc('new_staff_link', { p_bar_id: bar.id });
    assert.ifError(made.error);
    bar.token = made.data;
    assert.notEqual(bar.token, old);
    assert.equal(await tokenOf(bar.id), bar.token);
    assert.equal(await door('guess', old), undefined);
    assert.match((await join('guess', old)).error?.message ?? '', /link is off/);
    assert.equal(await roleOf('guess'), null);
    assert.equal((await join('guess')).data, 'joined');
    assert.equal(await roleOf('guess'), 30);
  });
});
