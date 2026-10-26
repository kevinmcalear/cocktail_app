// Notes by role (supabase/migrations/20261123300000_notes_by_role.sql): a
// venue drink's notes go to a role and everyone above it. Each level reads
// what is for it and nothing above, through the table and the view; View as
// lowers what you read; an ended role reads nothing more than a guest; the
// writer always reads their own; only the drink's editors write, and never a
// note they can't read; a role level is for venue drinks only; versions keep
// role notes out; an installed app's items.notes writes reach item_notes
// until 20261123310000 drops the column; the view keeps its columns. Runs
// through the real API against the local stack.
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run notes by role tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

// Who sits where at the venue. `takeover` holds a Bartender-level role that has ended.
const LEVELS = { admin: 40, creator: 35, bartender: 30, employee: 20, guest: 10 };
// One note per level; null is everyone who sees the drink.
const NOTE_LEVELS = [null, 20, 30, 35, 40];
const noteText = (level) => `For ${level ?? 'everyone'} ${run}`;

async function makeUser(label) {
  const email = `${label}-${run}@notes-by-role-test.local`;
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

/** The notes a client reads on each of the level drinks, from the table and from the view. */
async function readsAt(client) {
  const drinkIds = NOTE_LEVELS.map((l) => ids.drinks[String(l)]);
  const table = await client.from('item_notes').select('item_id, body').in('item_id', drinkIds);
  assert.ifError(table.error);
  const view = await client.from('app_item_presentation').select('id, notes').in('id', drinkIds);
  assert.ifError(view.error);
  const fromTable = NOTE_LEVELS.filter((l) => table.data.some((r) => r.item_id === ids.drinks[String(l)] && r.body === noteText(l)));
  const fromView = NOTE_LEVELS.filter((l) => view.data.some((r) => r.id === ids.drinks[String(l)] && r.notes === noteText(l)));
  assert.deepEqual(fromView, fromTable, 'the view gives the same notes as the table');
  return fromTable;
}

before(async () => {
  await db.connect();
  for (const label of [...Object.keys(LEVELS), 'takeover', 'stranger', 'homeCook']) users[label] = await makeUser(label);
  // Everyone at the venue sees every drink (the menu at Guest), so only the notes differ.
  ids.bar = (await insert('bars', { name: `Notes by role bar ${run}`, default_visibility_level: 10 })).id;
  for (const [label, level] of Object.entries(LEVELS)) await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: level });
  ids.takeoverRole = (await insert('venue_roles', { bar_id: ids.bar, name: `Takeover ${run}`, base_level: 30, ends_at: new Date(Date.now() + 86_400_000).toISOString() })).id;
  await insert('user_bars', { user_id: users.takeover.id, bar_id: ids.bar, role_level: 30, venue_role_id: ids.takeoverRole });
  ids.drinks = {};
  for (const level of NOTE_LEVELS) {
    const drink = await insert('items', { name: `Level ${level ?? 'all'} ${run}`, item_type: 'cocktail', bar_id: ids.bar });
    ids.drinks[String(level)] = drink.id;
    await insert('item_notes', { item_id: drink.id, body: noteText(level), read_level: level });
  }
  ids.home = (await insert('items', { name: `Home drink ${run}`, item_type: 'cocktail', created_by: users.homeCook.id })).id;
});

after(async () => {
  for (const id of [...Object.values(ids.drinks ?? {}), ids.home]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('each role reads its level and below', () => {
  const expected = {
    admin: [null, 20, 30, 35, 40],
    creator: [null, 20, 30, 35],
    bartender: [null, 20, 30],
    employee: [null, 20],
    guest: [null],
  };
  for (const [label, levels] of Object.entries(expected)) {
    test(`${label} (${LEVELS[label]})`, async () => {
      assert.deepEqual(await readsAt(users[label].client), levels);
    });
  }

  test('a venue role counts at its level while it lasts, and not after it ends', async () => {
    assert.deepEqual(await readsAt(users.takeover.client), [null, 20, 30]);
    await service.from('venue_roles').update({ ends_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', ids.takeoverRole);
    // An ended role doesn't see the venue's drinks at all, so nothing.
    assert.deepEqual(await readsAt(users.takeover.client), []);
  });

  test('someone outside the venue and a signed-out visitor read nothing', async () => {
    assert.deepEqual(await readsAt(users.stranger.client), []);
    const { data, error } = await anon.from('item_notes').select('body').in('item_id', Object.values(ids.drinks));
    assert.ifError(error);
    assert.deepEqual(data, []);
  });
});

test('View as lowers what an Admin reads, and putting it back restores it', async () => {
  await db.query(
    `INSERT INTO public.user_prefs (user_id, view_as_role_level) VALUES ($1, 30)
     ON CONFLICT (user_id) DO UPDATE SET view_as_role_level = 30`,
    [users.admin.id]
  );
  try {
    assert.deepEqual(await readsAt(users.admin.client), [null, 20, 30]);
  } finally {
    await db.query('UPDATE public.user_prefs SET view_as_role_level = NULL WHERE user_id = $1', [users.admin.id]);
  }
  assert.deepEqual(await readsAt(users.admin.client), [null, 20, 30, 35, 40]);
});

describe('writing', () => {
  test("a Bartender can't write notes (no drink editing)", async () => {
    const drink = ids.drinks['20'];
    const { error } = await users.bartender.client.from('item_notes').update({ body: 'Changed.' }).eq('item_id', drink).select();
    const { data } = await service.from('item_notes').select('body').eq('item_id', drink).single();
    assert.equal(data.body, noteText(20), error?.message);
    const insert = await users.bartender.client.from('item_notes').insert({ item_id: ids.home, body: 'Mine now.' });
    assert.ok(insert.error, 'nor on a drink that is not theirs');
  });

  test('a Drink Creator writes for Admins only and still reads it, as its writer', async () => {
    const drink = (await insert('items', { name: `Creator's drink ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
    ids.drinks.creators = drink;
    const { error } = await users.creator.client.from('item_notes').insert({ item_id: drink, body: 'Ask Rob first.', read_level: 40 });
    assert.ifError(error);
    const { data } = await users.creator.client.from('item_notes').select('body, read_level, updated_by').eq('item_id', drink).single();
    assert.deepEqual(data, { body: 'Ask Rob first.', read_level: 40, updated_by: users.creator.id });
    const bartender = await users.bartender.client.from('item_notes').select('body').eq('item_id', drink);
    assert.deepEqual(bartender.data, []);
    // Looking through View as, the writer sees what that role sees.
    await db.query(
      `INSERT INTO public.user_prefs (user_id, view_as_role_level) VALUES ($1, 30)
       ON CONFLICT (user_id) DO UPDATE SET view_as_role_level = 30`,
      [users.creator.id]
    );
    try {
      assert.deepEqual((await users.creator.client.from('item_notes').select('body').eq('item_id', drink)).data, []);
    } finally {
      await db.query('UPDATE public.user_prefs SET view_as_role_level = NULL WHERE user_id = $1', [users.creator.id]);
    }
  });

  test("an editor can't change or remove a note they can't read", async () => {
    const drink = ids.drinks['40'];
    const { data: changed } = await users.creator.client.from('item_notes').update({ body: 'Overwritten.' }).eq('item_id', drink).select();
    assert.deepEqual(changed ?? [], []);
    const { data: gone } = await users.creator.client.from('item_notes').delete().eq('item_id', drink).select();
    assert.deepEqual(gone ?? [], []);
    const insert = await users.creator.client.from('item_notes').insert({ item_id: drink, body: 'Overwritten.' });
    assert.ok(insert.error, 'nor can a new note replace it');
    const { data } = await service.from('item_notes').select('body').eq('item_id', drink).single();
    assert.equal(data.body, noteText(40));
  });

  test('an Admin changes the level; the writer and time are set by the database', async () => {
    const drink = ids.drinks['30'];
    const { error } = await users.admin.client.from('item_notes').update({ read_level: 35 }).eq('item_id', drink);
    assert.ifError(error);
    const { data } = await service.from('item_notes').select('read_level, updated_by').eq('item_id', drink).single();
    assert.deepEqual(data, { read_level: 35, updated_by: users.admin.id });
    assert.deepEqual((await users.bartender.client.from('item_notes').select('body').eq('item_id', drink)).data, []);
    await service.from('item_notes').update({ read_level: 30 }).eq('item_id', drink);
    const forged = await users.admin.client.from('item_notes').update({ updated_by: users.guest.id }).eq('item_id', drink);
    assert.ok(forged.error, 'who wrote it is not the client’s to say');
  });

  test('a home drink takes notes for everyone only', async () => {
    const cook = users.homeCook.client;
    const ranked = await cook.from('item_notes').insert({ item_id: ids.home, body: 'Bartenders only.', read_level: 30 });
    assert.ok(ranked.error, 'no role level off a venue');
    const { error } = await cook.from('item_notes').insert({ item_id: ids.home, body: 'Stir longer.' });
    assert.ifError(error);
    assert.deepEqual((await cook.from('app_item_presentation').select('notes').eq('id', ids.home).single()).data, { notes: 'Stir longer.' });
    assert.deepEqual((await users.stranger.client.from('item_notes').select('body').eq('item_id', ids.home)).data, [], 'a private drink keeps its notes');
  });

  test('levels are only the venue roles, and a note is never empty', async () => {
    const drink = ids.drinks.creators;
    for (const read_level of [10, 25, 50]) {
      const { error } = await users.admin.client.from('item_notes').update({ read_level }).eq('item_id', drink);
      assert.ok(error, `level ${read_level}`);
    }
    const { error } = await users.admin.client.from('item_notes').update({ body: '  ' }).eq('item_id', drink);
    assert.ok(error, 'blank');
  });
});

describe('installed apps, which still write items.notes', () => {
  const kept = async (id) => (await db.query('SELECT body, read_level FROM public.item_notes WHERE item_id = $1', [id])).rows[0] ?? null;

  test('their notes become the drink\'s, and an empty box clears them', async () => {
    const cook = users.homeCook.client;
    let { error } = await cook.from('items').update({ notes: 'Old app: stir 30 seconds.' }).eq('id', ids.home);
    assert.ifError(error);
    assert.deepEqual(await kept(ids.home), { body: 'Old app: stir 30 seconds.', read_level: null });
    // An update that doesn't send notes leaves them.
    ({ error } = await cook.from('items').update({ description: 'Short and cold.' }).eq('id', ids.home));
    assert.ifError(error);
    assert.equal((await kept(ids.home)).body, 'Old app: stir 30 seconds.');
    ({ error } = await cook.from('items').update({ notes: '' }).eq('id', ids.home));
    assert.ifError(error);
    assert.equal(await kept(ids.home), null);
  });

  test('a changed note keeps its role level', async () => {
    const drink = ids.drinks['35'];
    const { error } = await users.admin.client.from('items').update({ notes: 'Old app edit.' }).eq('id', drink);
    assert.ifError(error);
    assert.deepEqual(await kept(drink), { body: 'Old app edit.', read_level: 35 });
    await service.from('item_notes').update({ body: noteText(35) }).eq('item_id', drink);
  });

  test('an empty box over a note above you leaves it alone', async () => {
    const drink = ids.drinks['40'];
    const { error } = await users.creator.client.from('items').update({ notes: '' }).eq('id', drink);
    assert.ifError(error);
    assert.deepEqual(await kept(drink), { body: noteText(40), read_level: 40 });
    await users.creator.client.from('items').update({ notes: 'Mine instead.' }).eq('id', drink);
    assert.equal((await kept(drink)).body, noteText(40));
  });

  test('a new drink with notes gets them', async () => {
    const { data, error } = await users.homeCook.client
      .from('items')
      .insert({ name: `Old app drink ${run}`, item_type: 'cocktail', notes: 'Built in the glass.' })
      .select('id')
      .single();
    assert.ifError(error);
    ids.drinks.oldApp = data.id;
    assert.deepEqual(await kept(data.id), { body: 'Built in the glass.', read_level: null });
  });
});

test("the view keeps every column it had, with notes from item_notes", async () => {
  // 20261113900000's columns. Wave 2 migrations that redefine the view
  // (Made in parts, show_sketch, this one) may add, never drop.
  const before = ['id', 'name', 'item_type', 'description', 'created_at', 'glassware_id', 'family_id', 'ice_id', 'notes', 'origin', 'price', 'status',
    'brand_maker', 'abv', 'bar_id', 'icon_key', 'icon_url', 'hide_from_search', 'origin_bar_profile_id', 'created_by', 'creator_profile_id', 'generic_id',
    'service_style', 'density_g_ml', 'dilution_pct', 'serve_ml', 'serve_abv', 'abv_source', 'capacity_ml', 'iced_capacity_ml', 'ice_per_serve_g', 'is_core',
    'ingredient_role', 'made_from_id', 'method_ice_id', 'ice_build', 'picture', 'picture_url'];
  const { rows } = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_item_presentation'"
  );
  const has = new Set(rows.map((r) => r.column_name));
  assert.deepEqual(before.filter((c) => !has.has(c)), []);
  const { rows: def } = await db.query("SELECT pg_get_viewdef('public.app_item_presentation'::regclass) AS d");
  assert.match(def[0].d, /item_notes/);
  assert.doesNotMatch(def[0].d, /credited_drink_notes/);
});

test('versions keep notes for everyone and leave role notes out', async () => {
  const snap = async (key) => (await db.query("SELECT private.drink_snapshot($1) ->> 'notes' AS notes", [ids.drinks[key]])).rows[0].notes;
  assert.equal(await snap('null'), noteText(null));
  assert.equal(await snap('35'), null);
});

test('notes go with their drink', async () => {
  const drink = ids.drinks['20'];
  await service.from('items').delete().eq('id', drink);
  const { data } = await service.from('item_notes').select('item_id').eq('item_id', drink);
  assert.deepEqual(data, []);
});
