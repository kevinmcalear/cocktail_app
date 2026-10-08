// Drawing inputs (item_sketches): who can read them, what they may hold, what
// re-queues them, and the flavor-worker's drawing pass. Runs through the real
// API against the local stack, where the AI fill is always mocked (see
// _shared/gemini.ts flavorModel).
//
//   supabase start && supabase db reset
//   npm run test:security
//
// The worker tests need the edge runtime. They are skipped when the worker
// isn't being served, and refuse to run unless it reports the mocked model.

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
  throw new Error(`Refusing to run sketch tests against a non-local API: ${status.API_URL}`);
}

const WORKER_URL = `${status.API_URL}/functions/v1/flavor-worker`;
const WORKER_SECRET = 'local-flavor-worker-secret';
const SKETCH_COLUMNS = 'item_id, inputs, source, spec_fingerprint, rules_version, updated_at';

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function probeWorker(attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(WORKER_URL, { headers: { 'x-flavor-worker-secret': WORKER_SECRET } });
      if (res.ok) return (await res.json()).model ?? null;
      await res.body?.cancel();
    } catch {
      // not up yet
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return null;
}
const workerModel = await probeWorker(process.env.CI ? 20 : 1);
if (workerModel === 'live') {
  throw new Error('flavor-worker is using the real model; unset FLAVOR_MODEL=live in supabase/functions/.env before running tests.');
}
if (!workerModel && process.env.CI) {
  throw new Error('flavor-worker is not being served; CI starts the stack with edge-runtime for these tests.');
}
const workerSkip = workerModel === 'mock' ? false : 'flavor-worker is not served (start the stack with edge-runtime)';

async function makeUser(label) {
  const email = `${label}-${run}@sketch-test.local`;
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

async function newItem(fields) {
  return (await serviceInsert('items', { ...fields, name: `${fields.name} ${run}` })).id;
}

async function drink(name, lines, fields = {}) {
  const id = await newItem({ name, item_type: 'cocktail', ...fields });
  for (const [i, [ingredient, ml]] of lines.entries()) {
    await serviceInsert('recipes', { recipe_item_id: id, ingredient_item_id: ingredient, amount: ml, unit: 'ml', sort_order: i });
  }
  return id;
}

const INPUTS = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a8202e', alpha: 0.9 },
  foam: null, float: null, bleed: null, fizz: false, garnish: 'orange_peel',
  from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'data' }, coverage: 1,
};

async function saveSketch(itemId, inputs = INPUTS) {
  return service.rpc('save_item_sketch', {
    p_item_id: itemId, p_inputs: inputs, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 1,
  });
}

async function sketchRow(itemId) {
  const { rows } = await db.query('SELECT * FROM public.item_sketches WHERE item_id = $1', [itemId]);
  return rows[0] ?? null;
}

async function jobFor(itemId) {
  const { rows } = await db.query('SELECT * FROM private.item_flavor_jobs WHERE item_id = $1', [itemId]);
  return rows[0] ?? null;
}

async function fingerprint(itemId) {
  const { rows } = await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [itemId]);
  return rows[0].fp;
}

async function usage(barId) {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM private.ai_usage WHERE bar_id = $1 AND fn = 'flavor-worker'", [barId]);
  return rows[0].n;
}

/** Makes these drinks' jobs due, runs the worker and waits for them to leave its hands (see flavor.test.mjs). */
async function work(...itemIds) {
  await db.query('SELECT private.enqueue_item_flavor_job(id, interval \'0 seconds\') FROM unnest($1::uuid[]) id', [itemIds]);
  await db.query("UPDATE private.item_flavor_jobs SET run_after = now() + interval '1 day' WHERE status = 'pending' AND NOT item_id = ANY($1)", [itemIds]);
  await db.query('UPDATE private.item_flavor_jobs SET run_after = now() WHERE item_id = ANY($1)', [itemIds]);
  const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'x-flavor-worker-secret': WORKER_SECRET } });
  assert.equal(res.status, 200, `worker answered ${res.status}`);
  await res.json();
  for (let i = 0; i < 100; i++) {
    const { rows } = await db.query(
      "SELECT 1 FROM private.item_flavor_jobs WHERE item_id = ANY($1) AND (status = 'running' OR (status = 'pending' AND run_after <= now()))",
      [itemIds]
    );
    if (rows.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.fail('jobs did not finish');
}

before(async () => {
  await db.connect();
  for (const label of ['guest', 'outsider']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Sketch Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.guest.id, bar_id: ids.bar, role_level: 10 });

  ids.gin = await newItem({ name: 'Gin', item_type: 'ingredient' });
  ids.campari = await newItem({ name: 'Campari', item_type: 'ingredient' });
  ids.vermouth = await newItem({ name: 'Sweet Vermouth', item_type: 'ingredient' });
  ids.secret = await newItem({ name: 'Secret Brand XO', item_type: 'ingredient' });
  ids.coupe = await newItem({ name: 'Coupette', item_type: 'glassware' });
  ids.rocks = await newItem({ name: 'Rocks', item_type: 'glassware' });
  ids.cubes = await newItem({ name: 'Cubes', item_type: 'ice' });
  ids.stir = await newItem({ name: 'Stir', item_type: 'method' });

  ids.shared = await drink('Negroni', [[ids.gin, 30], [ids.campari, 30], [ids.vermouth, 30]]);
  ids.barDrink = await drink('House Special', [[ids.gin, 45], [ids.secret, 30]], { bar_id: ids.bar });
  ids.hiddenDrink = await drink('Staff Only', [[ids.gin, 45]], { bar_id: ids.bar, override_visibility_level: 30 });
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [[ids.shared, ids.barDrink, ids.hiddenDrink]]);
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.ai_usage WHERE bar_id IN (SELECT id FROM public.bars WHERE name LIKE $1)', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('who can read drawing inputs', () => {
  before(async () => {
    for (const id of [ids.shared, ids.barDrink, ids.hiddenDrink]) assert.ifError((await saveSketch(id)).error);
  });

  test('a shared drink\'s inputs are readable by anyone, signed out too (its public card is drawn)', async () => {
    const { data } = await users.outsider.client.from('item_sketches').select('item_id').eq('item_id', ids.shared);
    assert.equal(data.length, 1);
    const { data: anonData, error } = await anon.from('item_sketches').select('item_id').eq('item_id', ids.shared);
    assert.ifError(error);
    assert.equal(anonData.length, 1);
  });

  test('signed out reads no unpublished venue drink\'s inputs', async () => {
    const { data, error } = await anon.from('item_sketches').select('item_id').in('item_id', [ids.barDrink, ids.hiddenDrink]);
    assert.ok(error || data.length === 0, 'anon reads nothing');
  });

  test('a bar drink\'s inputs follow the drink: members at its level only', async () => {
    const read = async (client, item) => (await client.from('item_sketches').select('item_id').eq('item_id', item)).data.length;
    assert.equal(await read(users.guest.client, ids.barDrink), 1);
    assert.equal(await read(users.outsider.client, ids.barDrink), 0);
    assert.equal(await read(users.guest.client, ids.hiddenDrink), 0, 'visibility level 30 hides it from a guest');
  });

  test('the row carries enums, numbers and colours, never names', async () => {
    const { data, error } = await users.guest.client.from('item_sketches').select('*').eq('item_id', ids.barDrink).single();
    assert.ifError(error);
    assert.deepEqual(Object.keys(data).sort(), SKETCH_COLUMNS.split(', ').sort());
    assert.doesNotMatch(JSON.stringify(data), /Secret Brand|Gin|House Special/);
  });

  test('anything that could carry a name is refused', async () => {
    const bad = [
      { ...INPUTS, name: 'Secret Brand XO' },
      { ...INPUTS, garnish: 'Secret Brand XO twist' },
      { ...INPUTS, glass: 'The House Goblet' },
      { ...INPUTS, liquid: { hex: 'Secret', alpha: 1 } },
      { ...INPUTS, liquid: { hex: '#ffffff', alpha: 1, note: 'Secret' } },
      { ...INPUTS, float: 'Secret Brand XO' },
      { ...INPUTS, from: { ...INPUTS.from, glass: 'Secret' } },
      { ...INPUTS, fizz: 'yes' },
      'Secret Brand XO',
    ];
    for (const inputs of bad) {
      const { error } = await saveSketch(ids.shared, inputs);
      assert.ok(error, `refused: ${JSON.stringify(inputs).slice(0, 80)}`);
    }
    assert.deepEqual((await sketchRow(ids.shared)).inputs, INPUTS, 'the stored row is unchanged');
  });

  test('only the worker writes inputs', async () => {
    const client = users.guest.client;
    const { error: insertError } = await client.from('item_sketches').insert({ item_id: ids.hiddenDrink, inputs: INPUTS, source: 'rules', spec_fingerprint: 'x', rules_version: 1 });
    assert.ok(insertError, 'insert refused');
    await client.from('item_sketches').update({ source: 'ai' }).eq('item_id', ids.barDrink);
    await client.from('item_sketches').delete().eq('item_id', ids.barDrink);
    const row = await sketchRow(ids.barDrink);
    assert.ok(row && row.source === 'rules', 'update and delete had no effect');
  });

  test('the worker RPCs are service-role only', async () => {
    for (const client of [anon, users.guest.client]) {
      const { error: ctxError } = await client.rpc('get_item_sketch_context', { p_item_id: ids.barDrink });
      assert.ok(ctxError, 'context refused');
      const { error: saveError } = await client.rpc('save_item_sketch', {
        p_item_id: ids.barDrink, p_inputs: INPUTS, p_source: 'rules', p_spec_fingerprint: 'x', p_rules_version: 1,
      });
      assert.ok(saveError, 'save refused');
    }
  });
});

describe('re-queueing', () => {
  test('changing the glass, ice, description or methods queues the drink and changes its fingerprint', async () => {
    const id = await drink('Requeue Me', [[ids.gin, 50]]);
    const changes = [
      ['glassware', () => db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [id, ids.rocks])],
      ['ice', () => db.query('UPDATE public.items SET ice_id = $2 WHERE id = $1', [id, ids.cubes])],
      ['description', () => db.query("UPDATE public.items SET description = 'Served up, blush pink.' WHERE id = $1", [id])],
      ['method', () => db.query('INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES ($1, $2, 0)', [id, ids.stir])],
    ];
    for (const [what, change] of changes) {
      await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [id]);
      const before = await fingerprint(id);
      await change();
      assert.ok(await jobFor(id), `${what} queued a job`);
      assert.notEqual(await fingerprint(id), before, `${what} changed the fingerprint`);
    }
    await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [id]);
    await db.query("UPDATE public.items SET description = 'Served up, blush pink.' WHERE id = $1", [id]);
    assert.equal(await jobFor(id), null, 'an update that changes nothing queues nothing');
  });
});

describe('the drawing pass', { skip: workerSkip }, () => {
  test('a classic is drawn from the rules alone, and spends nothing', async () => {
    const id = await drink('Rules Negroni', [[ids.gin, 30], [ids.campari, 30], [ids.vermouth, 30]]);
    await work(id);
    const row = await sketchRow(id);
    assert.equal(row.source, 'rules');
    assert.equal(row.inputs.glass, 'rocks');
    assert.equal(row.inputs.ice, 'large');
    assert.equal(row.inputs.method, 'stir');
    assert.equal(row.inputs.foam, null);
    assert.equal(row.spec_fingerprint, await fingerprint(id));
  });

  test('the drink\'s own glass, ice and method win', async () => {
    const id = await drink('Data Drink', [[ids.gin, 50]], { glassware_id: ids.coupe, ice_id: ids.cubes });
    await db.query('INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES ($1, $2, 0)', [id, ids.stir]);
    await work(id);
    const { inputs } = await sketchRow(id);
    assert.deepEqual([inputs.glass, inputs.ice, inputs.method], ['coupe', 'cubes', 'stir']);
    assert.deepEqual([inputs.from.glass, inputs.from.ice, inputs.from.method], ['data', 'data', 'data']);
  });

  test('a venue drink with no picture and nothing to go on asks the AI fill once, and caches the answer', async () => {
    const bar = (await serviceInsert('bars', { name: `Drawing Bar ${run}` })).id;
    const id = await drink('Quiet Storm', [[ids.gin, 45], [ids.secret, 30]], { bar_id: bar });
    await work(id);
    const row = await sketchRow(id);
    assert.equal(row.source, 'ai');
    assert.equal(row.inputs.glass, 'flute', 'the mocked answer');
    assert.equal(row.inputs.from.glass, 'ai');
    assert.equal(await usage(bar), 1);
    const { rows } = await db.query('SELECT answer FROM private.item_sketch_ai WHERE item_id = $1', [id]);
    assert.equal(rows[0].answer.glass, 'flute');

    // Asked again with nothing changed, the cached answers stand.
    await work(id);
    assert.equal(await usage(bar), 1, 'not paid for again');
    assert.equal((await sketchRow(id)).inputs.glass, 'flute');
  });

  test('a drink with a picture never asks how it looks', async () => {
    const bar = (await serviceInsert('bars', { name: `Photo Bar ${run}` })).id;
    const id = await drink('Pictured Thing', [[ids.gin, 45], [ids.campari, 20]], { bar_id: bar });
    const image = await serviceInsert('images', { url: `https://example.test/${run}.jpg` });
    await serviceInsert('item_images', { item_id: id, image_id: image.id, sort_order: 0 });
    await work(id);
    assert.equal(await usage(bar), 0);
    assert.equal((await sketchRow(id)).source, 'rules');
  });

  test('a catalog drink with no payer stays on the rules', async () => {
    const unheard = await newItem({ name: 'Unheard Of Bottle', item_type: 'ingredient' });
    const id = await drink('Catalog Mystery', [[unheard, 60]]);
    await work(id);
    const row = await sketchRow(id);
    assert.equal(row.source, 'rules');
    assert.notEqual(row.inputs.from.glass, 'ai');
    const { rows } = await db.query('SELECT 1 FROM private.item_sketch_ai WHERE item_id = $1', [id]);
    assert.equal(rows.length, 0, 'nothing was asked');
  });
});
