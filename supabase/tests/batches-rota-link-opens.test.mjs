// Batches, the rota and link opens (20261205500000_batches_rota_link_opens.sql):
// a bartender logs their own batches and reads the bar's; an employee reads
// but can't log; strangers see nothing; the rota is read by the bar and
// written by people with Staff, for people who work there; a shared link's
// opens are counted for the bar's own menu people, never written directly.
// Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run batch and rota tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
const HOUR = 3600000;
const at = (ms) => new Date(Date.now() + ms).toISOString();

async function makeUser(label) {
  const email = `${label}-${run}@batch-test.local`;
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
  for (const label of ['admin', 'bartender', 'employee', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Batch bar ${run}` })).id;
  ids.other = (await insert('bars', { name: `Other bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.employee.id, bar_id: ids.bar, role_level: 20 });
  await insert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
  ids.syrup = (await insert('items', { name: `Grenadine ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
});

after(async () => {
  await service.from('bars').delete().in('id', [ids.bar, ids.other]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('batch_logs', () => {
  test('a bartender logs a batch as themselves, with an id made on the phone', async () => {
    const id = randomUUID();
    const row = { id, bar_id: ids.bar, item_id: ids.syrup, amount: 750, unit: 'ml', made_by: users.bartender.id };
    const { error } = await users.bartender.client.from('batch_logs').insert(row);
    assert.equal(error, null);
    // Sent again (a retry after no signal): the same row, no double.
    const again = await users.bartender.client.from('batch_logs').upsert(row);
    assert.equal(again.error, null);
    const { count } = await service.from('batch_logs').select('id', { count: 'exact', head: true }).eq('id', id);
    assert.equal(count, 1);
  });

  test('nobody logs a batch as someone else', async () => {
    const { error } = await users.bartender.client.from('batch_logs').insert({ bar_id: ids.bar, item_id: ids.syrup, amount: 1, unit: 'L', made_by: users.admin.id });
    assert.ok(error);
  });

  test('an employee reads the bar’s batches but cannot log one', async () => {
    const read = await users.employee.client.from('batch_logs').select('id').eq('bar_id', ids.bar);
    assert.ok((read.data ?? []).length >= 1);
    const { error } = await users.employee.client.from('batch_logs').insert({ bar_id: ids.bar, item_id: ids.syrup, amount: 1, unit: 'L', made_by: users.employee.id });
    assert.ok(error);
  });

  test('another bar and signed-out readers see nothing', async () => {
    assert.equal((await users.stranger.client.from('batch_logs').select('id').eq('bar_id', ids.bar)).data?.length ?? 0, 0);
    assert.equal((await anon.from('batch_logs').select('id').eq('bar_id', ids.bar)).data?.length ?? 0, 0);
  });
});

describe('shifts', () => {
  test('an admin puts a bartender on the rota; the bar reads it', async () => {
    const { error } = await users.admin.client
      .from('shifts')
      .insert({ bar_id: ids.bar, user_id: users.bartender.id, starts_at: at(HOUR), ends_at: at(9 * HOUR), opens: true });
    assert.equal(error, null);
    for (const u of [users.bartender, users.employee]) {
      assert.equal((await u.client.from('shifts').select('id').eq('bar_id', ids.bar)).data?.length, 1);
    }
  });

  test('a bartender cannot write the rota', async () => {
    const { error } = await users.bartender.client
      .from('shifts')
      .insert({ bar_id: ids.bar, user_id: users.bartender.id, starts_at: at(HOUR), ends_at: at(2 * HOUR) });
    assert.ok(error);
  });

  test('only people who work there go on its rota', async () => {
    const { error } = await users.admin.client
      .from('shifts')
      .insert({ bar_id: ids.bar, user_id: users.stranger.id, starts_at: at(HOUR), ends_at: at(2 * HOUR) });
    assert.ok(error);
  });

  test('another bar and signed-out readers see nothing', async () => {
    assert.equal((await users.stranger.client.from('shifts').select('id').eq('bar_id', ids.bar)).data?.length ?? 0, 0);
    assert.equal((await anon.from('shifts').select('id').eq('bar_id', ids.bar)).data?.length ?? 0, 0);
  });
});

describe('share opens', () => {
  test('a private drink’s open is ignored; the table takes no direct writes', async () => {
    const { error } = await anon.rpc('record_share_open', { p_kind: 'd', p_key: ids.syrup });
    assert.equal(error, null);
    const since = at(-HOUR);
    const { data } = await users.admin.client.rpc('bar_share_opens', { p_bar: ids.bar, p_since: since });
    assert.equal(data, 0);
    const direct = await anon.schema('private').from('share_opens').insert({ kind: 'd', target_id: ids.syrup });
    assert.ok(direct.error);
  });

  test('the count is for the bar’s menu people only', async () => {
    const since = at(-HOUR);
    assert.equal((await users.admin.client.rpc('bar_share_opens', { p_bar: ids.bar, p_since: since })).data, 0);
    assert.equal((await users.bartender.client.rpc('bar_share_opens', { p_bar: ids.bar, p_since: since })).data, null);
    assert.equal((await users.stranger.client.rpc('bar_share_opens', { p_bar: ids.bar, p_since: since })).data, null);
  });
});
