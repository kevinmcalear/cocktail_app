// Notes sent from inside the app (supabase/migrations/20261101300000_feedback_notes.sql):
// "Doing something different? Tell us" and Report a problem. The sender writes
// their own and reads only their own; the Cocktail team (app admins) reads
// them all; nobody else, not the bar's team, not a signed-out visitor. Notes
// can't be changed, deleted, backdated or given a status from the app, are
// held to 2,000 characters and 20 a day. Runs through the real API against
// the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run feedback tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@feedback-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const note = (extra = {}) => ({
  kind: 'different',
  screen: 'Adding a drink › Ice',
  route: '/add-drink',
  subject: 'Ash Garden',
  body: 'We cut graduated blocks that stack in a column to fit the glass.',
  device: 'App 1.5.0 on ios 26.1',
  ...extra,
});

const bodies = async (client) => {
  const { data, error } = await client.from('feedback').select('user_id, body').like('body', `%${run}%`);
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['sender', 'teammate', 'stranger', 'admin']) users[label] = await makeUser(label);
  const { data: bar, error } = await service.from('bars').insert({ name: `Feedback bar ${run}` }).select('id').single();
  if (error) throw error;
  ids.bar = bar.id;
  const { data: other } = await service.from('bars').insert({ name: `Other bar ${run}` }).select('id').single();
  ids.otherBar = other.id;
  for (const label of ['sender', 'teammate']) {
    const { error: e } = await service.from('user_bars').insert({ user_id: users[label].id, bar_id: ids.bar, role_level: 40 });
    if (e) throw e;
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
});

after(async () => {
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin.id]);
  await db.end();
  await service.from('bars').delete().in('id', [ids.bar, ids.otherBar]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

test('a signed-in person sends a note from their bar; only they and the Cocktail team read it', async () => {
  const { error } = await users.sender.client.from('feedback').insert(note({ bar_id: ids.bar, body: `Stacked column ${run}` }));
  assert.ifError(error);
  const { error: problem } = await users.sender.client.from('feedback').insert(note({ kind: 'broken', screen: 'Settings › Report a problem', subject: null, body: `` }));
  assert.ifError(problem, 'a problem report may have no words');

  const mine = await bodies(users.sender.client);
  assert.deepEqual(mine, [{ user_id: users.sender.id, body: `Stacked column ${run}` }]);
  const { data: row } = await users.sender.client.from('feedback').select('status, bar_id, screen, created_at').like('body', `%${run}%`).single();
  assert.equal(row.status, 'new');
  assert.equal(row.bar_id, ids.bar);

  assert.deepEqual(await bodies(users.teammate.client), [], 'the bar’s own team does not read it');
  assert.deepEqual(await bodies(users.stranger.client), [], 'nor does anyone else');
  const { data, error: anonError } = await anon.from('feedback').select('body');
  assert.ok(anonError || data.length === 0, 'nor a signed-out visitor');
  assert.deepEqual(await bodies(users.admin.client), [{ user_id: users.sender.id, body: `Stacked column ${run}` }], 'the Cocktail team reads it');
});

test('a note is only ever your own, new and now, at a bar you belong to', async () => {
  const c = users.stranger.client;
  const refused = async (row, why) => {
    const { error } = await c.from('feedback').insert(row);
    assert.ok(error, why);
  };
  await refused(note({ user_id: users.sender.id, body: `as someone else ${run}` }), 'not as someone else');
  await refused(note({ bar_id: ids.bar, body: `at a bar I'm not in ${run}` }), 'not at a bar they do not belong to');
  await refused(note({ status: 'added', body: `already added ${run}` }), 'not with a status of its own');
  await refused(note({ created_at: '2020-01-01T00:00:00Z', body: `backdated ${run}` }), 'not backdated past the daily limit');
  await refused(note({ kind: 'nonsense', body: `odd kind ${run}` }), 'only the known kinds');
  await refused(note({ body: '   ' }), 'a new method needs words');
  await refused(note({ body: 'x'.repeat(2001) }), 'at most 2,000 characters');
  await refused(note({ screen: 'x'.repeat(201) }), 'a short screen name');
  const { error: e } = await anon.from('feedback').insert(note({ body: `signed out ${run}` }));
  assert.ok(e, 'not signed out');
  assert.deepEqual(await bodies(users.admin.client).then((r) => r.filter((x) => x.user_id === users.stranger.id)), [], 'none of them landed');
});

test('the sender cannot change or delete a note once sent', async () => {
  const c = users.sender.client;
  const { data: before } = await c.from('feedback').select('id').like('body', `Stacked column ${run}`).single();
  await c.from('feedback').update({ body: `changed ${run}`, status: 'added' }).eq('id', before.id);
  await c.from('feedback').delete().eq('id', before.id);
  const { rows } = await db.query('SELECT body, status FROM public.feedback WHERE id = $1', [before.id]);
  assert.deepEqual(rows, [{ body: `Stacked column ${run}`, status: 'new' }]);
});

test('twenty notes a day, then it says no', async () => {
  const c = users.teammate.client;
  for (let i = 0; i < 20; i++) {
    const { error } = await c.from('feedback').insert(note({ body: `note ${i} ${run}` }));
    assert.ifError(error);
  }
  const { error } = await c.from('feedback').insert(note({ body: `one too many ${run}` }));
  assert.equal(error?.code, '42501');
  const { rows } = await db.query('SELECT count(*)::int AS n FROM public.feedback WHERE user_id = $1', [users.teammate.id]);
  assert.equal(rows[0].n, 20);
});

test('a note goes with the account', async () => {
  const gone = await makeUser('gone');
  const { error } = await gone.client.from('feedback').insert(note({ body: `leaving ${run}` }));
  assert.ifError(error);
  await service.auth.admin.deleteUser(gone.id);
  const { rows } = await db.query('SELECT count(*)::int AS n FROM public.feedback WHERE user_id = $1', [gone.id]);
  assert.equal(rows[0].n, 0);
});
