// Calendar links (20261012610000_calendar_sources): members who build menus
// add and remove a venue's calendar links and choose how new events start;
// only the sync says when a calendar was read and which events came from it;
// five calendars a venue; removing one removes its events.
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run calendar source tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const feed = (n) => `https://calendar.example.com/${run}/${n}.ics`;

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Calbar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
});

after(async () => {
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`%${run}%`]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('calendar links', () => {
  test('a Maker adds one; the floor, other venues and signed-out visitors cannot add or see it', async () => {
    const made = await users.maker.client.from('calendar_sources').insert({ bar_id: ids.bar, url: feed(1), starts_public: true }).select('id').single();
    assert.ifError(made.error);
    ids.source = made.data.id;

    const floor = await users.floor.client.from('calendar_sources').insert({ bar_id: ids.bar, url: feed(2) });
    assert.ok(floor.error);
    for (const client of [users.floor.client, users.outsider.client, anon]) {
      const { data } = await client.from('calendar_sources').select('id').eq('bar_id', ids.bar);
      assert.deepEqual(data ?? [], []);
    }
  });

  test('links are https, and only the sync writes when it last read one', async () => {
    const http = await users.maker.client.from('calendar_sources').insert({ bar_id: ids.bar, url: 'http://example.com/a.ics' });
    assert.ok(http.error);
    const stamp = await users.maker.client.from('calendar_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ids.source);
    assert.ok(stamp.error, 'last_synced_at is the sync’s');
    const choice = await users.maker.client.from('calendar_sources').update({ starts_public: false, skipped_uids: ['x|2026'] }).eq('id', ids.source);
    assert.ifError(choice.error);
  });

  test('five calendars a venue', async () => {
    for (let n = 2; n <= 5; n++) {
      const { error } = await users.maker.client.from('calendar_sources').insert({ bar_id: ids.bar, url: feed(n) });
      assert.ifError(error);
    }
    const sixth = await users.maker.client.from('calendar_sources').insert({ bar_id: ids.bar, url: feed(6) });
    assert.match(sixth.error?.message ?? '', /up to five calendars/);
  });

  test('people cannot claim an event came from a calendar', async () => {
    const forged = await users.maker.client
      .from('events')
      .insert({ bar_id: ids.bar, name: `Forged ${run}`, starts_at: new Date().toISOString(), source_id: ids.source, external_uid: 'x' });
    assert.ok(forged.error);
  });

  test('the sync’s events can be edited by the team, and go when the calendar is removed', async () => {
    const imported = await serviceInsert('events', {
      bar_id: ids.bar,
      name: `Imported ${run}`,
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      source_id: ids.source,
      external_uid: `uid-${run}|2026-10-11T19:00:00.000Z`,
    });
    const edit = await users.maker.client.from('events').update({ is_public: true, kind: 'takeover' }).eq('id', imported.id).select('id');
    assert.ifError(edit.error);
    assert.equal(edit.data.length, 1);
    const dupe = await service.from('events').insert({ bar_id: ids.bar, name: `Dupe ${run}`, starts_at: new Date().toISOString(), source_id: ids.source, external_uid: imported.external_uid });
    assert.equal(dupe.error?.code, '23505');

    const gone = await users.maker.client.from('calendar_sources').delete().eq('id', ids.source);
    assert.ifError(gone.error);
    const { rows } = await db.query('SELECT 1 FROM public.events WHERE id = $1', [imported.id]);
    assert.equal(rows.length, 0);
  });

  test('the cron tick is not something people can call', async () => {
    const { error } = await users.maker.client.schema('private').rpc('wake_calendar_sync');
    assert.ok(error);
  });
});
