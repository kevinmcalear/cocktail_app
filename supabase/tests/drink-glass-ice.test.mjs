// One glass and one ice record per drink (20261204300000_one_home.sql,
// section "One glass and one ice record per drink"): drink_glass and
// drink_ice hold a drink's glass and ice; old builds still write items, and
// each side copies to the other without looping; a write to the new rows
// still redraws and queues the drawing jobs through items; a glass is a
// glassware item and every ice an ice item; whoever reads the drink reads
// them, only its editors write them, anon nothing; merges move ice layers.
// Runs through the real API (and SQL for merges and jobs) against the local
// stack.
//
// Copy into the repo as supabase/tests/drink-glass-ice.test.mjs:
// supabase/tests/glass-ice.test.mjs already exists (the Glass sheet).
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
  throw new Error(`Refusing to run glass and ice tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

const INPUTS = {
  v: 2, glass: 'coupe', ice: 'none', method: 'shake', liquid: { hex: '#efe3b0', alpha: 0.2 },
  foam: null, float: null, bleed: null, fizz: false, garnish: null,
  from: { glass: 'data', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1,
};

async function makeUser(label) {
  const email = `${label}-${run}@drink-glass-ice-test.local`;
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

const item = async (name, fields) => (await insert('items', { name: `${name} ${run}`, ...fields })).id;
const one = async (sql, params) => (await db.query(sql, params)).rows[0] ?? null;
const GLASS = 'glassware_id, glass_model_id, sketch_variant';
const ICE = 'ice_id, method_ice_id, ice_build, ice_per_serve_g';
const itemsGlass = (id) => one(`SELECT ${GLASS} FROM public.items WHERE id = $1`, [id]);
const itemsIce = (id) => one(`SELECT ${ICE} FROM public.items WHERE id = $1`, [id]);
const rowGlass = (id) => one(`SELECT ${GLASS} FROM public.drink_glass WHERE item_id = $1`, [id]);
const rowIce = (id) => one(`SELECT ${ICE} FROM public.drink_ice WHERE item_id = $1`, [id]);
const ok = ({ error }) => assert.ifError(error);
const build = (...layers) => layers.map(([ice, more]) => ({ ice, ...more }));

/** Forget the drink's queued jobs, so a test sees only what its own write queued. */
async function clearJobs(id) {
  await db.query('DELETE FROM private.item_image_jobs WHERE item_id = $1', [id]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [id]);
}
const jobs = async (id) => ({
  image: (await one('SELECT count(*)::int AS n FROM private.item_image_jobs WHERE item_id = $1', [id])).n,
  sketch: (await one('SELECT count(*)::int AS n FROM private.item_flavor_jobs WHERE item_id = $1', [id])).n,
});

before(async () => {
  await db.connect();
  for (const label of ['creator', 'bartender', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Glass and ice bar ${run}` })).id;
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  ids.maker = (await insert('profiles', { kind: 'maker', makes: ['glassware'], handle: `glassmaker${run}`, display_name: `Glassmaker ${run}` })).id;

  ids.coupe = await item('Coupe', { item_type: 'glassware', glass: 'coupe' });
  ids.rocks = await item('Rocks', { item_type: 'glassware', glass: 'rocks' });
  ids.cubes = await item('Cubes', { item_type: 'ice', ice_kind: 'cubes' });
  ids.crushed = await item('Crushed', { item_type: 'ice', ice_kind: 'crushed' });
  ids.pebble = await item('Pebble', { item_type: 'ice', ice_kind: 'pebble' });
  ids.gin = await item('Gin', { item_type: 'ingredient' });
  ids.rocksModel = (await insert('glass_models', {
    maker_profile_id: ids.maker, glass: 'rocks', name: `Double rocks ${run}`, source_urls: ['https://example.com/rocks'],
    shape_item_id: ids.rocks, variant: 'rocks_double',
  })).id;

  ids.negroni = await item('Negroni', { item_type: 'cocktail', bar_id: ids.bar });
  ids.sour = await item('Sour', { item_type: 'cocktail', bar_id: ids.bar });
  ids.lager = await item('Lager', { item_type: 'beer', bar_id: ids.bar });
  ok(await service.rpc('save_item_sketch', {
    p_item_id: ids.negroni, p_inputs: INPUTS, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 2,
  }));
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  const itemIds = rows.map((r) => r.id);
  await db.query('DELETE FROM private.item_merges WHERE from_id = ANY($1) OR into_id = ANY($1)', [[...itemIds, ...Object.values(ids)]]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1) AND item_type IN ($2, $3)', [itemIds, 'cocktail', 'beer']);
  await db.query('DELETE FROM public.glass_models WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [itemIds]);
  for (const table of ['item_image_jobs', 'item_flavor_jobs']) await db.query(`DELETE FROM private.${table} WHERE item_id = ANY($1)`, [itemIds]);
  await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.maker]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('one home, two ways in', () => {
  test('backfill: every drink reads the same glass and ice from items and from the new rows', async () => {
    const drift = await one(`
      SELECT (SELECT count(*)::int FROM public.items i LEFT JOIN public.drink_glass g ON g.item_id = i.id
               WHERE (i.glassware_id, i.glass_model_id, i.sketch_variant) IS DISTINCT FROM (g.glassware_id, g.glass_model_id, g.sketch_variant)) AS glass,
             (SELECT count(*)::int FROM public.items i LEFT JOIN public.drink_ice x ON x.item_id = i.id
               WHERE (i.ice_id, i.method_ice_id, i.ice_build, i.ice_per_serve_g) IS DISTINCT FROM (x.ice_id, x.method_ice_id, x.ice_build, x.ice_per_serve_g)) AS ice`);
    assert.deepEqual(drift, { glass: 0, ice: 0 });
  });

  test("an old build's save reaches the new rows", async () => {
    ok(await users.creator.client.from('items').update({ glassware_id: ids.rocks, ice_id: ids.cubes, ice_per_serve_g: 120 }).eq('id', ids.negroni));
    assert.deepEqual(await rowGlass(ids.negroni), { glassware_id: ids.rocks, glass_model_id: null, sketch_variant: null });
    assert.deepEqual(await rowIce(ids.negroni), { ice_id: ids.cubes, method_ice_id: null, ice_build: null, ice_per_serve_g: '120' });

    // The real glass sets its shape on items first; the copy takes both.
    ok(await users.creator.client.from('items').update({ glass_model_id: ids.rocksModel }).eq('id', ids.sour));
    assert.deepEqual(await rowGlass(ids.sour), { glassware_id: ids.rocks, glass_model_id: ids.rocksModel, sketch_variant: null });

    // A build: ice_id is its top layer on both sides.
    ok(await users.creator.client.from('items').update({ ice_build: build([ids.crushed, { n: 2 }], [ids.pebble]) }).eq('id', ids.sour));
    assert.equal((await rowIce(ids.sour)).ice_id, ids.pebble);
    assert.deepEqual((await rowIce(ids.sour)).ice_build, (await itemsIce(ids.sour)).ice_build);

    // Clearing every glass column takes the row away.
    ok(await users.creator.client.from('items').update({ glassware_id: null, glass_model_id: null }).eq('id', ids.sour));
    assert.equal(await rowGlass(ids.sour), null);
  });

  test("the new app's write reaches items, redraws and queues the drawing jobs", async () => {
    await clearJobs(ids.negroni);
    ok(await users.creator.client.from('drink_glass').upsert({ item_id: ids.negroni, glassware_id: ids.coupe, sketch_variant: 'coupe_saucer' }));
    assert.deepEqual(await itemsGlass(ids.negroni), { glassware_id: ids.coupe, glass_model_id: null, sketch_variant: 'coupe_saucer' });
    const { inputs } = await one('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [ids.negroni]);
    assert.equal(inputs.glass, 'coupe');
    assert.equal(inputs.variant, 'coupe_saucer', 'refresh_sketch_variant redrew it');
    assert.deepEqual(await jobs(ids.negroni), { image: 1, sketch: 1 }, 'a new glass queues the image and sketch jobs, as an old build does');

    // A real glass from the new app: the row and items both take its shape.
    ok(await users.creator.client.from('drink_glass').update({ glass_model_id: ids.rocksModel }).eq('item_id', ids.negroni));
    assert.deepEqual(await rowGlass(ids.negroni), { glassware_id: ids.rocks, glass_model_id: ids.rocksModel, sketch_variant: 'coupe_saucer' });
    assert.deepEqual(await itemsGlass(ids.negroni), await rowGlass(ids.negroni));
  });

  test('only what changed is written back, so grams of ice queue no picture', async () => {
    await clearJobs(ids.negroni);
    ok(await users.creator.client.from('drink_ice').update({ ice_per_serve_g: 90 }).eq('item_id', ids.negroni));
    assert.equal(Number((await itemsIce(ids.negroni)).ice_per_serve_g), 90);
    assert.deepEqual(await jobs(ids.negroni), { image: 0, sketch: 0 });
  });

  test('a build from the new app sets the top layer on both sides and queues the sketch job', async () => {
    await clearJobs(ids.negroni);
    ok(await users.creator.client.from('drink_ice').update({ ice_build: build([ids.crushed, { n: 2 }], [ids.pebble, { to: 'mound' }]) }).eq('item_id', ids.negroni));
    const row = await rowIce(ids.negroni);
    assert.equal(row.ice_id, ids.pebble, 'ice_id is the top layer');
    assert.deepEqual(await itemsIce(ids.negroni), row);
    assert.deepEqual(await jobs(ids.negroni), { image: 1, sketch: 1 }, 'the ice changed, as an old build would queue');
  });

  test("deleting the new app's row clears items", async () => {
    ok(await users.creator.client.from('drink_glass').delete().eq('item_id', ids.negroni));
    assert.deepEqual(await itemsGlass(ids.negroni), { glassware_id: null, glass_model_id: null, sketch_variant: null });
  });
});

describe('a glass is glassware and ice is ice', () => {
  test('the new rows refuse the wrong kind of item', async () => {
    const glass = await users.creator.client.from('drink_glass').upsert({ item_id: ids.sour, glassware_id: ids.cubes });
    assert.match(glass.error?.message ?? '', /glassware item/);
    for (const row of [{ ice_id: ids.coupe }, { method_ice_id: ids.gin }, { ice_build: build([ids.gin], [ids.cubes]) }]) {
      const { error } = await users.creator.client.from('drink_ice').upsert({ item_id: ids.lager, ...row });
      assert.match(error?.message ?? '', /ice items/, JSON.stringify(row));
    }
    const model = await users.creator.client.from('drink_glass').upsert({ item_id: ids.lager, glass_model_id: ids.rocksModel });
    assert.match(model.error?.message ?? '', /glass model/);
  });

  test('an old build is held to the same check, since its save is copied', async () => {
    const { error } = await users.creator.client.from('items').update({ ice_id: ids.coupe }).eq('id', ids.lager);
    assert.match(error?.message ?? '', /ice items/);
    assert.equal((await itemsIce(ids.lager)).ice_id, null, 'nothing was saved');
  });

  test('an ice deleted from under a build never blocks the next save', async () => {
    const gone = await item('Old cubes', { item_type: 'ice', ice_kind: 'cubes' });
    ok(await users.creator.client.from('drink_ice').upsert({ item_id: ids.lager, ice_build: build([gone, { n: 2 }], [ids.cubes]) }));
    await db.query('DELETE FROM public.items WHERE id = $1', [gone]);
    ok(await users.creator.client.from('drink_ice').update({ ice_per_serve_g: 80 }).eq('item_id', ids.lager));
    assert.equal(Number((await itemsIce(ids.lager)).ice_per_serve_g), 80);
  });
});

describe('who reads and writes them', () => {
  before(async () => {
    ok(await users.creator.client.from('drink_glass').upsert({ item_id: ids.negroni, glassware_id: ids.coupe }));
  });

  test('a bartender reads the drink, so reads its glass and ice', async () => {
    const glass = await users.bartender.client.from('drink_glass').select('glassware_id').eq('item_id', ids.negroni);
    const ice = await users.bartender.client.from('drink_ice').select('ice_id').eq('item_id', ids.negroni);
    assert.ifError(glass.error);
    assert.ifError(ice.error);
    assert.equal(glass.data.length, 1);
    assert.equal(ice.data.length, 1);
  });

  test("someone who can't read the drink reads nothing", async () => {
    const { data, error } = await users.stranger.client.from('drink_glass').select('item_id').eq('item_id', ids.negroni);
    assert.ifError(error);
    assert.equal(data.length, 0);
  });

  test('only those who edit the drink write them', async () => {
    const changed = await users.bartender.client.from('drink_glass').update({ glassware_id: ids.rocks }).eq('item_id', ids.negroni).select();
    assert.equal(changed.data?.length ?? 0, 0);
    const removed = await users.bartender.client.from('drink_ice').delete().eq('item_id', ids.negroni).select();
    assert.equal(removed.data?.length ?? 0, 0);
    const added = await users.bartender.client.from('drink_glass').insert({ item_id: ids.lager, glassware_id: ids.rocks });
    assert.ok(added.error, 'a bartender adds no glass');
    const stranger = await users.stranger.client.from('drink_ice').insert({ item_id: ids.sour, ice_id: ids.cubes });
    assert.ok(stranger.error, 'a stranger adds no ice');
    assert.equal((await itemsGlass(ids.negroni)).glassware_id, ids.coupe, 'items unchanged');
    assert.notEqual(await rowIce(ids.negroni), null);
  });

  test('anon has no access at all', async () => {
    for (const table of ['drink_glass', 'drink_ice']) {
      const read = await anon.from(table).select('item_id').limit(1);
      assert.ok(read.error, `anon can't read ${table}`);
      const write = await anon.from(table).insert({ item_id: ids.negroni });
      assert.ok(write.error, `anon can't write ${table}`);
    }
  });
});

describe('no loops', () => {
  test('both ways in one transaction: each write copies once and the guard is off after it', async () => {
    await db.query('BEGIN');
    try {
      await db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [ids.negroni, ids.rocks]);
      assert.equal((await rowGlass(ids.negroni)).glassware_id, ids.rocks);
      assert.notEqual((await one("SELECT current_setting('app.glass_ice_sync', true) AS s")).s, 'on');
      await db.query('UPDATE public.drink_glass SET glassware_id = $2 WHERE item_id = $1', [ids.negroni, ids.coupe]);
      assert.equal((await itemsGlass(ids.negroni)).glassware_id, ids.coupe, 'the second write still copies');
      await db.query('UPDATE public.drink_ice SET ice_per_serve_g = 75 WHERE item_id = $1', [ids.negroni]);
      await db.query('UPDATE public.items SET ice_per_serve_g = 70 WHERE id = $1', [ids.negroni]);
      assert.equal(Number((await rowIce(ids.negroni)).ice_per_serve_g), 70);
      assert.equal(Number((await itemsIce(ids.negroni)).ice_per_serve_g), 70);
      assert.notEqual((await one("SELECT current_setting('app.glass_ice_sync', true) AS s")).s, 'on');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

describe('merges', () => {
  test('an ice merged away: drinks building with it build with the one it went into', async () => {
    const [a, b] = [await item('Machine cubes', { item_type: 'ice', ice_kind: 'cubes' }), await item('Kold-Draft', { item_type: 'ice', ice_kind: 'cubes' })];
    const drink = await item('Swizzle', { item_type: 'cocktail', bar_id: ids.bar, ice_build: build([a, { n: 3 }], [ids.crushed, { to: 'mound' }]), method_ice_id: a });
    await db.query('SELECT private.merge_item($1, $2)', [a, b]);
    const row = await rowIce(drink);
    assert.deepEqual(row.ice_build, build([b, { n: 3 }], [ids.crushed, { to: 'mound' }]));
    assert.equal(row.method_ice_id, b);
    assert.deepEqual(await itemsIce(drink), row);
  });

  test("a drink merged away takes its glass and ice with it; the kept drink keeps its own", async () => {
    const copy = await item('Daiquiri copy', { item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe, ice_id: ids.cubes });
    const kept = await item('Daiquiri', { item_type: 'cocktail', bar_id: ids.bar });
    await db.query('SELECT private.merge_item($1, $2)', [copy, kept]);
    assert.equal(await rowGlass(kept), null);
    assert.equal(await rowIce(kept), null);
    assert.deepEqual(await itemsGlass(kept), { glassware_id: null, glass_model_id: null, sketch_variant: null });
  });
});
