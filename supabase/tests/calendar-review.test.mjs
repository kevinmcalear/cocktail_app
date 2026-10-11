// Calendars, part D (20261014100000_calendar_review): imported events wait
// unreviewed for the team; ones that match an event the team added are left
// out of the week as duplicates; each venue keeps its own team-only words,
// which only people who build menus there read and change.
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
  throw new Error(`Refusing to run calendar review tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const tomorrow = new Date(Date.now() + 86400000);
tomorrow.setUTCHours(19, 0, 0, 0);
const at = (hours) => new Date(tomorrow.getTime() + hours * 3600 * 1000).toISOString();

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
  ids.bar = (await serviceInsert('bars', { name: `Reviewbar ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Otherbar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });
  ids.source = (await serviceInsert('calendar_sources', { bar_id: ids.bar, url: `https://calendar.example.com/${run}.ics` })).id;
  ids.manual = (await serviceInsert('events', { bar_id: ids.bar, name: `Pale Moth × Little Rye ${run}`, starts_at: at(0), kind: 'takeover' })).id;
  const imported = (name, uid, extra = {}) =>
    serviceInsert('events', { bar_id: ids.bar, name: `${name} ${run}`, starts_at: at(1), source_id: ids.source, external_uid: `${uid}|${run}`, reviewed_at: null, ...extra });
  ids.dupe = (await imported('Pale Moth x LR', 'dupe', { duplicate_of: ids.manual })).id;
  ids.fresh = (await imported('Agave masterclass', 'fresh')).id;
});

after(async () => {
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`%${run}%`]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

const week = async (client) => {
  const { data, error } = await client.rpc('bar_week', { p_bar_id: ids.bar, p_from: new Date(Date.now() - 3600000).toISOString(), p_days: 7 });
  assert.ifError(error);
  return new Set(data.map((r) => r.id));
};

describe('reviewing what calendars bring in', () => {
  test('events people add are reviewed as they are made; imports wait', async () => {
    const { rows } = await db.query('SELECT id, reviewed_at IS NOT NULL AS reviewed FROM public.events WHERE id = ANY($1)', [[ids.manual, ids.fresh]]);
    const reviewed = Object.fromEntries(rows.map((r) => [r.id, r.reviewed]));
    assert.equal(reviewed[ids.manual], true);
    assert.equal(reviewed[ids.fresh], false);
  });

  test('a duplicate stays out of the week; the event it matches and fresh imports stay in', async () => {
    const got = await week(users.maker.client);
    assert.ok(got.has(ids.manual));
    assert.ok(got.has(ids.fresh));
    assert.ok(!got.has(ids.dupe));
  });

  test('only imported events can be duplicates, and never of themselves', async () => {
    const manualDupe = await service.from('events').update({ duplicate_of: ids.fresh }).eq('id', ids.manual);
    assert.equal(manualDupe.error?.code, '23514');
    const self = await service.from('events').update({ duplicate_of: ids.dupe }).eq('id', ids.dupe);
    assert.equal(self.error?.code, '23514');
  });

  test('the team shares an import and marks it seen; Undo brings a duplicate back', async () => {
    const shared = await users.maker.client.from('events').update({ is_public: true, reviewed_at: new Date().toISOString() }).eq('id', ids.fresh).select('id');
    assert.ifError(shared.error);
    assert.equal(shared.data.length, 1);
    const undo = await users.maker.client.from('events').update({ duplicate_of: null }).eq('id', ids.dupe).select('id');
    assert.ifError(undo.error);
    assert.ok((await week(users.maker.client)).has(ids.dupe));
  });

  test('the floor and other venues cannot review', async () => {
    for (const client of [users.floor.client, users.outsider.client]) {
      const { data } = await client.from('events').update({ reviewed_at: new Date().toISOString() }).eq('id', ids.dupe).select('id');
      assert.deepEqual(data ?? [], []);
    }
  });
});

describe('team-only words', () => {
  test('a Maker keeps their own words, cleaned', async () => {
    const saved = await users.maker.client.from('venue_calendar_settings').upsert({ bar_id: ids.bar, team_words: ['  Line Check', 'staff', 'STAFF', ''] }).select('team_words').single();
    assert.ifError(saved.error);
    assert.deepEqual(saved.data.team_words, ['line check', 'staff']);
  });

  test('the floor, other venues and signed-out visitors cannot read or change them', async () => {
    for (const client of [users.floor.client, users.outsider.client, anon]) {
      const { data } = await client.from('venue_calendar_settings').select('team_words').eq('bar_id', ids.bar);
      assert.deepEqual(data ?? [], []);
    }
    const floor = await users.floor.client.from('venue_calendar_settings').upsert({ bar_id: ids.bar, team_words: ['nothing'] });
    assert.ok(floor.error);
    const outsider = await users.outsider.client.from('venue_calendar_settings').insert({ bar_id: ids.bar, team_words: ['nothing'] });
    assert.ok(outsider.error);
  });

  test('forty words at most, and the row cannot be deleted by people', async () => {
    const many = await users.maker.client.from('venue_calendar_settings').update({ team_words: Array.from({ length: 41 }, (_, i) => `w${i}`) }).eq('bar_id', ids.bar);
    assert.ok(many.error);
    await users.maker.client.from('venue_calendar_settings').delete().eq('bar_id', ids.bar);
    const { rows } = await db.query('SELECT 1 FROM public.venue_calendar_settings WHERE bar_id = $1', [ids.bar]);
    assert.equal(rows.length, 1);
  });
});
