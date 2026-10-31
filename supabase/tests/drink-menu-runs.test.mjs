// A drink's runs on bar menus (20261202200000_drink_menu_runs.sql): a
// staffed bar's own menus count, to the day, with drinks taken off a live
// menu; stints that touch make one run and a gap starts another; researched
// menus count to the month; the bar page's visibility holds; and Discover's
// "on now" sees a venue menu. Runs through the real API (and SQL for
// Discover) against the local stack.
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
  throw new Error(`Refusing to run menu run tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

const DAY = 86400000;
/** Noon UTC, n days ago. */
const noon = (n) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return new Date(d.getTime() - n * DAY).toISOString();
};
/** That day's date (UTC), as the runs give it. */
const day = (n) => noon(n).slice(0, 10);
const ym = (date) => [Number(date.slice(0, 4)), Number(date.slice(5, 7))];

async function makeUser(label) {
  const email = `${label}-${run}@menu-runs-test.local`;
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

const onMenu = (menu_id, item_id, created_at) => insert('menu_drinks', { menu_id, item_id, sort_order: 0, ...(created_at ? { created_at } : {}) });

/** Each drink's runs as `client` reads them, by name. */
async function runs(client, names) {
  const { data, error } = await client.rpc('drink_menu_runs', { p_item_ids: names.map((n) => ids[n]) });
  assert.ifError(error);
  const byName = Object.fromEntries(names.map((n) => [n, []]));
  for (const r of data) byName[names.find((n) => ids[n] === r.item_id)].push(r);
  return byName;
}

before(async () => {
  await db.connect();
  users.admin = await makeUser('admin');
  users.stranger = await makeUser('stranger');
  ids.bar = (await insert('bars', { name: `Runs bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `runs.${run}`, display_name: `Runs bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.research = (await insert('profiles', { kind: 'bar', handle: `runsold.${run}`, display_name: `Runs research ${run}`, is_public: true })).id;

  // x is a drink credited to the bar (as moved history is); the rest are the venue's own.
  ids.x = (await insert('items', { name: `Xylo ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: ids.profile })).id;
  for (const name of ['y', 'z', 'v', 'u', 't', 'w']) {
    ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  }
  ids.r = (await insert('items', { name: `Researched ${run}`, item_type: 'cocktail', origin: 'Original', origin_bar_profile_id: ids.research })).id;

  ids.spring = (await insert('menus', { bar_id: ids.bar, name: `Spring ${run}`, starts_at: noon(60), ends_at: noon(30) })).id;
  ids.autumn = (await insert('menus', { bar_id: ids.bar, name: `Autumn ${run}`, starts_at: noon(30) })).id;
  ids.draft = (await insert('menus', { bar_id: ids.bar, name: `Draft ${run}` })).id;
  ids.coming = (await insert('menus', { bar_id: ids.bar, name: `Coming ${run}`, starts_at: noon(-2) })).id;
  ids.rnd = (await insert('menus', { bar_id: ids.bar, name: `Trials ${run}`, kind: 'rnd' })).id;

  // x: on Spring, then Autumn from its start (its row was made before Autumn began).
  await onMenu(ids.spring, ids.x, noon(61));
  await onMenu(ids.autumn, ids.x, noon(31));
  // y: Spring only. z: put on Autumn today. t: added to Spring after it ended (a fix).
  await onMenu(ids.spring, ids.y, noon(61));
  await onMenu(ids.autumn, ids.z);
  await onMenu(ids.spring, ids.t);
  // v: taken off Autumn 10 days ago and back the next day. u: off 20 days ago, back 5 days ago.
  await insert('menu_drinks_removed', { menu_id: ids.autumn, item_id: ids.v, went_on: noon(30), came_off: noon(10) });
  await onMenu(ids.autumn, ids.v, noon(9));
  await insert('menu_drinks_removed', { menu_id: ids.autumn, item_id: ids.u, went_on: noon(30), came_off: noon(20) });
  await onMenu(ids.autumn, ids.u, noon(5));
  // w: only on a draft, a coming-up menu and R&D.
  for (const m of [ids.draft, ids.coming, ids.rnd]) await onMenu(m, ids.w);

  const edition = await insert('profile_menu_editions', { profile_id: ids.research, name: `Old list ${run}`, year: 2024, month: 3, end_year: 2024, end_month: 6 });
  await insert('profile_menu_edition_drinks', { edition_id: edition.id, item_id: ids.r, sort_order: 0 });
});

after(async () => {
  const like = `%${run}%`;
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe("a staffed bar's own menus", () => {
  test('menus that touch make one run, on now, from the first one to the day', async () => {
    const { x } = await runs(anon, ['x']);
    assert.equal(x.length, 1);
    const [r] = x;
    assert.equal(r.profile_id, ids.profile);
    assert.equal(r.edition_id, ids.autumn, 'it opens the menu on now');
    assert.deepEqual([r.starts_on, r.start_year, r.start_month], [day(60), ...ym(day(60))]);
    assert.deepEqual([r.ends_on, r.end_year, r.end_month, r.is_current], [null, null, null, true]);
  });

  test("a past menu's drink ran its dates, to the day", async () => {
    const { y } = await runs(anon, ['y']);
    assert.equal(y.length, 1);
    assert.deepEqual([y[0].starts_on, y[0].ends_on, y[0].is_current, y[0].edition_id], [day(60), day(30), false, ids.spring]);
    assert.deepEqual([y[0].end_year, y[0].end_month], ym(day(30)));
  });

  test('a drink put on a live menu starts that day; one added to a past menu ran all of it', async () => {
    const { z, t } = await runs(anon, ['z', 't']);
    assert.deepEqual([z[0].starts_on, z[0].is_current], [new Date().toISOString().slice(0, 10), true]);
    assert.deepEqual([t[0].starts_on, t[0].ends_on], [day(60), day(30)]);
  });

  test('taken off and back the next day is one run; back after a gap is two', async () => {
    const { v, u } = await runs(anon, ['v', 'u']);
    assert.equal(v.length, 1);
    assert.deepEqual([v[0].starts_on, v[0].is_current], [day(30), true]);
    assert.equal(u.length, 2);
    assert.deepEqual([u[0].starts_on, u[0].is_current], [day(5), true], 'the run on now first');
    assert.deepEqual([u[1].starts_on, u[1].ends_on, u[1].is_current], [day(30), day(20), false]);
  });

  test('drafts, coming-up menus and R&D are no run', async () => {
    const { w } = await runs(users.admin.client, ['w']);
    assert.deepEqual(w, []);
  });
});

describe('researched menus', () => {
  test('count to the month', async () => {
    const { r } = await runs(anon, ['r']);
    assert.equal(r.length, 1);
    assert.deepEqual(
      [r[0].profile_id, r[0].start_year, r[0].start_month, r[0].starts_on, r[0].end_year, r[0].end_month, r[0].ends_on, r[0].is_current],
      [ids.research, 2024, 3, null, 2024, 6, null, false]
    );
  });
});

describe('who sees them', () => {
  test("a Private page's runs are its team's", async () => {
    const before = (await db.query('SELECT page_visibility FROM public.bars WHERE id = $1', [ids.bar])).rows[0].page_visibility;
    await db.query("UPDATE public.bars SET page_visibility = 'private' WHERE id = $1", [ids.bar]);
    try {
      assert.deepEqual((await runs(anon, ['x', 'r'])).x, [], 'signed out');
      assert.deepEqual((await runs(users.stranger.client, ['x'])).x, [], 'a stranger');
      assert.equal((await runs(anon, ['r'])).r.length, 1, "another bar's still show");
      assert.equal((await runs(users.admin.client, ['x'])).x.length, 1, 'its team');
      const page = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
      assert.ifError(page.error);
      assert.deepEqual(page.data, [], 'and the bar page agrees');
    } finally {
      await db.query('UPDATE public.bars SET page_visibility = $2 WHERE id = $1', [ids.bar, before]);
    }
  });

  test("the bar page still lists the venue's started menus", async () => {
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
    assert.ifError(error);
    assert.deepEqual(data.map((e) => e.id).sort(), [ids.spring, ids.autumn].sort());
  });
});

describe('Discover', () => {
  const rank = async () => (await db.query('SELECT base_rank FROM public.discover_drink_facts WHERE item_id = $1', [ids.x])).rows[0]?.base_rank;

  test("a staffed bar's drink on its menu now is on now", async () => {
    await db.query('SELECT private.refresh_discover_facts($1)', [[ids.x]]);
    assert.ok((await rank()) < 4, 'menu tier 0');
  });

  test('a menu coming off marks its drinks, and they go to past menus', async () => {
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM private.discover_dirty WHERE item_id = $1', [ids.x]);
      await db.query("UPDATE public.menus SET ends_at = now() - interval '1 minute' WHERE id = $1", [ids.autumn]);
      const marked = await db.query('SELECT 1 FROM private.discover_dirty WHERE item_id = $1', [ids.x]);
      assert.equal(marked.rowCount, 1, 'marked for the job');
      await db.query('SELECT private.refresh_discover_facts($1)', [[ids.x]]);
      assert.ok((await rank()) >= 8, 'menu tier 2');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('a drink put on or taken off a venue menu marks it', async () => {
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM private.discover_dirty WHERE item_id = $1', [ids.x]);
      await db.query('DELETE FROM public.menu_drinks WHERE menu_id = $1 AND item_id = $2', [ids.autumn, ids.x]);
      assert.equal((await db.query('SELECT 1 FROM private.discover_dirty WHERE item_id = $1', [ids.x])).rowCount, 1);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
