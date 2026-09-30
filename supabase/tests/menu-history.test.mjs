// Security tests for 20260930900000_menu_history: a bar's menu editions are
// read with its profile by anyone, and written by app admins only.
// (profile_awards has its own, profile-awards.test.mjs.)
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
  throw new Error(`Refusing to run menu history tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const barProfile = (name, extra = {}) => ({ kind: 'bar', handle: `${name}.${run}`, display_name: `${name} ${run}`, ...extra });
const edition = (profileId, extra = {}) => ({ profile_id: profileId, name: `Chapter One ${run}`, year: 2023, month: 5, ...extra });

before(async () => {
  await db.connect();
  for (const label of ['barAdmin', 'stranger', 'appAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.appAdmin.id]);
  ids.bar = (await serviceInsert('bars', { name: `Harbour ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.barAdmin.id, bar_id: ids.bar, role_level: 40 });
  ids.public = (await serviceInsert('profiles', barProfile('harbour', { bar_id: ids.bar, is_public: true }))).id;
  ids.hidden = (await serviceInsert('profiles', barProfile('hidden', { is_public: false }))).id;
  for (const id of [ids.public, ids.hidden]) await serviceInsert('profile_menu_editions', edition(id, { drinks: ['Harbour Martini'] }));
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.appAdmin?.id]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('reading', () => {
  test("signed-out visitors read a public bar's menus, not a hidden bar's", async () => {
    const { data, error } = await anon.from('profile_menu_editions').select('profile_id, drinks').in('profile_id', [ids.public, ids.hidden]);
    assert.ifError(error);
    assert.deepEqual(data, [{ profile_id: ids.public, drinks: ['Harbour Martini'] }]);
  });

  test('the hidden bar stays hidden from signed-in strangers too', async () => {
    const { data } = await users.stranger.client.from('profile_menu_editions').select('profile_id').eq('profile_id', ids.hidden);
    assert.deepEqual(data, []);
  });
});

describe('writing', () => {
  test("nobody but an app admin adds, edits or removes them, not even the bar's own admin", async () => {
    for (const who of [anon, users.stranger.client, users.barAdmin.client]) {
      const addMenu = await who.from('profile_menu_editions').insert(edition(ids.public, { name: `Sneaky ${run}` }));
      assert.ok(addMenu.error, 'menu insert refused');
      const edit = await who.from('profile_menu_editions').update({ month: 1 }).eq('profile_id', ids.public).select();
      assert.deepEqual(edit.data ?? [], [], 'menu update touches nothing');
      const drop = await who.from('profile_menu_editions').delete().eq('profile_id', ids.public).select();
      assert.deepEqual(drop.data ?? [], [], 'menu delete touches nothing');
    }
    const { rows } = await db.query('SELECT month FROM public.profile_menu_editions WHERE profile_id = $1', [ids.public]);
    assert.deepEqual(rows, [{ month: 5 }]);
  });

  test('an app admin curates them', async () => {
    const client = users.appAdmin.client;
    const add = await client.from('profile_menu_editions').insert(edition(ids.public, { name: `Chapter Two ${run}`, year: 2024 })).select().single();
    assert.ifError(add.error);
    const edit = await client.from('profile_menu_editions').update({ month: 6 }).eq('id', add.data.id).select();
    assert.ifError(edit.error);
    assert.equal(edit.data[0].month, 6);
    const drop = await client.from('profile_menu_editions').delete().eq('id', add.data.id).select();
    assert.equal(drop.data.length, 1);
  });
});

describe('shape', () => {
  test('months run 1 to 12 and may be unknown; the same edition twice is refused', async () => {
    const bad = await service.from('profile_menu_editions').insert(edition(ids.public, { name: `Thirteen ${run}`, month: 13 }));
    assert.equal(bad.error?.code, '23514');
    const yearOnly = await service.from('profile_menu_editions').insert(edition(ids.public, { name: `Year only ${run}`, month: null }));
    assert.ifError(yearOnly.error);
    const twice = await service.from('profile_menu_editions').insert(edition(ids.public, { name: `Year only ${run}`, month: null }));
    assert.equal(twice.error?.code, '23505');
  });

  test('deleting a profile takes its menus with it', async () => {
    const gone = (await serviceInsert('profiles', barProfile('gone', { is_public: true }))).id;
    await serviceInsert('profile_menu_editions', edition(gone));
    await db.query('DELETE FROM public.profiles WHERE id = $1', [gone]);
    const { rows } = await db.query(
      'SELECT count(*) AS n FROM public.profile_menu_editions WHERE profile_id = $1',
      [gone]
    );
    assert.equal(Number(rows[0].n), 0);
  });
});
