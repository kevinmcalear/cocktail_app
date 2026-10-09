// Public spec changes: a bar can show guests how a published spec changed
// (supabase/migrations/20261011160000_public_spec_changes.sql). Off by
// default, publish permission to turn on, only for a drink whose spec is
// public, and cut down to what the public spec shows.
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
  throw new Error(`Refusing to run public spec change tests against a non-local API: ${status.API_URL}`);
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
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `${label} Tester` } });
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

const changes = async (client, item = ids.drink) => {
  const { data, error } = await client.rpc('public_spec_changes', { p_item: item });
  assert.ifError(error);
  return data;
};
const setBar = (column, value) => db.query(`UPDATE public.bars SET ${column} = $2 WHERE id = $1`, [ids.bar, value]);

before(async () => {
  await db.connect();
  for (const label of ['stranger', 'admin', 'creator']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Changes bar ${run}` })).id;
  await insert('profiles', { kind: 'bar', handle: `changes${run}`, display_name: `Changes bar ${run}`, bar_id: ids.bar, is_public: true });
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await db.query("UPDATE public.bars SET default_publish_mode = 'spec' WHERE id = $1", [ids.bar]);

  ids.stir = (await insert('items', { name: `Stir ${run}`, item_type: 'method' })).id;
  ids.gin = (await insert('items', { name: `Gin ${run}`, item_type: 'ingredient' })).id;
  ids.brandGin = (await insert('items', { name: `Brand Gin ${run}`, item_type: 'ingredient', generic_id: ids.gin })).id;
  ids.housePrep = (await insert('items', { name: `Secret cordial ${run}`, item_type: 'ingredient', bar_id: ids.bar, publish_mode: 'private' })).id;
  ids.drink = (await insert('items', { name: `Changes Gimlet ${run}`, item_type: 'cocktail', bar_id: ids.bar, notes: 'Team only' })).id;
  await insert('item_methods', { item_id: ids.drink, method_item_id: ids.stir, sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.brandGin, amount: 60, unit: 'ml', sort_order: 0, preparation_notes: 'Freezer' });
  const line = (ingredient_item_id, amount, unit) => ({ id: null, ingredient_item_id, amount, unit, preparation_notes: 'Freezer', is_optional: false });
  const { error } = await users.creator.client.rpc('save_drink_spec', {
    p_item: ids.drink,
    p_lines: [line(ids.brandGin, 50, 'ml'), line(ids.housePrep, 20, 'ml')],
    p_method_ids: [ids.stir],
    p_note: 'Ask Sam before changing',
  });
  if (error) throw error;
});

after(async () => {
  for (const id of [ids.drink, ids.housePrep, ids.brandGin, ids.gin, ids.stir]) if (id) await service.from('items').delete().eq('id', id);
  await db.query('DELETE FROM public.profiles WHERE handle = $1', [`changes${run}`]);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('public_spec_changes', () => {
  test('off by default: a stranger sees none, and the table stays the team’s', async () => {
    const { rows } = await db.query('SELECT show_spec_changes FROM public.bars WHERE id = $1', [ids.bar]);
    assert.equal(rows[0].show_spec_changes, false);
    assert.deepEqual(await changes(users.stranger.client), []);
    const table = await users.stranger.client.from('item_versions').select('version').eq('item_id', ids.drink);
    assert.ifError(table.error);
    assert.equal(table.data.length, 0);
  });

  test('turning it on needs the publish permission', async () => {
    const asCreator = await users.creator.client.from('bars').update({ show_spec_changes: true }).eq('id', ids.bar).select('id');
    assert.ok(asCreator.error || asCreator.data.length === 0, 'a creator is refused');
    const asAdmin = await users.admin.client.from('bars').update({ show_spec_changes: true }).eq('id', ids.bar).select('show_spec_changes').single();
    assert.ifError(asAdmin.error);
    assert.equal(asAdmin.data.show_spec_changes, true);
  });

  test('on: a stranger sees each version, cut down to the public spec', async () => {
    const v = await changes(users.stranger.client);
    assert.deepEqual(v.map((x) => x.version), [2, 1], 'newest first');
    assert.deepEqual(Object.keys(v[0]).sort(), ['created_at', 'snapshot', 'version'], 'no note, no names');
    const [gin, prep] = v[0].snapshot.lines;
    assert.equal(gin.name, `Gin ${run}`, 'the generic, not the brand');
    assert.equal(gin.ingredient_item_id, ids.gin);
    assert.equal(Number(gin.amount), 50);
    assert.equal(gin.unit, 'ml');
    assert.equal(gin.note, null, 'no preparation notes');
    assert.equal(prep.name, null, 'a private house prep stays hidden');
    assert.equal(Number(prep.amount), 20);
    assert.deepEqual(v[0].snapshot.methods, [`Stir ${run}`]);
    assert.equal(v[0].snapshot.notes, null, 'no bartender notes');
    assert.equal(v[1].snapshot.lines.length, 1);
  });

  test('signed out sees none', async () => {
    const { data, error } = await anon.rpc('public_spec_changes', { p_item: ids.drink });
    assert.ok(error || data.length === 0);
  });

  test('none when the spec itself isn’t public', async () => {
    await setBar('page_visibility', 'description');
    assert.deepEqual(await changes(users.stranger.client), [], 'names-only page');
    await setBar('page_visibility', 'open');
    await db.query("UPDATE public.items SET publish_mode = 'description' WHERE id = $1", [ids.drink]);
    assert.deepEqual(await changes(users.stranger.client), [], 'a menu-card drink');
    await db.query('UPDATE public.items SET publish_mode = NULL WHERE id = $1', [ids.drink]);
    assert.equal((await changes(users.stranger.client)).length, 2, 'back on');
  });
});
