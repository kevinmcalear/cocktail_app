// The handover note (20261206100000_handover_notes.sql): a closer writes
// their own row for a close, a second closer adds theirs, the team reads the
// note and marks it read on their own rows, and nobody writes or reads
// another bar's or another person's. Runs through the real API against the
// local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run handover tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
const CLOSE = '2026-10-30';
const KEY = 'bar_id,close_date,user_id';

async function makeUser(label) {
  const email = `${label}-${run}@handover-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
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

before(async () => {
  for (const label of ['ana', 'theo', 'floor', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Handover bar ${run}` })).id;
  ids.other = (await insert('bars', { name: `Other bar ${run}` })).id;
  await insert('user_bars', { user_id: users.ana.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.theo.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 10 });
  await insert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
});

after(async () => {
  await service.from('bars').delete().in('id', [ids.bar, ids.other]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('handover_notes', () => {
  test('a closer leaves the note as themselves, and a resend is the same row', async () => {
    const row = { bar_id: ids.bar, close_date: CLOSE, user_id: users.ana.id, ran_out: ['Grenadine'], note: 'Quiet after 11.', prep: 'Honey-ginger syrup, one batch', broken: null, written_at: new Date().toISOString(), read_at: new Date().toISOString() };
    const { error } = await users.ana.client.from('handover_notes').upsert(row, { onConflict: KEY });
    assert.equal(error, null);
    const again = await users.ana.client.from('handover_notes').upsert({ ...row, ran_out: ['Grenadine', 'Lemons'] }, { onConflict: KEY });
    assert.equal(again.error, null);
    const { data } = await service.from('handover_notes').select('ran_out').eq('bar_id', ids.bar).eq('user_id', users.ana.id);
    assert.deepEqual(data, [{ ran_out: ['Grenadine', 'Lemons'] }]);
  });

  test('a second closer adds their own row to the same close', async () => {
    const { error } = await users.theo.client.from('handover_notes').upsert({ bar_id: ids.bar, close_date: CLOSE, user_id: users.theo.id, ran_out: [], note: 'Lemons nearly out.', written_at: new Date().toISOString() }, { onConflict: KEY });
    assert.equal(error, null);
  });

  test('the whole team reads the note, floor staff too', async () => {
    const { data, error } = await users.floor.client.from('handover_notes').select('user_id').eq('bar_id', ids.bar).eq('close_date', CLOSE);
    assert.equal(error, null);
    assert.equal(data.length, 2);
  });

  test('marking it read touches only your own row, and keeps what you wrote', async () => {
    const read = { bar_id: ids.bar, close_date: CLOSE, user_id: users.floor.id, read_at: new Date().toISOString() };
    assert.equal((await users.floor.client.from('handover_notes').upsert(read, { onConflict: KEY })).error, null);
    // Theo reads it after writing: his words stay.
    assert.equal((await users.theo.client.from('handover_notes').upsert({ bar_id: ids.bar, close_date: CLOSE, user_id: users.theo.id, read_at: new Date().toISOString() }, { onConflict: KEY })).error, null);
    const { data } = await service.from('handover_notes').select('note, read_at').eq('bar_id', ids.bar).eq('user_id', users.theo.id).single();
    assert.equal(data.note, 'Lemons nearly out.');
    assert.ok(data.read_at);
  });

  test('nobody writes as someone else', async () => {
    const { error } = await users.theo.client.from('handover_notes').insert({ bar_id: ids.bar, close_date: '2026-10-31', user_id: users.ana.id, note: 'Not Ana' });
    assert.ok(error);
    const edit = await users.theo.client.from('handover_notes').update({ note: 'Rewritten' }).eq('user_id', users.ana.id).select();
    assert.equal(edit.error, null);
    assert.equal(edit.data.length, 0, "Theo can't change Ana's row");
    const gone = await users.theo.client.from('handover_notes').delete().eq('user_id', users.ana.id).select();
    assert.equal(gone.data.length, 0, "Theo can't delete Ana's row");
  });

  test("another bar's people can't read or write it", async () => {
    const { data } = await users.stranger.client.from('handover_notes').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(data, []);
    const { error } = await users.stranger.client.from('handover_notes').insert({ bar_id: ids.bar, close_date: CLOSE, user_id: users.stranger.id, note: 'Hi' });
    assert.ok(error);
  });

  test('a row can not move to a bar you do not work at', async () => {
    const moved = await users.ana.client.from('handover_notes').update({ bar_id: ids.other }).eq('user_id', users.ana.id).select();
    assert.ok(moved.error || moved.data.length === 0);
  });

  test('signed out, nothing', async () => {
    const { data } = await anon.from('handover_notes').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(data ?? [], []);
    const { error } = await anon.from('handover_notes').insert({ bar_id: ids.bar, close_date: CLOSE, note: 'Hi' });
    assert.ok(error);
  });
});
