// Love alerts and an event's drinks (20261015500000_love_alerts_and_event_drinks):
// someone who loves a bar picks what it may tell them about, on their own row
// only and on that column only; an event page lists the drinks on the event's
// menu, every one for the bar's team and only published ones for guests, and
// nothing for an event a guest can't open.
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

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run love alert tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

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

before(async () => {
  await db.connect();
  for (const label of ['maker', 'lover', 'other']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Lovebar ${run}` })).id;
  ids.page = (await serviceInsert('profiles', { kind: 'bar', handle: `love.${run}`, display_name: `Lovebar ${run}`, is_public: true, bar_id: ids.bar })).id;
  ids.otherPage = (await serviceInsert('profiles', { kind: 'bar', handle: `love2.${run}`, display_name: `Lovebar two ${run}`, is_public: true })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('loved_bars', { user_id: users.lover.id, profile_id: ids.page });
  await serviceInsert('loved_bars', { user_id: users.other.id, profile_id: ids.page });

  ids.menu = (await serviceInsert('menus', { name: `Takeover menu ${run}`, bar_id: ids.bar })).id;
  ids.published = (await serviceInsert('items', { name: `Moth Spritz ${run}`, item_type: 'cocktail', bar_id: ids.bar, publish_mode: 'description' })).id;
  ids.private = (await serviceInsert('items', { name: `Quiet Hours ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await serviceInsert('menu_drinks', { menu_id: ids.menu, item_id: ids.published, sort_order: 1 });
  await serviceInsert('menu_drinks', { menu_id: ids.menu, item_id: ids.private, sort_order: 2 });
  const event = (name, extra) => serviceInsert('events', { bar_id: ids.bar, name: `${name} ${run}`, starts_at: soon, menu_id: ids.menu, kind: 'takeover', ...extra });
  ids.publicEvent = (await event('Takeover', { is_public: true })).id;
  ids.teamEvent = (await event('Team takeover', { is_public: false })).id;
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

const alertsOf = async (userId, profileId) => (await db.query('SELECT alerts FROM public.loved_bars WHERE user_id = $1 AND profile_id = $2', [userId, profileId])).rows[0]?.alerts;

describe('love alerts', () => {
  test('a new love tells you about everything', async () => {
    assert.equal(await alertsOf(users.lover.id, ids.page), 'everything');
  });

  test('you pick what a bar you love tells you about', async () => {
    const { error } = await users.lover.client.from('loved_bars').update({ alerts: 'events' }).eq('profile_id', ids.page);
    assert.ifError(error);
    assert.equal(await alertsOf(users.lover.id, ids.page), 'events');
  });

  test("you can't change someone else's", async () => {
    await users.lover.client.from('loved_bars').update({ alerts: 'none' }).eq('user_id', users.other.id);
    assert.equal(await alertsOf(users.other.id, ids.page), 'everything');
  });

  test('only the alerts column changes: a love never moves to another bar', async () => {
    const { error } = await users.lover.client.from('loved_bars').update({ profile_id: ids.otherPage }).eq('profile_id', ids.page);
    assert.ok(error, 'updating profile_id is refused');
    assert.equal(await alertsOf(users.lover.id, ids.page), 'events');
  });

  test('only the four choices', async () => {
    const { error } = await users.lover.client.from('loved_bars').update({ alerts: 'hourly' }).eq('profile_id', ids.page);
    assert.ok(error);
  });

  test('signed out, nothing to change', async () => {
    const { error } = await anon.from('loved_bars').update({ alerts: 'none' }).eq('profile_id', ids.page);
    assert.ok(error || (await alertsOf(users.lover.id, ids.page)) === 'events');
  });
});

describe("an event's drinks", () => {
  const names = async (client, eventId) => {
    const { data, error } = await client.rpc('week_event_drinks', { p_event_id: eventId });
    assert.ifError(error);
    return data.map((d) => d.id);
  };

  test("the bar's team reads every drink on the menu, in order", async () => {
    assert.deepEqual(await names(users.maker.client, ids.publicEvent), [ids.published, ids.private]);
  });

  test('guests and signed-out visitors read only the published ones', async () => {
    assert.deepEqual(await names(users.lover.client, ids.publicEvent), [ids.published]);
    assert.deepEqual(await names(anon, ids.publicEvent), [ids.published]);
  });

  test("a team-only event's drinks stay with the team", async () => {
    assert.deepEqual(await names(anon, ids.teamEvent), []);
    assert.deepEqual(await names(users.lover.client, ids.teamEvent), []);
    assert.deepEqual(await names(users.maker.client, ids.teamEvent), [ids.published, ids.private]);
  });
});
