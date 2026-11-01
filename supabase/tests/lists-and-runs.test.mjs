// Living lists (20261203100000_lists_and_runs.sql): Swap on the row, now or
// from a date, kept in the record; changes by someone the list's owner rule
// doesn't cover, or by a department, wait for approval; drafts and planned
// drinks are read by the bar once shared; only a list that never ran is
// deleted, by its creator or an Admin; a hidden list leaves the bar page;
// the list on any day; the daily list's day; 'Tasted and approved'. Runs
// through the real API (and SQL to move the clock) against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL) || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run living list tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};
const menus = [];
const DAY = 86400000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

async function makeUser(label) {
  const email = `${label}-${run}@lists-test.local`;
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

/** A list with one section holding these drinks. */
async function list(label, fields, itemIds = []) {
  const m = await insert('menus', { bar_id: ids.bar, name: `${label} ${run}`, created_by: users.admin.id, ...fields });
  menus.push(m.id);
  const section = await insert('menu_sections', { menu_id: m.id, name: 'Stirred', sort_order: 0, min_items: 0, allowed_types: ['cocktail'] });
  const rows = [];
  for (const [i, item_id] of itemIds.entries()) {
    // On with the list from its start (a row made later went on when it was made).
    rows.push(await insert('menu_drinks', { menu_id: m.id, menu_section_id: section.id, item_id, sort_order: i, ...(fields.starts_at ? { created_at: fields.starts_at } : {}) }));
  }
  return { id: m.id, section: section.id, rows };
}

const rowsOf = async (menuId) => (await db.query('SELECT * FROM public.menu_drinks WHERE menu_id = $1 ORDER BY sort_order, created_at', [menuId])).rows;
const removedOf = async (menuId) => (await db.query('SELECT * FROM public.menu_drinks_removed WHERE menu_id = $1 ORDER BY came_off', [menuId])).rows;
/** Move a row's dates back, as if time had passed (with triggers off, as the clock would). */
async function backdate(rowId, ms) {
  await db.query('SET session_replication_role = replica');
  await db.query(
    "UPDATE public.menu_drinks SET on_from = on_from - $2 * interval '1 millisecond', off_at = off_at - $2 * interval '1 millisecond' WHERE id = $1",
    [rowId, ms]
  );
  await db.query('SET session_replication_role = origin');
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'creator', 'creator2', 'bartender', 'beer', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Living lists bar ${run}` })).id;
  ids.beerRole = (await insert('venue_roles', { bar_id: ids.bar, name: `Beer lead ${run}`, base_level: 35, drink_types: ['beer'] })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await insert('user_bars', { user_id: users.creator2.id, bar_id: ids.bar, role_level: 35 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.beer.id, bar_id: ids.bar, role_level: 35, venue_role_id: ids.beerRole });
  for (const name of ['negroni', 'collins', 'martini', 'daiquiri', 'sour', 'lager']) {
    ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: name === 'lager' ? 'beer' : 'cocktail', bar_id: ids.bar, price: '18' })).id;
  }
  ids.profile = (await insert('profiles', { kind: 'bar', bar_id: ids.bar, handle: `lists${run}`, display_name: `Lists ${run}`, is_public: true })).id;
  ids.live = await list('Live', { starts_at: ago(10 * DAY) }, [ids.negroni, ids.collins]);
});

after(async () => {
  for (const id of menus) await service.from('menus').delete().eq('id', id);
  for (const name of ['negroni', 'collins', 'martini', 'daiquiri', 'sour', 'lager']) if (ids[name]) await service.from('items').delete().eq('id', ids[name]);
  if (ids.profile) await service.from('profiles').delete().eq('id', ids.profile);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('Swap on the row', () => {
  test('now: the old drink comes off into the record, the new one takes its place and slot', async () => {
    await db.query("UPDATE public.menu_drinks SET slot_name = 'Seasonal' WHERE id = $1", [ids.live.rows[0].id]);
    const { data: newId, error } = await users.creator.client.rpc('swap_menu_drink', { p_row_id: ids.live.rows[0].id, p_item_id: ids.martini });
    assert.ifError(error);
    const rows = await rowsOf(ids.live.id);
    assert.deepEqual(rows.map((r) => r.item_id).sort(), [ids.collins, ids.martini].sort(), 'the Negroni is off, the Martini on');
    const swapped = rows.find((r) => r.id === newId);
    assert.equal(swapped.replaces_item_id, ids.negroni);
    assert.equal(swapped.slot_name, 'Seasonal', 'the slot keeps its place');
    assert.equal(swapped.added_by, users.creator.id);
    assert.ok(Math.abs(swapped.on_from.getTime() - Date.now()) < 60000, 'on from now');
    const [kept] = await removedOf(ids.live.id);
    assert.equal(kept.item_id, ids.negroni);
    assert.equal(kept.taken_off_by, users.creator.id);
    assert.equal(kept.slot_name, 'Seasonal');
    ids.martiniRow = newId;
  });

  test('from the next service: both stay as they are until then, and the planned drink is the builders\' until shared', async () => {
    const at = new Date(Date.now() + DAY).toISOString();
    const { data: newId, error } = await users.creator.client.rpc('swap_menu_drink', { p_row_id: ids.martiniRow, p_item_id: ids.daiquiri, p_at: at });
    assert.ifError(error);
    const rows = await rowsOf(ids.live.id);
    assert.equal(rows.length, 3, 'the Martini stays on until tomorrow');
    assert.equal((await removedOf(ids.live.id)).length, 1, 'nothing more in the record yet');
    const seen = await users.bartender.client.from('menu_drinks').select('item_id').eq('menu_id', ids.live.id);
    assert.ifError(seen.error);
    assert.ok(!seen.data.some((r) => r.item_id === ids.daiquiri), "a bartender doesn't see tomorrow's drink");
    const { data: dates } = await service.rpc('drink_list_dates', { p_item_ids: [ids.daiquiri, ids.martini] });
    assert.deepEqual(dates.map((d) => d.item_id), [ids.martini], 'the Daiquiri is not on yet');

    assert.ifError((await users.creator.client.from('menu_drinks').update({ team_shared_at: new Date().toISOString() }).eq('id', newId)).error);
    const shared = await users.bartender.client.from('menu_drinks').select('item_id').eq('id', newId);
    assert.equal(shared.data.length, 1, 'shared to learn: the bartender reads it');

    // The next service comes: the sweep moves the Martini to the record, dated when it was due.
    await backdate(newId, 2 * DAY);
    await backdate(ids.martiniRow, 2 * DAY);
    const due = (await rowsOf(ids.live.id)).find((r) => r.id === ids.martiniRow).off_at;
    await db.query('SELECT private.sweep_menu_dates()');
    const after = await rowsOf(ids.live.id);
    assert.deepEqual(after.map((r) => r.item_id).sort(), [ids.collins, ids.daiquiri].sort());
    const kept = (await removedOf(ids.live.id)).find((r) => r.item_id === ids.martini);
    assert.equal(kept.came_off.getTime(), due.getTime(), 'came off when it was due, not at the sweep');
    assert.equal(kept.taken_off_by, users.creator.id);
    ids.daiquiriRow = newId;
  });

  test('a drink of the wrong kind is refused, and nobody outside the bar swaps', async () => {
    const wrong = await users.creator.client.rpc('swap_menu_drink', { p_row_id: ids.daiquiriRow, p_item_id: ids.lager });
    assert.ok(wrong.error, 'beer in a cocktail section');
    const out = await users.stranger.client.rpc('swap_menu_drink', { p_row_id: ids.daiquiriRow, p_item_id: ids.sour });
    assert.ok(out.error);
    const bartender = await users.bartender.client.rpc('swap_menu_drink', { p_row_id: ids.daiquiriRow, p_item_id: ids.sour });
    assert.ok(bartender.error, 'a bartender without the menus permission');
  });
});

describe('approval', () => {
  test("on an Admin's list, a Drink Creator's changes wait; an Admin approves them", async () => {
    const main = await list('Main', { starts_at: ago(5 * DAY), change_level: 40 }, [ids.negroni]);
    const add = await users.creator.client.from('menu_drinks').insert({ menu_id: main.id, menu_section_id: main.section, item_id: ids.sour, sort_order: 1 }).select('id, waiting').single();
    assert.ifError(add.error);
    assert.equal(add.data.waiting, 'on');
    let { data: dates } = await service.rpc('drink_list_dates', { p_item_ids: [ids.sour] });
    assert.deepEqual(dates, [], 'waiting: not on');

    const off = await users.creator.client.from('menu_drinks').update({ off_at: new Date().toISOString() }).eq('id', main.rows[0].id).select('waiting');
    assert.ifError(off.error);
    assert.equal(off.data[0].waiting, 'off', 'the Negroni stays on until approved');
    assert.equal((await rowsOf(main.id)).length, 2);

    const selfApprove = await users.creator.client.from('menu_drinks').update({ waiting: null }).eq('id', add.data.id).select('waiting');
    assert.equal(selfApprove.data[0].waiting, 'on', "the creator can't approve their own change");
    const forge = await users.creator.client.from('menu_drinks').update({ added_by: users.admin.id }).eq('id', add.data.id).select('added_by');
    assert.equal(forge.data[0].added_by, users.creator.id, 'who added it stays');

    assert.ifError((await users.admin.client.from('menu_drinks').update({ waiting: null }).eq('id', add.data.id)).error);
    assert.ifError((await users.admin.client.from('menu_drinks').update({ waiting: null }).eq('id', main.rows[0].id)).error);
    const rows = await rowsOf(main.id);
    assert.deepEqual(rows.map((r) => r.item_id), [ids.sour], 'approved: the Sour on, the Negroni off');
    ({ data: dates } = await service.rpc('drink_list_dates', { p_item_ids: [ids.sour] }));
    assert.equal(dates.length, 1);
    assert.equal(dates[0].is_current, true);
    const [kept] = await removedOf(main.id);
    assert.equal(kept.item_id, ids.negroni);
    assert.equal(kept.taken_off_by, users.creator.id, 'who asked for it to come off');
  });

  test("a list owned by a role: its members change it directly, other creators wait, and a turned-down add leaves nothing", async () => {
    const beer = await list('Beer', { starts_at: ago(DAY), change_role_id: ids.beerRole }, []);
    await db.query("UPDATE public.menu_sections SET allowed_types = '{beer}' WHERE id = $1", [beer.section]);
    const lead = await users.beer.client.from('menu_drinks').insert({ menu_id: beer.id, menu_section_id: beer.section, item_id: ids.lager, sort_order: 0 }).select('id, waiting').single();
    assert.ifError(lead.error);
    // The beer lead is a department (#1023): even on their own list, their changes wait.
    assert.equal(lead.data.waiting, 'on');
    const other = await users.creator2.client.from('menu_drinks').update({ team_shared_at: new Date().toISOString() }).eq('id', lead.data.id).select('id');
    assert.ifError(other.error);
    const can = await users.creator2.client.rpc('may_change_list', { p_menu_id: beer.id });
    assert.equal(can.data, false, "another Drink Creator's changes wait on the beer list");
    const admin = await users.admin.client.rpc('may_change_list', { p_menu_id: beer.id });
    assert.equal(admin.data, true);
    const no = await users.admin.client.from('menu_drinks').delete().eq('id', lead.data.id).select('id');
    assert.ifError(no.error);
    assert.equal(no.data.length, 1);
    assert.deepEqual(await removedOf(beer.id), [], 'never on, so nothing kept');
  });

  test('Tasted and approved: an approver stamps it, nobody else can', async () => {
    const bartender = await users.bartender.client.from('items').update({ approved_at: new Date().toISOString() }).eq('id', ids.collins).select('approved_at');
    assert.ok(bartender.error || bartender.data.length === 0 || bartender.data[0].approved_at === null, "a bartender can't approve");
    const beer = await users.beer.client.from('items').update({ approved_at: new Date().toISOString() }).eq('id', ids.lager).select('approved_at');
    assert.ok(beer.error, "a department can't approve");
    const ok = await users.admin.client.from('items').update({ approved_at: '2001-01-01T00:00:00Z' }).eq('id', ids.collins).select('approved_by, approved_at');
    assert.ifError(ok.error);
    assert.equal(ok.data[0].approved_by, users.admin.id);
    assert.ok(Math.abs(new Date(ok.data[0].approved_at).getTime() - Date.now()) < 60000, 'stamped now, whatever was sent');
  });
});

describe('drafts shared per change', () => {
  test('a bartender reads a draft once it is shared; the prep team reads a dated one', async () => {
    const draft = await list('Draft', {}, [ids.sour]);
    const coming = await list('Coming', { starts_at: new Date(Date.now() + 3 * DAY).toISOString() }, [ids.sour]);
    const read = async (u, id) => (await u.client.from('menus').select('id').eq('id', id)).data.length;
    assert.equal(await read(users.bartender, draft.id), 0);
    assert.equal(await read(users.bartender, coming.id), 0, 'not shared yet');
    assert.equal(await read(users.creator, draft.id), 1, 'menu builders read every draft');
    await db.query("UPDATE public.user_bars SET venue_role_id = NULL WHERE user_id = $1", [users.bartender.id]);
    const prepRole = await insert('venue_roles', { bar_id: ids.bar, name: `Prep ${run}`, base_level: 30, granted: ['prep'] });
    await db.query('UPDATE public.user_bars SET venue_role_id = $2 WHERE user_id = $1', [users.bartender.id, prepRole.id]);
    assert.equal(await read(users.bartender, coming.id), 1, 'prep reads a dated list to prep for it');
    assert.equal(await read(users.bartender, draft.id), 0, 'but not an undated draft');
    await db.query('UPDATE public.user_bars SET venue_role_id = NULL WHERE user_id = $1', [users.bartender.id]);

    const share = await users.creator.client.from('menus').update({ team_shared_at: '2001-01-01T00:00:00Z' }).eq('id', draft.id).select('team_shared_at, team_shared_by');
    assert.ifError(share.error);
    assert.equal(share.data[0].team_shared_by, users.creator.id);
    assert.ok(new Date(share.data[0].team_shared_at).getTime() > Date.now() - 60000, 'stamped now');
    assert.equal(await read(users.bartender, draft.id), 1, 'shared: the bartender reads it');
    const drinks = await users.bartender.client.from('menu_drinks').select('item_id').eq('menu_id', draft.id);
    assert.equal(drinks.data.length, 1, 'and its drinks');
  });
});

describe('ended, never deleted', () => {
  test('a draft is deleted by its creator or an Admin, not by another creator', async () => {
    const mine = await insert('menus', { bar_id: ids.bar, name: `Mine ${run}`, created_by: users.creator.id });
    menus.push(mine.id);
    const other = await users.creator2.client.from('menus').delete().eq('id', mine.id).select('id');
    assert.equal(other.data.length, 0);
    const own = await users.creator.client.from('menus').delete().eq('id', mine.id).select('id');
    assert.equal(own.data.length, 1);
    const theirs = await insert('menus', { bar_id: ids.bar, name: `Theirs ${run}`, created_by: users.creator2.id });
    menus.push(theirs.id);
    const admin = await users.admin.client.from('menus').delete().eq('id', theirs.id).select('id');
    assert.equal(admin.data.length, 1);
  });

  test('a list that ran is ended and hidden: nobody deletes it, and hidden it leaves the bar page and drink pages', async () => {
    const past = await list('Past', { starts_at: ago(20 * DAY), ends_at: ago(12 * DAY) }, [ids.martini]);
    for (const u of [users.admin, users.creator]) {
      const del = await u.client.from('menus').delete().eq('id', past.id).select('id');
      assert.equal(del.data.length, 0, 'not deleted');
    }
    const listed = async () => (await service.rpc('get_menu_editions', { p_profile_id: ids.profile })).data.map((e) => e.id);
    assert.ok((await listed()).includes(past.id));
    const before = (await service.rpc('drink_list_dates', { p_item_ids: [ids.martini] })).data.length;
    assert.ifError((await users.admin.client.from('menus').update({ hidden_at: new Date().toISOString() }).eq('id', past.id)).error);
    assert.ok(!(await listed()).includes(past.id), 'off the bar page');
    const afterDates = (await service.rpc('drink_list_dates', { p_item_ids: [ids.martini] })).data.length;
    assert.ok(before > 0 && afterDates < before, 'its dates no longer show');
    const draft = await users.admin.client.from('menus').update({ hidden_at: new Date().toISOString() }).eq('id', ids.live.id).select('id');
    assert.ifError(draft.error, 'a live list can be hidden once it has run');
    await service.from('menus').update({ hidden_at: null }).eq('id', ids.live.id);
  });
});

describe('the daily list', () => {
  test("the list on any day comes from the record, in the bar's time zone", async () => {
    const bad = await service.from('bars').update({ timezone: 'Mars/Olympus' }).eq('id', ids.bar);
    assert.ok(bad.error, 'an unknown time zone is refused');
    assert.ifError((await service.from('bars').update({ timezone: 'Australia/Sydney' }).eq('id', ids.bar)).error);
    const daily = await list('Today', { starts_at: ago(3 * DAY), list_type: 'daily' }, [ids.negroni, ids.collins]);
    // Two days ago the Negroni came off for the Sour.
    const { data: sourRow } = await users.admin.client.rpc('swap_menu_drink', { p_row_id: daily.rows[0].id, p_item_id: ids.sour });
    await db.query("UPDATE public.menu_drinks_removed SET came_off = now() - interval '2 days' WHERE menu_id = $1", [daily.id]);
    await db.query("UPDATE public.menu_drinks SET on_from = now() - interval '2 days' WHERE id = $1", [sourRow]);
    const day = (ms) => new Date(Date.now() - ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
    const onDay = async (ms) => {
      const { data, error } = await users.bartender.client.rpc('list_on_day', { p_menu_id: daily.id, p_day: day(ms) });
      assert.ifError(error);
      return data.map((r) => r.item_id).sort();
    };
    assert.deepEqual(await onDay(0), [ids.collins, ids.sour].sort(), 'today');
    assert.deepEqual(await onDay(3 * DAY), [ids.collins, ids.negroni].sort(), 'three days ago');
  });

  test("a day's author and names: written by who changes lists, read by the bar", async () => {
    const daily = (await db.query("SELECT id FROM public.menus WHERE list_type = 'daily' AND bar_id = $1", [ids.bar])).rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const no = await users.bartender.client.from('menu_days').insert({ menu_id: daily.id, day: today, written_by: users.bartender.id, names: 'Sam' });
    assert.ok(no.error, "a bartender doesn't write the day");
    const yes = await users.creator.client.from('menu_days').insert({ menu_id: daily.id, day: today, written_by: users.creator.id, names: 'Sam and Alex' }).select('id').single();
    assert.ifError(yes.error);
    const twice = await users.creator.client.from('menu_days').insert({ menu_id: daily.id, day: today, written_by: users.creator.id });
    assert.ok(twice.error, 'one a day');
    const read = await users.bartender.client.from('menu_days').select('names').eq('menu_id', daily.id);
    assert.equal(read.data[0].names, 'Sam and Alex');
    const out = await users.stranger.client.from('menu_days').select('id').eq('menu_id', daily.id);
    assert.equal(out.data.length, 0);
  });
});

describe('deleting an account', () => {
  test('nulls who added, took off and shared, and the lists stay', async () => {
    const leaver = await makeUser('leaver');
    await insert('user_bars', { user_id: leaver.id, bar_id: ids.bar, role_level: 35 });
    const kept = await list('Kept', { starts_at: ago(DAY) }, []);
    const add = await leaver.client.from('menu_drinks').insert({ menu_id: kept.id, menu_section_id: kept.section, item_id: ids.collins, sort_order: 0 }).select('id').single();
    assert.ifError(add.error);
    const shared = await insert('menus', { bar_id: ids.bar, name: `Shared draft ${run}`, created_by: users.admin.id });
    menus.push(shared.id);
    assert.ifError((await leaver.client.from('menus').update({ team_shared_at: new Date().toISOString() }).eq('id', shared.id)).error);
    const { error } = await service.auth.admin.deleteUser(leaver.id);
    assert.ifError(error);
    const row = (await db.query('SELECT added_by FROM public.menu_drinks WHERE id = $1', [add.data.id])).rows[0];
    assert.equal(row.added_by, null);
    const m = (await db.query('SELECT team_shared_at, team_shared_by FROM public.menus WHERE id = $1', [shared.id])).rows[0];
    assert.equal(m.team_shared_by, null);
    assert.ok(m.team_shared_at, 'still shared');
  });
});
