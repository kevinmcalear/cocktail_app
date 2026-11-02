// Tonight, the daily list, as guests read it
// (20261205930000_daily_list_guest_read.sql): get_menu_editions returns a
// venue menu's list_type, when today's daily list was first written (not who
// wrote it), and marks a drink on it for the first time today 'new_today'.
// A bar's day is read in its own time zone: bars.timezone, else its page's.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run daily list tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const ids = {};
let creator;
const DAY = 86400000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ZONE = 'Pacific/Kiritimati'; // UTC+14, no daylight saving: its day starts 14 hours before UTC's.
const barToday = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const barDayStart = Date.parse(`${barToday}T00:00:00+14:00`);

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

before(async () => {
  const { data, error } = await service.auth.admin.createUser({ email: `daily-${run}@daily-test.local`, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  creator = data.user.id;
  ids.bar = (await insert('bars', { name: `Daily bar ${run}` })).id;
  // The zone lives on the bar's page only: bar_time_zone falls back to it.
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `daily.${run}`, display_name: `Daily bar ${run}`, bar_id: ids.bar, is_public: true, timezone: ZONE })).id;
  await insert('user_bars', { user_id: creator, bar_id: ids.bar, role_level: 35 });
  for (const name of ['old', 'back', 'fresh', 'gone']) ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.daily = (await insert('menus', { bar_id: ids.bar, name: `Daily ${run}`, created_by: creator, starts_at: ago(30 * DAY), list_type: 'daily' })).id;
  ids.main = (await insert('menus', { bar_id: ids.bar, name: `Main ${run}`, created_by: creator, starts_at: ago(30 * DAY) })).id;
  ids.section = (await insert('menu_sections', { menu_id: ids.daily, name: 'Tonight', sort_order: 0 })).id;
  // On for weeks; back on today after a run before; on for the first time today.
  await insert('menu_drinks', { menu_id: ids.daily, menu_section_id: ids.section, item_id: ids.old, sort_order: 0, on_from: ago(20 * DAY) });
  await insert('menu_drinks_removed', { menu_id: ids.daily, item_id: ids.back, section_name: 'Tonight', went_on: ago(10 * DAY), came_off: ago(3 * DAY) });
  await insert('menu_drinks', { menu_id: ids.daily, menu_section_id: ids.section, item_id: ids.back, sort_order: 1, on_from: ago(60_000) });
  await insert('menu_drinks', { menu_id: ids.daily, menu_section_id: ids.section, item_id: ids.fresh, sort_order: 2, on_from: ago(60_000) });
  // Taken off a minute into the bar's day: on that day in its zone, not in UTC's.
  await insert('menu_drinks_removed', { menu_id: ids.daily, item_id: ids.gone, section_name: 'Tonight', went_on: new Date(barDayStart - 3600000).toISOString(), came_off: new Date(barDayStart + 60_000).toISOString() });
  await insert('menu_days', { menu_id: ids.daily, day: barToday, written_by: creator });
});

after(async () => {
  for (const key of ['daily', 'main']) if (ids[key]) await service.from('menus').delete().eq('id', ids[key]);
  for (const name of ['old', 'back', 'fresh', 'gone']) if (ids[name]) await service.from('items').delete().eq('id', ids[name]);
  if (ids.profile) await service.from('profiles').delete().eq('id', ids.profile);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  if (creator) await service.auth.admin.deleteUser(creator);
});

test('a guest reads the daily list, when it was written and what is new today', async () => {
  const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
  assert.ifError(error);
  const daily = data.find((e) => e.id === ids.daily);
  const main = data.find((e) => e.id === ids.main);
  assert.equal(daily.list_type, 'daily');
  assert.ok(daily.written_at, 'today, in the bar’s zone, has been written');
  assert.equal(main.list_type, 'main');
  assert.equal(main.written_at, null);
  const fresh = Object.fromEntries(daily.drinks.map((d) => [d.id, !!d.new_today]));
  assert.deepEqual(fresh, { [ids.old]: false, [ids.back]: false, [ids.fresh]: true });
  // Who wrote it isn't returned.
  assert.ok(!JSON.stringify(data).includes(creator));
});

test('list_on_day reads the bar’s day in the time zone on its page', async () => {
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email: `daily-${run}@daily-test.local`, password: PASSWORD });
  assert.ifError(signInError);
  const { data, error } = await client.rpc('list_on_day', { p_menu_id: ids.daily, p_day: barToday });
  assert.ifError(error);
  assert.deepEqual(new Set(data.map((r) => r.item_id)), new Set([ids.old, ids.back, ids.fresh, ids.gone]));
});
