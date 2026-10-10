// This week (20261012600000_this_week): a bar's team sees its whole week;
// guests and signed-out visitors see only public events, published menus and
// published drinks, and only at a bar with a public page; at home the week is
// the bars someone loves plus their own dated home menus. Public event text
// goes through the content filter.
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
  throw new Error(`Refusing to run this week tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const at = (days, hours = 19) => new Date(today.getTime() + days * DAY + hours * 60 * 60 * 1000).toISOString();
const dateIn = (days) => new Date(today.getTime() + days * DAY).toISOString().slice(0, 10);

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

const week = async (client, barId) => {
  const { data, error } = await client.rpc('bar_week', { p_bar_id: barId, p_from: today.toISOString(), p_days: 7 });
  assert.ifError(error);
  return new Set(data.map((r) => r.id));
};

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'guest', 'lover']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Weekbar ${run}` })).id;
  ids.hiddenBar = (await serviceInsert('bars', { name: `Hiddenweek ${run}` })).id;
  ids.barPage = (await serviceInsert('profiles', { kind: 'bar', handle: `week.${run}`, display_name: `Weekbar ${run}`, is_public: true, bar_id: ids.bar })).id;
  ids.hiddenPage = (await serviceInsert('profiles', { kind: 'bar', handle: `hiddenweek.${run}`, display_name: `Hiddenweek ${run}`, is_public: false, bar_id: ids.hiddenBar })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('loved_bars', { user_id: users.lover.id, profile_id: ids.barPage });
  await serviceInsert('loved_bars', { user_id: users.lover.id, profile_id: ids.hiddenPage });

  const event = (bar_id, name, starts_at, extra = {}) => serviceInsert('events', { bar_id, name: `${name} ${run}`, starts_at, ...extra });
  ids.takeover = (await event(ids.bar, 'Takeover', at(1), { kind: 'takeover', is_public: true, guest_name: 'Mara Q.', ticket_url: 'https://example.com/t' })).id;
  ids.staffTasting = (await event(ids.bar, 'Staff tasting', at(2), { kind: 'tasting' })).id;
  ids.lastNight = (await event(ids.bar, 'Late one', at(-1, 22), { kind: 'other', is_public: true, ends_at: at(0, 2) })).id;
  ids.nextMonth = (await event(ids.bar, 'Next month', at(30), { kind: 'launch', is_public: true })).id;
  ids.hiddenEvent = (await event(ids.hiddenBar, 'Hidden party', at(1), { kind: 'takeover', is_public: true })).id;

  ids.publishedMenu = (await serviceInsert('menus', { name: `Winter ${run}`, bar_id: ids.bar, starts_at: at(3, 17), publish_mode: 'description' })).id;
  ids.draftMenu = (await serviceInsert('menus', { name: `Secret menu ${run}`, bar_id: ids.bar, starts_at: at(4, 17) })).id;
  ids.homeMenu = (await serviceInsert('menus', { name: `Saturday supper ${run}`, created_by: users.lover.id, menu_date: dateIn(2), guest_count: 6 })).id;
  ids.otherHomeMenu = (await serviceInsert('menus', { name: `Not mine ${run}`, created_by: users.guest.id, menu_date: dateIn(2) })).id;

  ids.publicDrink = (await serviceInsert('items', { name: `Moth Spritz ${run}`, item_type: 'cocktail', bar_id: ids.bar, publish_mode: 'description' })).id;
  ids.privateDrink = (await serviceInsert('items', { name: `Quiet Hours ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.events WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe("a bar's week", () => {
  test('the team sees everything on this week, team-only and unpublished included', async () => {
    const got = await week(users.maker.client, ids.bar);
    for (const id of [ids.takeover, ids.staffTasting, ids.lastNight, ids.publishedMenu, ids.draftMenu, ids.publicDrink, ids.privateDrink]) {
      assert.ok(got.has(id), id);
    }
    assert.ok(!got.has(ids.nextMonth), 'a month out is not this week');
  });

  test('signed out, only public events, published menus and published drinks', async () => {
    const got = await week(anon, ids.bar);
    for (const id of [ids.takeover, ids.lastNight, ids.publishedMenu, ids.publicDrink]) assert.ok(got.has(id), id);
    for (const id of [ids.staffTasting, ids.draftMenu, ids.privateDrink, ids.nextMonth]) assert.ok(!got.has(id), id);
  });

  test('a signed-in guest sees what a signed-out visitor sees', async () => {
    assert.deepEqual([...(await week(users.guest.client, ids.bar))].sort(), [...(await week(anon, ids.bar))].sort());
  });

  test('a bar without a public page shows guests nothing', async () => {
    assert.equal((await week(anon, ids.hiddenBar)).size, 0);
    assert.equal((await week(users.guest.client, ids.hiddenBar)).size, 0);
  });

  test('guests read only the public columns of a public event', async () => {
    const { data, error } = await anon.rpc('bar_week', { p_bar_id: ids.bar, p_from: today.toISOString(), p_days: 7 });
    assert.ifError(error);
    const row = data.find((r) => r.id === ids.takeover);
    assert.equal(row.event_kind, 'takeover');
    assert.equal(row.guest_name, 'Mara Q.');
    assert.equal(row.bar_profile_id, ids.barPage);
    assert.ok(!('notes' in row) && !('covers_estimate' in row));
  });

  test('the events table itself stays closed to guests', async () => {
    const signedOut = await anon.from('events').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(signedOut.data ?? [], []);
    const guest = await users.guest.client.from('events').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(guest.data ?? [], []);
  });
});

describe('one event', () => {
  test('a public event opens for anyone; a team-only one only for the team', async () => {
    const open = await anon.rpc('week_event', { p_event_id: ids.takeover });
    assert.ifError(open.error);
    assert.equal(open.data.length, 1);
    const closed = await anon.rpc('week_event', { p_event_id: ids.staffTasting });
    assert.ifError(closed.error);
    assert.equal(closed.data.length, 0);
    const team = await users.floor.client.rpc('week_event', { p_event_id: ids.staffTasting });
    assert.ifError(team.error);
    assert.equal(team.data.length, 1);
    const hidden = await anon.rpc('week_event', { p_event_id: ids.hiddenEvent });
    assert.equal(hidden.data.length, 0);
  });
});

describe('the week at home', () => {
  test('loved bars show their public week, plus my own dated home menus', async () => {
    const { data, error } = await users.lover.client.rpc('my_week', { p_from: today.toISOString(), p_days: 7 });
    assert.ifError(error);
    const got = new Set(data.map((r) => r.id));
    for (const id of [ids.takeover, ids.publishedMenu, ids.publicDrink, ids.homeMenu]) assert.ok(got.has(id), id);
    for (const id of [ids.staffTasting, ids.draftMenu, ids.privateDrink, ids.hiddenEvent, ids.otherHomeMenu]) assert.ok(!got.has(id), id);
    const home = data.find((r) => r.id === ids.homeMenu);
    assert.equal(home.kind, 'home_menu');
    assert.equal(home.guest_count, 6);
    assert.equal(home.starts_at.slice(0, 10), dateIn(2));
  });

  test('staff at home still see only the public part of their own bar', async () => {
    await serviceInsert('loved_bars', { user_id: users.maker.id, profile_id: ids.barPage });
    const { data, error } = await users.maker.client.rpc('my_week', { p_from: today.toISOString(), p_days: 7 });
    assert.ifError(error);
    const got = new Set(data.map((r) => r.id));
    assert.ok(got.has(ids.takeover));
    assert.ok(!got.has(ids.staffTasting));
  });

  test('signed out there is no home week', async () => {
    const { error } = await anon.rpc('my_week', { p_from: today.toISOString(), p_days: 7 });
    assert.ok(error);
  });
});

describe('writing events', () => {
  test('a Maker adds a public event with the new fields; the floor cannot add one', async () => {
    const made = await users.maker.client
      .from('events')
      .insert({ bar_id: ids.bar, name: `Guest shift ${run}`, starts_at: at(5), kind: 'guest_shift', is_public: true, house_menu_on: true, description: 'Walk-ins only.' })
      .select('id')
      .single();
    assert.ifError(made.error);
    const floor = await users.floor.client.from('events').insert({ bar_id: ids.bar, name: `Floor ${run}`, starts_at: at(5) });
    assert.ok(floor.error);
  });

  test('a private event never goes public, and ticket links are https', async () => {
    const privatePublic = await service.from('events').insert({ bar_id: ids.bar, name: `Buyout ${run}`, starts_at: at(5), kind: 'private', is_public: true });
    assert.equal(privatePublic.error?.code, '23514');
    const http = await service.from('events').insert({ bar_id: ids.bar, name: `Http ${run}`, starts_at: at(5), ticket_url: 'http://example.com' });
    assert.equal(http.error?.code, '23514');
    const kind = await service.from('events').insert({ bar_id: ids.bar, name: `Rave ${run}`, starts_at: at(5), kind: 'rave' });
    assert.equal(kind.error?.code, '23514');
  });

  test('public event text is screened; team-only text is not', async () => {
    const bad = `Faggot Fizz night ${run}`;
    const teamOnly = await users.maker.client.from('events').insert({ bar_id: ids.bar, name: bad, starts_at: at(6) }).select('id').single();
    assert.ifError(teamOnly.error);
    const open = await users.maker.client.from('events').update({ is_public: true }).eq('id', teamOnly.data.id);
    assert.equal(open.error?.code, 'P0001');
    const described = await users.maker.client
      .from('events')
      .insert({ bar_id: ids.bar, name: `Fine ${run}`, starts_at: at(6), is_public: true, description: 'faggot' });
    assert.equal(described.error?.code, 'P0001');
  });
});
