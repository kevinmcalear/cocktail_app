// Anyone on shift, and what guests read of a menu tonight
// (20261205910000_on_shift_and_guest_menu_reads.sql): someone whose shift
// is on (or starts within two hours) takes a drink off for tonight on any of
// the bar's lists and writes the daily list without approval; a later shift,
// or someone off the team, doesn't. Guests read a venue menu's cover and
// which drinks are off tonight through get_menu_editions.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run on-shift tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
const HOUR = 3600000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();
const today = new Date().toISOString().slice(0, 10);

async function makeUser(label) {
  const email = `${label}-${run}@shift-test.local`;
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
  for (const label of ['creator', 'onShift', 'soon', 'later', 'left', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Shift bar ${run}` })).id;
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `shift.${run}`, display_name: `Shift bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  for (const label of ['onShift', 'soon', 'later', 'left']) await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: 20 });
  const shift = (label, from, to) => insert('shifts', { bar_id: ids.bar, user_id: users[label].id, starts_at: from, ends_at: to });
  await shift('onShift', ago(HOUR), ahead(6 * HOUR));
  await shift('soon', ahead(HOUR), ahead(8 * HOUR));
  await shift('later', ahead(5 * HOUR), ahead(12 * HOUR));
  await shift('left', ago(HOUR), ahead(6 * HOUR));
  // Off the team since the rota was written: the shift stays, the access doesn't.
  await service.from('user_bars').delete().eq('user_id', users.left.id).eq('bar_id', ids.bar);
  for (const name of ['negroni', 'martini', 'daiquiri']) ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.main = (await insert('menus', { bar_id: ids.bar, name: `Main ${run}`, created_by: users.creator.id, starts_at: ago(24 * HOUR), cover_url: 'https://example.test/cover.jpg' })).id;
  ids.daily = (await insert('menus', { bar_id: ids.bar, name: `Daily ${run}`, created_by: users.creator.id, starts_at: ago(24 * HOUR), list_type: 'daily' })).id;
  ids.section = (await insert('menu_sections', { menu_id: ids.daily, name: 'Tonight', sort_order: 0 })).id;
  await insert('menu_drinks', { menu_id: ids.main, item_id: ids.negroni, sort_order: 0 });
  await insert('menu_drinks', { menu_id: ids.main, item_id: ids.martini, sort_order: 1 });
});

after(async () => {
  for (const key of ['main', 'daily']) if (ids[key]) await service.from('menus').delete().eq('id', ids[key]);
  for (const name of ['negroni', 'martini', 'daiquiri']) if (ids[name]) await service.from('items').delete().eq('id', ids[name]);
  if (ids.profile) await service.from('profiles').delete().eq('id', ids.profile);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

const offTonight = (who, item = ids.negroni) =>
  users[who].client.from('menu_off_tonight').insert({ menu_id: ids.main, item_id: item, until: ahead(6 * HOUR) }).select().single();
const addToDaily = (who, item) =>
  users[who].client.from('menu_drinks').insert({ menu_id: ids.daily, menu_section_id: ids.section, item_id: item, sort_order: 0 }).select('id, waiting').single();

describe('Anyone on shift', () => {
  test('takes a drink off for tonight on any list, and puts it back', async () => {
    const off = await offTonight('onShift');
    assert.ifError(off.error);
    const back = await users.onShift.client.from('menu_off_tonight').delete().eq('id', off.data.id).select();
    assert.equal(back.data.length, 1);
    const soon = await offTonight('soon');
    assert.ifError(soon.error, 'a shift that starts within two hours counts');
    ids.off = soon.data.id;
  });

  test('a later shift, someone off the team, or anyone outside does not', async () => {
    for (const who of ['later', 'left', 'stranger']) {
      const off = await offTonight(who, ids.martini);
      assert.ok(off.error, `${who} cannot take a drink off`);
      const clear = await users[who].client.from('menu_off_tonight').delete().eq('id', ids.off).select();
      assert.equal(clear.data?.length ?? 0, 0, `${who} cannot put one back`);
    }
  });

  test('writes the daily list without approval, and its day', async () => {
    const add = await addToDaily('onShift', ids.daiquiri);
    assert.ifError(add.error);
    assert.equal(add.data.waiting, null, 'it goes straight on');
    const swap = await users.onShift.client.rpc('swap_menu_drink', { p_row_id: add.data.id, p_item_id: ids.negroni });
    assert.ifError(swap.error);
    const day = await users.onShift.client.from('menu_days').upsert({ menu_id: ids.daily, day: today, written_by: users.onShift.id, names: 'Ana, Theo' }, { onConflict: 'menu_id,day' }).select().single();
    assert.ifError(day.error);
  });

  test('not the bar\'s other lists, and not off shift', async () => {
    const main = await users.onShift.client.from('menu_drinks').insert({ menu_id: ids.main, item_id: ids.daiquiri, sort_order: 2 }).select();
    assert.ok(main.error || !main.data?.length, 'the main list stays the menu team\'s');
    for (const who of ['later', 'left']) {
      const add = await addToDaily(who, ids.martini);
      assert.ok(add.error, `${who} cannot write the daily list`);
    }
  });
});

describe('What guests read', () => {
  test('a venue menu\'s cover, and which drinks are off tonight', async () => {
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    assert.ifError(error);
    const main = data.find((e) => e.id === ids.main);
    assert.equal(main.cover_url, 'https://example.test/cover.jpg');
    const off = Object.fromEntries(main.drinks.map((d) => [d.id, d.off_tonight ?? false]));
    assert.deepEqual(off, { [ids.negroni]: true, [ids.martini]: false });
    assert.ok(!main.drinks.some((d) => 'set_by' in d), 'not who pulled it');
  });

  test('a drink back on is on again', async () => {
    await users.soon.client.from('menu_off_tonight').delete().eq('id', ids.off);
    const { data } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    const main = data.find((e) => e.id === ids.main);
    assert.ok(main.drinks.every((d) => !d.off_tonight));
  });
});
