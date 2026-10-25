// Close names for the main search (supabase/migrations/20261109200000_search_near.sql):
// drinks and bars in the area, people, makers (20261113600000) and ingredients; only what the plain
// search misses; a saved spelling comes back known; nothing the caller can't
// see, and nothing from a bar they hid. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run search near tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

// In the South Pacific, far from every seeded bar.
const HERE = { lat: -21.4321, lng: 179.91 };
const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@search-near-test.local`;
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

const near = (client, query, extra = {}) =>
  client.rpc('search_near', { p_query: `${query} ${run}`, p_latitude: HERE.lat, p_longitude: HERE.lng, p_radius_km: 5, ...extra });
const rows = async (client, query, extra) => {
  const { data, error } = await near(client, query, extra);
  assert.equal(error, null);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['viewer', 'creator']) users[label] = await makeUser(label);
  const bar = (row) => serviceInsert('profiles', { kind: 'bar', is_public: true, ...row, handle: `${row.handle}${run}`, display_name: `${row.display_name} ${run}` });
  ids.moth = (await bar({ handle: 'snmoth', display_name: 'Pale Moth', latitude: HERE.lat, longitude: HERE.lng, city: 'Lau', country_code: 'FJ' })).id;
  ids.far = (await bar({ handle: 'snfar', display_name: 'Far Shed', latitude: HERE.lat + 2, longitude: HERE.lng, city: 'Lau', country_code: 'FJ' })).id;
  const credited = async (name, profileId) => (await serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin_bar_profile_id: profileId })).id;
  ids.salti = await credited('Salti Boi', ids.moth);
  ids.farSalti = await credited('Salti Boy', ids.far);
  const { data: own, error } = await users.creator.client
    .from('items')
    .insert({ item_type: 'cocktail', name: `Salti Bois ${run}`, origin_bar_profile_id: ids.moth })
    .select('id')
    .single();
  if (error) throw error;
  ids.private = own.id;
  ids.person = (await serviceInsert('profiles', { kind: 'person', is_public: true, handle: `snremi${run}`, display_name: `Remi Savage ${run}` })).id;
  ids.ingredient = (await serviceInsert('items', { name: `Chartreuse ${run}`, item_type: 'ingredient' })).id;
  ids.maker = (await serviceInsert('profiles', { kind: 'maker', is_public: true, handle: `snkimura${run}`, display_name: `Kimura Glass ${run}` })).id;
  await db.query('SELECT private.run_discover_dirty(100000)');
});

after(async () => {
  const like = `%${run}%`;
  const { rows: items } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [items.map((r) => r.id)]);
  await db.query('DELETE FROM private.discover_dirty WHERE item_id = ANY($1)', [items.map((r) => r.id)]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('search_near', () => {
  test('a close drink in the area, with its bar; not one outside it, nor one you cannot see', async () => {
    const found = await rows(users.viewer.client, 'salty boy');
    const drink = found.find((r) => r.id === ids.salti);
    assert.ok(drink, 'Salti Boi is close to "salty boy"');
    assert.deepEqual([drink.kind, drink.known, drink.place], ['drink', false, `Pale Moth ${run} · Lau`]);
    assert.equal(found.some((r) => r.id === ids.farSalti), false, 'outside the area');
    assert.equal(found.some((r) => r.id === ids.private), false, 'someone else’s private drink');
    const theirs = await rows(users.creator.client, 'salty boy');
    assert.ok(theirs.some((r) => r.id === ids.private), 'your own drink is yours to find');
  });

  test('what the plain search finds is left out', async () => {
    const found = await rows(users.viewer.client, 'salti boi');
    assert.equal(found.some((r) => r.id === ids.salti), false);
  });

  test('bars, people and ingredients', async () => {
    const bar = (await rows(users.viewer.client, 'pale mouth')).find((r) => r.id === ids.moth);
    assert.deepEqual(bar && [bar.kind, bar.handle], ['bar', `snmoth${run}`]);
    const person = (await rows(users.viewer.client, 'remy savage')).find((r) => r.id === ids.person);
    assert.equal(person?.kind, 'person');
    const without = await rows(users.viewer.client, 'chartruse');
    assert.equal(without.some((r) => r.id === ids.ingredient), false, 'ingredients only when asked');
    const ingredient = (await rows(users.viewer.client, 'chartruse', { p_kinds: ['ingredient'] })).find((r) => r.id === ids.ingredient);
    assert.equal(ingredient?.kind, 'ingredient');
  });

  test('makers when asked (20261113600000)', async () => {
    const without = await rows(users.viewer.client, 'kimora glass');
    assert.equal(without.some((r) => r.id === ids.maker), false, 'makers only when asked');
    const maker = (await rows(users.viewer.client, 'kimora glass', { p_kinds: ['maker'] })).find((r) => r.id === ids.maker);
    assert.deepEqual(maker && [maker.kind, maker.handle], ['maker', `snkimura${run}`]);
  });

  test('a saved spelling comes back known, first', async () => {
    const { data: saved } = await users.viewer.client.rpc('save_spelling', { p_item_id: ids.salti, p_typed: `salty boy ${run}` });
    assert.equal(saved, true);
    const found = await rows(users.viewer.client, 'salty boy');
    assert.deepEqual([found[0].id, found[0].known], [ids.salti, true]);
  });

  test('a bar you hid keeps its drinks and itself out', async () => {
    await db.query('INSERT INTO public.hidden_bars (user_id, profile_id) VALUES ($1, $2)', [users.viewer.id, ids.moth]);
    try {
      const found = [...(await rows(users.viewer.client, 'salty boy')), ...(await rows(users.viewer.client, 'pale mouth'))];
      assert.equal(found.some((r) => r.id === ids.salti || r.id === ids.moth), false);
    } finally {
      await db.query('DELETE FROM public.hidden_bars WHERE user_id = $1', [users.viewer.id]);
    }
  });

  test('nothing typed finds nothing; signed out may not ask', async () => {
    const { data, error } = await users.viewer.client.rpc('search_near', { p_query: '   ' });
    assert.equal(error, null);
    assert.deepEqual(data, []);
    const signedOut = await near(anon, 'salty boy');
    assert.ok(signedOut.error, 'anon has no execute on search_near');
  });
});
