// Automatic item images: picture metadata, the job queue, settling jobs in
// SQL, and the image-worker function. Runs through the real API against the
// local stack, where the image model is always mocked (see _shared/localStack.ts).
//
//   supabase start && supabase db reset
//   npm run test:security
//
// The worker tests need the edge runtime (don't exclude edge-runtime when
// starting the stack). They are skipped when the worker isn't being served,
// and refuse to run unless it reports the mocked model, so they never spend
// real AI quota.

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
  throw new Error(`Refusing to run image tests against a non-local API: ${status.API_URL}`);
}

const WORKER_URL = `${status.API_URL}/functions/v1/image-worker`;
const WORKER_SECRET = 'local-image-worker-secret';

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

// 'mock' when the worker is served with the mocked model, 'imagen' when it
// would call the real one, null when it isn't served at all. In CI the edge
// runtime is cold on the first request, so keep asking for a minute.
async function probeWorker(attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(WORKER_URL, { headers: { 'x-image-worker-secret': WORKER_SECRET } });
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
if (workerModel === 'imagen') {
  throw new Error('image-worker is using the real image model; unset IMAGE_MODEL=imagen in supabase/functions/.env before running tests.');
}
if (!workerModel && process.env.CI) {
  throw new Error('image-worker is not being served; CI starts the stack with edge-runtime for these tests.');
}
const workerSkip = workerModel === 'mock' ? false : 'image-worker is not served (start the stack with edge-runtime)';

async function makeUser(label) {
  const email = `${label}-${run}@image-test.local`;
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

async function newBar(label) {
  return (await serviceInsert('bars', { name: `${label} ${run}` })).id;
}

async function newItem(fields) {
  return (await serviceInsert('items', { ...fields, name: `${fields.name} ${run}` })).id;
}

async function addRecipe(itemId, ingredientId, unit, sortOrder) {
  await serviceInsert('recipes', {
    recipe_item_id: itemId, ingredient_item_id: ingredientId, amount: 30, unit, sort_order: sortOrder,
  });
}

/** Links an uploaded photo (a plain images row) to an item. */
async function addPhoto(itemId) {
  const image = await serviceInsert('images', { url: `http://127.0.0.1/photo-${run}-${randomUUID()}.jpg` });
  return serviceInsert('item_images', { item_id: itemId, image_id: image.id, sort_order: 0 });
}

async function jobFor(itemId) {
  const { rows } = await db.query('SELECT * FROM private.item_image_jobs WHERE item_id = $1', [itemId]);
  return rows[0] ?? null;
}

/** Skips the debounce and runs the cron tick now. */
async function settle(itemId) {
  await db.query('UPDATE private.item_image_jobs SET run_after = now() WHERE item_id = $1', [itemId]);
  await db.query('SELECT private.run_item_image_jobs()');
}

async function fingerprint(itemId) {
  const { rows } = await db.query('SELECT private.item_spec_fingerprint($1) AS fp', [itemId]);
  return rows[0].fp;
}

async function links(itemId) {
  const { rows } = await db.query(
    `SELECT ii.id, ii.image_id, ii.angle, ii.is_generated, ii.spec_fingerprint, ii.outdated_since, i.url
     FROM public.item_images ii JOIN public.images i ON i.id = ii.image_id
     WHERE ii.item_id = $1 ORDER BY ii.sort_order`,
    [itemId]
  );
  return rows;
}

/**
 * Runs the worker, then waits for these items' jobs to leave the worker's
 * hands. The cron tick may have woken another worker that claimed them first
 * (when Vault holds the worker URL), so the call itself proves nothing.
 */
async function work(...itemIds) {
  const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'x-image-worker-secret': WORKER_SECRET } });
  assert.equal(res.status, 200, `worker answered ${res.status}`);
  await res.json();
  for (let i = 0; i < 100; i++) {
    const { rows } = await db.query(
      "SELECT 1 FROM private.item_image_jobs WHERE item_id = ANY($1) AND status IN ('ready', 'running')",
      [itemIds]
    );
    if (rows.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.fail('image jobs did not finish');
}

async function usage(column, id) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM private.ai_usage WHERE ${column} = $1`, [id]);
  return rows[0].n;
}

before(async () => {
  await db.connect();
  for (const label of ['creator', 'bartender', 'homeUser']) users[label] = await makeUser(label);

  ids.bar = await newBar('Image Bar');
  await serviceInsert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });

  ids.coupe = await newItem({ name: 'Coupe', item_type: 'glassware' });
  ids.rocks = await newItem({ name: 'Rocks', item_type: 'glassware' });
  ids.gin = await newItem({ name: 'Gin', item_type: 'ingredient', created_by: null });
  ids.lemon = await newItem({ name: 'Lemon', item_type: 'ingredient', created_by: null });
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  for (const { id } of rows) {
    for (const folder of ['cocktails', 'ingredients']) {
      const { data } = await service.storage.from('drinks').list(`${folder}/${id}`);
      if (data?.length) await service.storage.from('drinks').remove(data.map((f) => `${folder}/${id}/${f.name}`));
    }
  }
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_image_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('picture metadata', () => {
  test('signed-in users cannot create images marked as generated', async () => {
    for (const row of [
      { url: `http://127.0.0.1/fake-${run}.png`, is_generated: true },
      { url: `http://127.0.0.1/fake-${run}.png`, spec_fingerprint: 'abc' },
    ]) {
      const { error } = await users.creator.client.from('images').insert(row);
      assert.ok(error, `insert ${JSON.stringify(row)} should fail`);
    }
  });

  test('is_generated on a link always comes from its image, even when re-linked', async () => {
    const drink = await newItem({ name: 'Relinked', item_type: 'cocktail', bar_id: ids.bar });
    const { data: photo, error } = await users.creator.client
      .from('images').insert({ url: `http://127.0.0.1/photo-${run}.jpg` }).select('id').single();
    assert.ifError(error);
    const { data: sketchId } = await service.rpc('attach_generated_item_image', {
      p_item_id: drink, p_url: `http://127.0.0.1/sketch-${run}.png`,
    });

    // What older app versions do on every save: drop every link, re-insert.
    await users.creator.client.from('item_images').delete().eq('item_id', drink);
    const { error: relinkError } = await users.creator.client.from('item_images').insert([
      { item_id: drink, image_id: photo.id, sort_order: 0, is_generated: true },
      { item_id: drink, image_id: sketchId, sort_order: 1, is_generated: false },
    ]);
    assert.ifError(relinkError);

    const rows = await links(drink);
    assert.deepEqual(rows.map((r) => r.is_generated), [false, true]);
    assert.equal(rows[1].spec_fingerprint, await fingerprint(drink));
  });

  test('the worker RPCs are service-role only', async () => {
    const calls = [
      ['claim_item_image_job', {}],
      ['release_item_image_job', { p_item_id: ids.gin, p_revision: 1, p_outcome: 'failed' }],
      ['attach_generated_item_image', { p_item_id: ids.gin, p_url: 'http://127.0.0.1/x.png' }],
      ['consume_item_ai_quota', { p_item_id: ids.gin, p_fn: 'x', p_venue_daily_limit: 1, p_user_daily_limit: 1 }],
    ];
    for (const client of [anon, users.creator.client]) {
      for (const [fn, args] of calls) {
        const { error } = await client.rpc(fn, args);
        assert.ok(error, `${fn} should be refused`);
      }
    }
  });
});

describe('queue', () => {
  test('saving a drink queues one job that waits for the save to finish', async () => {
    const { data: drink, error } = await users.creator.client
      .from('items')
      .insert({ name: `Queued sour ${run}`, item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe })
      .select('id').single();
    assert.ifError(error);
    for (const [index, ingredient] of [ids.gin, ids.lemon].entries()) {
      const { error: recipeError } = await users.creator.client.from('recipes').insert({
        recipe_item_id: drink.id, ingredient_item_id: ingredient, amount: 30, unit: 'ml', sort_order: index,
      });
      assert.ifError(recipeError);
    }

    const job = await jobFor(drink.id);
    assert.equal(job.status, 'pending');
    assert.equal(Number(job.revision), 3, 'item insert and two recipes coalesce into one job');
    assert.ok(new Date(job.run_after) > new Date(Date.now() + 10_000), 'debounced');
  });

  test('glassware, methods, ice and families get no job', async () => {
    assert.equal(await jobFor(ids.coupe), null);
  });

  test('deleting a drink with recipes and pictures still works', async () => {
    const drink = await newItem({ name: 'Doomed', item_type: 'cocktail', bar_id: ids.bar });
    await addRecipe(drink, ids.gin, 'ml', 0);
    await addPhoto(drink);
    const { error } = await users.creator.client.from('items').delete().eq('id', drink);
    assert.ifError(error);
    await settle(drink);
    assert.equal(await jobFor(drink), null);
  });
});

describe('settling in SQL', () => {
  test('a drink with no picture is ready for a sketch', async () => {
    const drink = await newItem({ name: 'Bare', item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe });
    await settle(drink);
    assert.equal((await jobFor(drink)).status, 'ready');
    await db.query('DELETE FROM private.item_image_jobs WHERE item_id = $1', [drink]);
  });

  test('amounts and a drink\'s name don\'t change its fingerprint; glass and garnish do', async () => {
    const drink = await newItem({ name: 'Printed', item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe });
    await addRecipe(drink, ids.gin, 'ml', 0);
    const base = await fingerprint(drink);

    await db.query('UPDATE public.recipes SET amount = 45, unit = $2 WHERE recipe_item_id = $1', [drink, 'oz']);
    await db.query('UPDATE public.items SET name = $2 WHERE id = $1', [drink, `Renamed ${run}`]);
    assert.equal(await fingerprint(drink), base);

    await addRecipe(drink, ids.lemon, 'twist', 1);
    const withTwist = await fingerprint(drink);
    assert.notEqual(withTwist, base);
    await db.query('UPDATE public.recipes SET unit = $2 WHERE recipe_item_id = $1 AND unit = $3', [drink, 'wheel', 'twist']);
    assert.notEqual(await fingerprint(drink), withTwist, 'twist vs wheel is a different garnish');

    await db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [drink, ids.rocks]);
    assert.notEqual(await fingerprint(drink), base);
  });

  test('a spec change flags photos as possibly out of date and never replaces them', async () => {
    const drink = await newItem({ name: 'Photographed', item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe });
    const photo = await addPhoto(drink);
    await settle(drink);

    let [row] = await links(drink);
    assert.equal(row.spec_fingerprint, await fingerprint(drink), 'new photo stamped with the spec');
    assert.equal(row.outdated_since, null);
    assert.equal(await jobFor(drink), null, 'a hero photo means nothing to draw');

    const { error } = await users.creator.client.from('items').update({ glassware_id: ids.rocks }).eq('id', drink);
    assert.ifError(error);
    await settle(drink);
    const rows = await links(drink);
    assert.equal(rows.length, 1, 'no sketch added alongside the photo');
    assert.equal(rows[0].id, photo.id, 'photo kept');
    assert.ok(rows[0].outdated_since, 'photo flagged');
    assert.equal(await jobFor(drink), null);

    await users.creator.client.from('items').update({ glassware_id: ids.coupe }).eq('id', drink);
    await settle(drink);
    [row] = await links(drink);
    assert.equal(row.outdated_since, null, 'flag cleared when the spec changes back');
  });

  test('only an editor can confirm photos still match the spec', async () => {
    const drink = await newItem({ name: 'Confirmed', item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe });
    await addPhoto(drink);
    await settle(drink);
    await db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [drink, ids.rocks]);
    await settle(drink);
    assert.ok((await links(drink))[0].outdated_since);

    const { error: bartenderError } = await users.bartender.client.rpc('confirm_item_photos', { p_item_id: drink });
    assert.ok(bartenderError, 'bartenders cannot confirm');
    assert.ok((await links(drink))[0].outdated_since);

    const { error } = await users.creator.client.rpc('confirm_item_photos', { p_item_id: drink });
    assert.ifError(error);
    const [row] = await links(drink);
    assert.equal(row.outdated_since, null);
    assert.equal(row.spec_fingerprint, await fingerprint(drink));
  });
});

describe('image worker', { skip: workerSkip }, () => {
  test('refuses callers without the shared secret', async () => {
    for (const headers of [{}, { 'x-image-worker-secret': 'nope' }, { Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` }]) {
      const res = await fetch(WORKER_URL, { method: 'POST', headers });
      assert.equal(res.status, 401);
      await res.body?.cancel();
    }
  });

  test('draws a hero sketch for a new drink, billed to its venue', async () => {
    const bar = await newBar('Billed Bar');
    ids.sketched = await newItem({ name: 'Sketched', item_type: 'cocktail', bar_id: bar, glassware_id: ids.coupe });
    await addRecipe(ids.sketched, ids.gin, 'ml', 0);
    await addRecipe(ids.sketched, ids.lemon, 'twist', 1);
    await settle(ids.sketched);
    await work(ids.sketched);

    const rows = await links(ids.sketched);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].angle, 'hero');
    assert.equal(rows[0].is_generated, true);
    assert.equal(rows[0].spec_fingerprint, await fingerprint(ids.sketched));
    assert.match(rows[0].url, new RegExp(`/drinks/cocktails/${ids.sketched}/\\d+\\.png$`));
    assert.equal(await usage('bar_id', bar), 1);
    assert.equal(await jobFor(ids.sketched), null);
  });

  test('redraws when the spec changes, replacing only the old sketch', async () => {
    const [before] = await links(ids.sketched);
    await db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [ids.sketched, ids.rocks]);
    await settle(ids.sketched);
    await work(ids.sketched);

    const rows = await links(ids.sketched);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].image_id, before.image_id);
    assert.equal(rows[0].spec_fingerprint, await fingerprint(ids.sketched));
  });

  test('a photo added later is kept, and nothing more is drawn', async () => {
    const photo = await addPhoto(ids.sketched);
    await settle(ids.sketched);
    await db.query('UPDATE public.items SET glassware_id = $2 WHERE id = $1', [ids.sketched, ids.coupe]);
    await settle(ids.sketched);
    assert.equal(await jobFor(ids.sketched), null);
    await work(ids.sketched);

    const rows = await links(ids.sketched);
    assert.equal(rows.length, 2);
    const kept = rows.find((r) => r.id === photo.id);
    assert.ok(kept && !kept.is_generated && kept.outdated_since, 'photo kept and flagged');
  });

  test('a venue past its daily allowance waits instead of drawing', async () => {
    const bar = await newBar('Busy Bar');
    await db.query(
      "INSERT INTO private.ai_usage (bar_id, fn) SELECT $1, 'image-worker' FROM generate_series(1, 1000)",
      [bar]
    );
    const drink = await newItem({ name: 'Waiting', item_type: 'cocktail', bar_id: bar, glassware_id: ids.coupe });
    await settle(drink);
    await work(drink);

    assert.equal((await links(drink)).length, 0);
    const job = await jobFor(drink);
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 0, 'waiting for quota is not a failed attempt');
    assert.ok(new Date(job.run_after) > new Date(Date.now() + 50 * 60_000), 'retries in about an hour');
  });

  test('personal items bill their creator; legacy catalog rows are skipped', async () => {
    const personal = await newItem({ name: 'Home shrub', item_type: 'ingredient', created_by: users.homeUser.id });
    const legacy = await newItem({ name: 'Legacy bitters', item_type: 'ingredient', created_by: null });
    await settle(personal);
    await settle(legacy);
    await work(personal, legacy);

    assert.equal((await links(personal)).length, 1);
    assert.equal(await usage('user_id', users.homeUser.id), 1);
    assert.equal((await links(legacy)).length, 0);
    assert.equal(await jobFor(legacy), null);
  });

  test('the Generate button still works, spends the caller\'s quota and tags its sketch', async () => {
    const drink = await newItem({ name: 'Buttoned', item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.coupe });
    const { data, error } = await users.creator.client.functions.invoke('generate-cocktail-image', {
      body: { cocktail_id: drink },
    });
    assert.ifError(error);
    assert.equal(data.success, true);

    const rows = await links(drink);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_generated, true);
    assert.equal(rows[0].spec_fingerprint, await fingerprint(drink));
    assert.equal(await usage('user_id', users.creator.id), 1);

    // The pending automatic job now has nothing to draw.
    await settle(drink);
    assert.equal(await jobFor(drink), null);
  });
});
