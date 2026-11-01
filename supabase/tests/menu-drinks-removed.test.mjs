// A drink taken off a menu that is on now is kept, with when it went on and
// came off (20261202100000_menu_drinks_removed.sql). Taking one off a draft,
// a coming-up or a past menu keeps nothing, and so do deleting a menu or a
// drink, a drink that stays in the same save, and an item merge. Only the
// menu's readers read the record, and nobody writes it. Runs through the
// real API (and SQL for the merge) against the local stack.
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
  throw new Error(`Refusing to run removed-drink tests against a non-local stack: ${status.API_URL}`);
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

async function makeUser(label) {
  const email = `${label}-${run}@menu-removed-test.local`;
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

/** A menu with one section holding these drinks, the first priced 22 on the menu. */
async function menu(label, dates, itemIds) {
  const m = await insert('menus', { bar_id: ids.bar, name: `${label} ${run}`, ...dates });
  const section = await insert('menu_sections', { menu_id: m.id, name: 'Stirred', sort_order: 0 });
  for (const [i, item_id] of itemIds.entries()) {
    await insert('menu_drinks', { menu_id: m.id, menu_section_id: section.id, item_id, sort_order: i, price: i === 0 ? '22' : null });
  }
  return { id: m.id, section: section.id };
}

/** save_menu as the app calls it, keeping only these drinks. */
function save(client, m, itemIds) {
  return client.rpc('save_menu', {
    p_menu_id: m.id,
    p_name: `Saved ${run}`,
    p_cover_url: null,
    p_cover_position: 50,
    p_sections: [{ id: m.section, name: 'Stirred', min_items: 0, max_items: null, allowed_types: ['cocktail'], item_ids: itemIds }],
  });
}

async function removed(menuId) {
  const { rows } = await db.query('SELECT * FROM public.menu_drinks_removed WHERE menu_id = $1 ORDER BY came_off', [menuId]);
  return rows;
}

before(async () => {
  await db.connect();
  users.admin = await makeUser('admin');
  users.member = await makeUser('member');
  users.stranger = await makeUser('stranger');
  ids.bar = (await insert('bars', { name: `Removed drinks bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.member.id, bar_id: ids.bar, role_level: 10 });
  for (const name of ['negroni', 'collins', 'martini', 'sazerac', 'copy']) {
    ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar, price: '18' })).id;
  }
  const now = Date.now();
  ids.live = await menu('Live', { starts_at: new Date(now - 3 * DAY).toISOString() }, [ids.negroni, ids.collins, ids.martini]);
  ids.draft = await menu('Draft', {}, [ids.negroni, ids.collins]);
  ids.coming = await menu('Coming up', { starts_at: new Date(now + DAY).toISOString() }, [ids.negroni, ids.collins]);
  ids.past = await menu('Past', { starts_at: new Date(now - 10 * DAY).toISOString(), ends_at: new Date(now - 2 * DAY).toISOString() }, [ids.negroni, ids.collins]);
});

after(async () => {
  for (const m of [ids.live, ids.draft, ids.coming, ids.past, ids.doomed]) if (m) await service.from('menus').delete().eq('id', m.id);
  for (const name of ['negroni', 'collins', 'martini', 'sazerac', 'copy']) if (ids[name]) await service.from('items').delete().eq('id', ids[name]);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a drink taken off a menu', () => {
  test('off a draft, a coming-up or a past menu: nothing kept', async () => {
    for (const m of [ids.draft, ids.coming, ids.past]) {
      assert.ifError((await save(users.admin.client, m, [ids.negroni])).error);
      assert.deepEqual(await removed(m.id), [], 'nothing kept');
    }
  });

  test('off a live menu: one row, and the drinks that stay keep nothing', async () => {
    const before = (await db.query('SELECT md.created_at, m.starts_at FROM public.menu_drinks md JOIN public.menus m ON m.id = md.menu_id WHERE md.menu_id = $1 AND md.item_id = $2', [ids.live.id, ids.negroni])).rows[0];
    assert.ifError((await save(users.admin.client, ids.live, [ids.collins, ids.martini])).error);
    const rows = await removed(ids.live.id);
    assert.equal(rows.length, 1, 'only the drink taken off');
    const [r] = rows;
    assert.equal(r.item_id, ids.negroni);
    assert.equal(r.section_name, 'Stirred');
    assert.equal(r.price, '22', "the menu's own price");
    assert.equal(r.taken_off_by, users.admin.id);
    const wentOn = Math.max(before.created_at.getTime(), before.starts_at.getTime());
    assert.equal(r.went_on.getTime(), wentOn, 'went on when its row was made, or the menu started');
    assert.ok(Math.abs(r.came_off.getTime() - Date.now()) < 60000, 'came off now');
  });

  test("a drink with no menu price keeps the drink's", async () => {
    assert.ifError((await save(users.admin.client, ids.live, [ids.martini])).error);
    const rows = await removed(ids.live.id);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].item_id, ids.collins);
    assert.equal(rows[1].price, '18');
  });

  test('a drink put back and kept writes nothing more', async () => {
    assert.ifError((await save(users.admin.client, ids.live, [ids.martini, ids.sazerac])).error);
    assert.ifError((await save(users.admin.client, ids.live, [ids.sazerac, ids.martini])).error);
    assert.equal((await removed(ids.live.id)).length, 2);
  });

  test('a live menu is never deleted in the app; a script deleting one keeps nothing, and its record goes with it', async () => {
    ids.doomed = await menu('Doomed', { starts_at: new Date(Date.now() - DAY).toISOString() }, [ids.negroni, ids.collins]);
    assert.ifError((await save(users.admin.client, ids.doomed, [ids.collins])).error);
    assert.equal((await removed(ids.doomed.id)).length, 1);
    // A list that ran is ended and hidden, never deleted (20261203100000).
    const refused = await users.admin.client.from('menus').delete().eq('id', ids.doomed.id).select('id');
    assert.ifError(refused.error);
    assert.equal(refused.data.length, 0, 'its Admin may not delete it');
    const del = await service.from('menus').delete().eq('id', ids.doomed.id).select('id');
    assert.ifError(del.error);
    assert.equal(del.data.length, 1, 'the menu is gone');
    assert.deepEqual(await removed(ids.doomed.id), []);
    ids.doomed = null;
  });

  test('deleting a drink on a live menu keeps nothing', async () => {
    const gone = await insert('items', { name: `gone ${run}`, item_type: 'cocktail', bar_id: ids.bar });
    await insert('menu_drinks', { menu_id: ids.live.id, menu_section_id: ids.live.section, item_id: gone.id, sort_order: 9 });
    const del = await service.from('items').delete().eq('id', gone.id);
    assert.ifError(del.error);
    assert.equal((await db.query('SELECT 1 FROM public.menu_drinks_removed WHERE item_id = $1', [gone.id])).rowCount, 0);
  });

  test('an item merge moves the record and keeps nothing new', async () => {
    await insert('menu_drinks', { menu_id: ids.live.id, menu_section_id: ids.live.section, item_id: ids.copy, sort_order: 5 });
    const count = (await removed(ids.live.id)).length;
    await db.query('SELECT private.merge_item($1, $2)', [ids.copy, ids.sazerac]);
    ids.copy = null;
    assert.equal((await removed(ids.live.id)).length, count, 'the merge took nothing off');
    await db.query('SELECT private.merge_item($1, $2)', [ids.negroni, ids.martini]);
    ids.negroni = null;
    const rows = await removed(ids.live.id);
    assert.equal(rows.length, count);
    assert.ok(rows.some((r) => r.item_id === ids.martini && r.price === '22'), "the merged drink's record follows it");
  });
});

describe('who reads it', () => {
  test("the bar's members read it", async () => {
    for (const u of [users.admin, users.member]) {
      const { data, error } = await u.client.from('menu_drinks_removed').select('item_id').eq('menu_id', ids.live.id);
      assert.ifError(error);
      assert.equal(data.length, 2);
    }
  });

  test('a stranger and anon read nothing', async () => {
    const mine = await users.stranger.client.from('menu_drinks_removed').select('id').eq('menu_id', ids.live.id);
    assert.ifError(mine.error);
    assert.equal(mine.data.length, 0);
    const out = await anon.from('menu_drinks_removed').select('id').eq('menu_id', ids.live.id);
    assert.ok(out.error || out.data.length === 0, 'anon reads nothing');
  });

  test('nobody writes it, not even its menu\'s Admin', async () => {
    const add = await users.admin.client.from('menu_drinks_removed').insert({ menu_id: ids.live.id, item_id: ids.martini, went_on: new Date().toISOString() });
    assert.ok(add.error, 'no insert');
    const change = await users.admin.client.from('menu_drinks_removed').update({ price: '1' }).eq('menu_id', ids.live.id).select('id');
    assert.ok(change.error || change.data.length === 0, 'no update');
    const drop = await users.admin.client.from('menu_drinks_removed').delete().eq('menu_id', ids.live.id).select('id');
    assert.ok(drop.error || drop.data.length === 0, 'no delete');
    assert.equal((await removed(ids.live.id)).length, 2);
  });
});
