// Notes on a bar's credited drinks follow the bar's page, like the spec rows:
// hidden from the public while the page isn't open, shown to catalog admins
// and the bar's team (supabase/migrations/20261008050000_credited_drink_notes.sql).
// Since 20261122300000_notes_by_role they live in item_notes with every other
// drink's notes, and the page rule is part of its policy.
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run credited notes tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: {} };
const NOTE = { locked: 'Method: stir, strain over a big cube.', unclaimed: 'Method: shake hard.', open: 'Method: build in the glass.' };

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

/** What a client gets for a drink's notes from each place it could read them. */
async function notesFor(client, key) {
  const id = ids.items[key];
  const view = await client.from('app_item_presentation').select('notes').eq('id', id);
  const table = await client.from('item_notes').select('body').eq('item_id', id);
  return {
    view: view.data?.[0]?.notes ?? null,
    table: table.data?.[0]?.body ?? null,
  };
}

const keptNotes = async (key) =>
  (await db.query('SELECT body FROM public.item_notes WHERE item_id = $1', [ids.items[key]])).rows[0]?.body ?? null;

before(async () => {
  await db.connect();
  for (const label of ['stranger', 'team', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);

  // An unclaimed bar, a claimed bar that picked Locked, and a claimed open one.
  ids.unclaimed = (await serviceInsert('profiles', { kind: 'bar', handle: `owl${run}`, display_name: `Night Owl ${run}`, is_public: true })).id;
  ids.lockedBar = (await serviceInsert('bars', { name: `Copper Still ${run}` })).id;
  ids.locked = (await serviceInsert('profiles', { kind: 'bar', handle: `copper${run}`, display_name: `Copper Still ${run}`, bar_id: ids.lockedBar, is_public: true })).id;
  await db.query("UPDATE public.bars SET page_visibility = 'locked' WHERE id = $1", [ids.lockedBar]);
  ids.openBar = (await serviceInsert('bars', { name: `Open Door ${run}` })).id;
  ids.open = (await serviceInsert('profiles', { kind: 'bar', handle: `door${run}`, display_name: `Open Door ${run}`, bar_id: ids.openBar, is_public: true })).id;
  await serviceInsert('user_bars', { user_id: users.team.id, bar_id: ids.lockedBar, role_level: 10 });

  // Seeded the way the 50 Best signatures are: shared, credited to the bar, with notes.
  const item = async (row, notes) => {
    const id = (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
    if (notes) await serviceInsert('item_notes', { item_id: id, body: notes });
    return id;
  };
  ids.items.locked = await item({ name: `Copper Sour ${run}`, description: 'Bright and tart.', origin_bar_profile_id: ids.locked }, NOTE.locked);
  ids.items.unclaimed = await item({ name: `Owl Daiquiri ${run}`, origin_bar_profile_id: ids.unclaimed }, NOTE.unclaimed);
  ids.items.open = await item({ name: `Door Highball ${run}`, origin_bar_profile_id: ids.open }, NOTE.open);
  ids.items.classic = await item({ name: `Classic ${run}`, origin_bar_profile_id: ids.unclaimed, is_catalog: true }, 'Spec from Punch.');
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.catalogAdmin?.id]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe("a credited drink's notes live behind the page", () => {
  test('signed out: nothing from the view or the notes table', async () => {
    for (const key of ['locked', 'unclaimed', 'open']) {
      assert.deepEqual(await notesFor(anon, key), { view: null, table: null }, key);
    }
    // The public projection has no notes column at all.
    assert.ok((await anon.from('published_items').select('notes').eq('id', ids.items.locked)).error);
  });

  test("a signed-in stranger can't read a locked drink's notes", async () => {
    for (const key of ['locked', 'unclaimed']) {
      assert.deepEqual(await notesFor(users.stranger.client, key), { view: null, table: null }, key);
    }
    // A Locked page's drink is its team's alone in items
    // (20261010100000_bar_page_direct_reads.sql); its card still reads: name and credit.
    const row = await users.stranger.client.from('published_items').select('name, origin_bar_profile_id').eq('id', ids.items.locked).eq('is_reference', false).single();
    assert.ifError(row.error);
    assert.equal(row.data.origin_bar_profile_id, ids.locked);
  });

  test("the bar's team reads its own drink's notes", async () => {
    assert.deepEqual(await notesFor(users.team.client, 'locked'), { view: NOTE.locked, table: NOTE.locked });
    // Not another bar's.
    assert.equal((await notesFor(users.team.client, 'unclaimed')).view, null);
  });

  test('a catalog admin reads them all', async () => {
    for (const key of ['locked', 'unclaimed', 'open']) {
      assert.equal((await notesFor(users.catalogAdmin.client, key)).view, NOTE[key], key);
    }
  });

  test("an open bar's drink shows its notes to anyone signed in, and a classic's are everyone's", async () => {
    assert.deepEqual(await notesFor(users.stranger.client, 'open'), { view: NOTE.open, table: NOTE.open });
    assert.equal((await notesFor(users.stranger.client, 'classic')).view, 'Spec from Punch.');
  });

  test('locking the open bar hides them again', async () => {
    await db.query("UPDATE public.bars SET page_visibility = 'description' WHERE id = $1", [ids.openBar]);
    assert.deepEqual(await notesFor(users.stranger.client, 'open'), { view: null, table: null });
    await db.query("UPDATE public.bars SET page_visibility = 'open' WHERE id = $1", [ids.openBar]);
  });
});

describe('editing a credited drink', () => {
  test('a catalog admin writes and clears the notes; they stay behind the page', async () => {
    let { error } = await users.catalogAdmin.client.from('item_notes').update({ body: 'Method: dry shake first.' }).eq('item_id', ids.items.unclaimed);
    assert.ifError(error);
    assert.equal(await keptNotes('unclaimed'), 'Method: dry shake first.');
    assert.equal((await notesFor(users.stranger.client, 'unclaimed')).view, null);
    // An update to the drink doesn't touch them.
    await users.catalogAdmin.client.from('items').update({ description: 'Crisp.' }).eq('id', ids.items.unclaimed);
    assert.equal(await keptNotes('unclaimed'), 'Method: dry shake first.');

    ({ error } = await users.catalogAdmin.client.from('item_notes').delete().eq('item_id', ids.items.unclaimed));
    assert.ifError(error);
    assert.equal(await keptNotes('unclaimed'), null);
    await serviceInsert('item_notes', { item_id: ids.items.unclaimed, body: NOTE.unclaimed });
  });

  test('a stranger cannot write the notes', async () => {
    const insert = await users.stranger.client.from('item_notes').insert({ item_id: ids.items.classic, body: 'x' });
    assert.ok(insert.error);
    await users.stranger.client.from('item_notes').update({ body: 'x' }).eq('item_id', ids.items.open);
    assert.equal(await keptNotes('open'), NOTE.open);
  });

  test('versions snapshot the notes, and restoring one without notes clears them', async () => {
    const { rows } = await db.query("SELECT private.drink_snapshot($1) ->> 'notes' AS notes", [ids.items.locked]);
    assert.equal(rows[0].notes, NOTE.locked);
    const empty = { lines: [], method_ids: [], notes: null };
    await db.query('INSERT INTO public.item_versions (item_id, version, snapshot) VALUES ($1, 1, $2)', [ids.items.locked, empty]);
    const { error } = await users.catalogAdmin.client.rpc('restore_drink_version', { p_item: ids.items.locked, p_version: 1 });
    assert.ifError(error);
    assert.equal(await keptNotes('locked'), null);
    await serviceInsert('item_notes', { item_id: ids.items.locked, body: NOTE.locked });
  });

  test('a drink that stops being credited (made a classic) keeps its notes, read like any classic', async () => {
    await db.query('UPDATE public.items SET is_catalog = true WHERE id = $1', [ids.items.locked]);
    assert.equal((await notesFor(users.stranger.client, 'locked')).view, NOTE.locked);
    await db.query('UPDATE public.items SET is_catalog = false WHERE id = $1', [ids.items.locked]);
    assert.equal((await notesFor(users.stranger.client, 'locked')).view, null);
  });
});
