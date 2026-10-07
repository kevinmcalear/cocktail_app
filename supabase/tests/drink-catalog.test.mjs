// The drink catalog (20260928100000_drink_catalog.sql): shared classics that
// only catalog admins can curate, and that a venue's editors can link their
// own drinks to. Runs through the real API as real users.
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
  throw new Error(`Refusing to run drink catalog tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

// Other test files add catalog fixtures named with their run id (no origin,
// and an automatic sketch job), and they run in parallel with this one.
// Assertions about the seeded classics leave those out.
const FIXTURE_NAME = / [0-9a-f]{8}$/;

const users = {};
const ids = {};
const itemIds = [];

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

before(async () => {
  await db.connect();
  for (const label of ['maker', 'bartender', 'homeUser', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);

  ids.bar = (await serviceInsert('bars', { name: `Catalog Bar ${run}` })).id;
  await service.from('user_bars').insert([
    { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 },
    { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 },
  ]);
  const drink = await serviceInsert('items', { name: `House Martini ${run}`, item_type: 'cocktail', bar_id: ids.bar, created_by: users.maker.id });
  ids.barDrink = drink.id;
  itemIds.push(drink.id);
  const { data: martini } = await service.from('items').select('id').eq('is_catalog', true).ilike('name', 'martini').single();
  ids.martini = martini.id;
});

after(async () => {
  if (itemIds.length) await service.from('items').delete().in('id', itemIds);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.catalogAdmin?.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('drink catalog', () => {
  test('ships the classics, readable by anyone signed in but not signed out', async () => {
    const { data, error } = await users.homeUser.client.from('items').select('name, origin').eq('is_catalog', true);
    assert.ifError(error);
    const names = new Set(data.map((r) => r.name));
    for (const n of ['Martini', 'Negroni', 'Old Fashioned', 'Penicillin', 'Espresso Martini']) assert.ok(names.has(n), `${n} is in the catalog`);
    const seeded = data.filter((r) => !FIXTURE_NAME.test(r.name));
    assert.deepEqual(seeded.filter((r) => r.origin !== 'Classic' && r.origin !== 'Modern Classic'), []);

    const { data: signedOut } = await anon.from('items').select('id').eq('is_catalog', true);
    assert.deepEqual(signedOut ?? [], []);
  });

  test('queued no automatic sketches for the seeded classics', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM private.item_image_jobs j JOIN public.items i ON i.id = j.item_id
       WHERE i.is_catalog AND i.name !~ $1`,
      [FIXTURE_NAME.source]
    );
    assert.equal(rows[0].n, 0);
  });

  test('nobody but a catalog admin can add to it', async () => {
    const { error } = await users.homeUser.client
      .from('items')
      .insert({ name: `My Classic ${run}`, item_type: 'cocktail', is_catalog: true, created_by: users.homeUser.id });
    assert.match(error?.message ?? '', /Only catalog admins/);

    const { data, error: adminError } = await users.catalogAdmin.client
      .from('items')
      .insert({ name: `Admin Classic ${run}`, item_type: 'cocktail', origin: 'Classic', is_catalog: true, created_by: users.catalogAdmin.id })
      .select('id')
      .single();
    assert.ifError(adminError);
    itemIds.push(data.id);
  });

  test("a person can't promote their own shared drink into it", async () => {
    const { data: mine, error } = await users.homeUser.client
      .from('items')
      .insert({ name: `Home Riff ${run}`, item_type: 'cocktail', created_by: users.homeUser.id })
      .select('id')
      .single();
    assert.ifError(error);
    itemIds.push(mine.id);
    const { error: promote } = await users.homeUser.client.from('items').update({ is_catalog: true }).eq('id', mine.id);
    assert.match(promote?.message ?? '', /Only catalog admins/);
  });

  test("its entries can't be renamed or deleted by venue staff", async () => {
    const { data: renamed } = await users.maker.client.from('items').update({ name: 'Mine now' }).eq('id', ids.martini).select('id');
    assert.deepEqual(renamed ?? [], []);
    const { data: deleted } = await users.maker.client.from('items').delete().eq('id', ids.martini).select('id');
    assert.deepEqual(deleted ?? [], []);
    const { data: still } = await service.from('items').select('name').eq('id', ids.martini).single();
    assert.equal(still.name, 'Martini');
  });

  test('never belongs to a venue', async () => {
    const { error } = await service.from('items').update({ bar_id: ids.bar }).eq('id', ids.martini);
    assert.match(error?.message ?? '', /items_catalog_is_shared/);
  });

  test("a venue's editors can link its drink to a classic; bartenders can't", async () => {
    const { data: byBartender } = await users.bartender.client.from('items').update({ riff_of_id: ids.martini }).eq('id', ids.barDrink).select('id');
    assert.deepEqual(byBartender ?? [], []);

    const { data, error } = await users.maker.client
      .from('items')
      .update({ riff_of_id: ids.martini })
      .eq('id', ids.barDrink)
      .select('riff_of:riff_of_id ( name, is_catalog )')
      .single();
    assert.ifError(error);
    assert.deepEqual(data.riff_of, { name: 'Martini', is_catalog: true });
  });
});
