// Flavor profiles, your taste and the flavor worker. Runs through the real API
// against the local stack, where the AI fill is always mocked (see
// _shared/gemini.ts flavorModel).
//
//   supabase start && supabase db reset
//   npm run test:security
//
// The worker tests need the edge runtime. They are skipped when the worker
// isn't being served, and refuse to run unless it reports the mocked model,
// so they never spend real AI quota.

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
  throw new Error(`Refusing to run flavor tests against a non-local API: ${status.API_URL}`);
}

const WORKER_URL = `${status.API_URL}/functions/v1/flavor-worker`;
const WORKER_SECRET = 'local-flavor-worker-secret';
const DIMS = ['sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy'];
const FLAVOR_COLUMNS = `item_id, ${DIMS.join(', ')}, coverage, source, spec_fingerprint, rules_version, updated_at`;

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
  const email = `${label}-${run}@flavor-test.local`;
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

/** A cocktail from [ingredient id, ml] lines. */
async function drink(name, lines, fields = {}) {
  const id = await newItem({ name, item_type: 'cocktail', ...fields });
  for (const [i, [ingredient, ml]] of lines.entries()) {
    await serviceInsert('recipes', { recipe_item_id: id, ingredient_item_id: ingredient, amount: ml, unit: 'ml', sort_order: i });
  }
  return id;
}

/** Writes a profile the way the worker does, for tests that don't need the worker. */
async function saveProfile(itemId, values) {
  const profile = Object.fromEntries(DIMS.map((d) => [d, values[d] ?? 0]));
  const { error } = await service.rpc('save_item_flavor', {
    p_item_id: itemId, p_profile: profile, p_coverage: 1, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 1,
  });
  assert.ifError(error);
}

async function flavorRow(itemId) {
  const { rows } = await db.query('SELECT * FROM public.item_flavors WHERE item_id = $1', [itemId]);
  return rows[0] ?? null;
}

async function jobFor(itemId) {
  const { rows } = await db.query('SELECT * FROM private.item_flavor_jobs WHERE item_id = $1', [itemId]);
  return rows[0] ?? null;
}

async function usage(barId) {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM private.ai_usage WHERE bar_id = $1 AND fn = 'flavor-worker'", [barId]);
  return rows[0].n;
}

/**
 * Makes these drinks' jobs due, runs the worker, and waits until each job has
 * left the worker's hands (done, or handed back for later). The cron tick may
 * wake another worker that claims them first, so the call proves nothing.
 */
async function work(...itemIds) {
  // The seed migrations queue a job for every drink they add, and the worker
  // takes the oldest first. Put that backlog off so one call only has these
  // drinks to score; draining thousands first ran it out of time (546).
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
  assert.fail('flavor jobs did not finish');
}

before(async () => {
  await db.connect();
  for (const label of ['guest', 'outsider', 'ranker', 'other']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Flavor Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.guest.id, bar_id: ids.bar, role_level: 10 });

  ids.gin = await newItem({ name: 'Gin', item_type: 'ingredient' });
  ids.campari = await newItem({ name: 'Campari', item_type: 'ingredient' });
  ids.vermouth = await newItem({ name: 'Sweet Vermouth', item_type: 'ingredient' });
  ids.rum = await newItem({ name: 'White Rum', item_type: 'ingredient' });
  ids.lime = await newItem({ name: 'Lime Juice', item_type: 'ingredient' });
  ids.syrup = await newItem({ name: 'Simple Syrup', item_type: 'ingredient' });
  // A house bottle the rules don't know. Its name must never reach the app.
  ids.secret = await newItem({ name: 'Secret Brand XO', item_type: 'ingredient' });

  ids.negroni = await drink('Negroni', [[ids.gin, 30], [ids.campari, 30], [ids.vermouth, 30]]);
  ids.daiquiri = await drink('Daiquiri', [[ids.rum, 60], [ids.lime, 22.5], [ids.syrup, 22.5]]);
  ids.barDrink = await drink('House Special', [[ids.gin, 45], [ids.secret, 30]], { bar_id: ids.bar });
  ids.hiddenDrink = await drink('Staff Only', [[ids.gin, 45]], { bar_id: ids.bar, override_visibility_level: 30 });
  // These get hand-written profiles; keep a cron-woken worker off them.
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [[ids.negroni, ids.daiquiri, ids.barDrink, ids.hiddenDrink]]);
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

describe('who can read a profile', () => {
  before(async () => {
    for (const id of [ids.negroni, ids.barDrink, ids.hiddenDrink]) await saveProfile(id, { bitter: 0.9, strong: 0.8 });
  });

  test('a shared drink\'s profile is readable by anyone signed in, not signed out', async () => {
    const { data } = await users.outsider.client.from('item_flavors').select('item_id').eq('item_id', ids.negroni);
    assert.equal(data.length, 1);
    const { data: anonData, error } = await anon.from('item_flavors').select('item_id').eq('item_id', ids.negroni);
    assert.ok(error || anonData.length === 0, 'anon reads nothing');
  });

  test('a bar drink\'s profile follows the drink: members at its level only', async () => {
    const read = async (user, item) => (await users[user].client.from('item_flavors').select('item_id').eq('item_id', item)).data.length;
    assert.equal(await read('guest', ids.barDrink), 1);
    assert.equal(await read('outsider', ids.barDrink), 0);
    assert.equal(await read('guest', ids.hiddenDrink), 0, 'visibility level 30 hides it from a guest');
  });

  test('a profile carries numbers, never ingredient names', async () => {
    const { data, error } = await users.guest.client.from('item_flavors').select('*').eq('item_id', ids.barDrink).single();
    assert.ifError(error);
    assert.deepEqual(Object.keys(data).sort(), FLAVOR_COLUMNS.split(', ').sort());
    assert.doesNotMatch(JSON.stringify(data), /Secret Brand|Gin/);
  });

  test('only the worker writes profiles', async () => {
    const client = users.guest.client;
    const { error: insertError } = await client.from('item_flavors').insert({ item_id: ids.daiquiri, sweet: 1, sour: 1, bitter: 0, strong: 0, herbal: 0, fruity: 0, smoky: 0, spicy: 0, creamy: 0, coverage: 1, source: 'rules', spec_fingerprint: 'x', rules_version: 1 });
    assert.ok(insertError, 'insert refused');
    await client.from('item_flavors').update({ bitter: 0 }).eq('item_id', ids.barDrink);
    await client.from('item_flavors').delete().eq('item_id', ids.barDrink);
    const row = await flavorRow(ids.barDrink);
    assert.ok(row && row.bitter > 0.8, 'update and delete had no effect');
  });

  test('the worker RPCs are service-role only', async () => {
    const calls = [
      ['claim_item_flavor_job', {}],
      ['get_item_flavor_spec', { p_item_id: ids.barDrink }],
      ['save_item_flavor', { p_item_id: ids.barDrink, p_profile: {}, p_coverage: 1, p_source: 'rules', p_spec_fingerprint: 'x', p_rules_version: 1 }],
      ['release_item_flavor_job', { p_item_id: ids.barDrink, p_revision: 1, p_outcome: 'failed' }],
    ];
    for (const client of [anon, users.guest.client]) {
      for (const [fn, args] of calls) {
        const { data, error } = await client.rpc(fn, args);
        assert.ok(error, `${fn} should be refused`);
        assert.doesNotMatch(JSON.stringify(data ?? ''), /Secret Brand/);
      }
    }
    const { error } = await users.guest.client.schema('private').from('ingredient_flavors').select('*');
    assert.ok(error, 'the AI cache is not exposed');
  });
});

describe('your taste', () => {
  before(async () => {
    await saveProfile(ids.negroni, { bitter: 0.9, strong: 0.8, sweet: 0.6 });
    await saveProfile(ids.daiquiri, { sour: 0.8, sweet: 0.8, strong: 0.6 });
    // Ranking needs a confirmed age (20260930500600).
    assert.ifError((await users.ranker.client.rpc('confirm_age', { p_birth_date: '1990-01-01', p_country_code: 'AU' })).error);
    const rank = (item, sentiment) =>
      users.ranker.client.from('rank_entries').insert({ item_id: item, ranked_as_item_id: item, sentiment, rank_key: 0 });
    assert.ifError((await rank(ids.negroni, 'loved')).error);
    assert.ifError((await rank(ids.daiquiri, 'disliked')).error);
  });

  test('comes from the drinks you ranked, weighted towards the ones you rank highest', async () => {
    const { data, error } = await users.ranker.client.rpc('get_my_taste');
    assert.ifError(error);
    const [taste] = data;
    assert.equal(taste.drinks, 2);
    // Loved scores 10, didn't like scores 3.3: weights 1 and 0.109.
    const w = 0.33 ** 2;
    assert.ok(Math.abs(taste.bitter - 0.9 / (1 + w)) < 0.01, `bitter ${taste.bitter}`);
    assert.ok(Math.abs(taste.sour - (0.8 * w) / (1 + w)) < 0.01, `sour ${taste.sour}`);
  });

  test('is private: no one else can read it, and signed out can\'t ask', async () => {
    const { data } = await users.other.client.rpc('get_my_taste');
    assert.equal(data[0].drinks, 0);
    assert.equal(data[0].bitter, null);
    const { error } = await anon.rpc('get_my_taste');
    assert.ok(error, 'anon refused');
    const { data: entries } = await users.other.client.from('rank_entries').select('id').eq('user_id', users.ranker.id);
    assert.equal(entries.length, 0);
  });

  test('quick answers are owner-only and hold only dimensions from 0 to 1', async () => {
    const save = (client, userId, answers) => client.from('user_prefs').upsert({ user_id: userId, taste_answers: answers });
    assert.ifError((await save(users.ranker.client, users.ranker.id, { bitter: 0.8, smoky: 0.1 })).error);
    for (const bad of [{ umami: 0.5 }, { bitter: 2 }, { bitter: 'lots' }, ['bitter']]) {
      assert.ok((await save(users.ranker.client, users.ranker.id, bad)).error, `${JSON.stringify(bad)} refused`);
    }
    const { data } = await users.other.client.from('user_prefs').select('taste_answers').eq('user_id', users.ranker.id);
    assert.equal(data.length, 0);
    assert.ok((await save(users.other.client, users.ranker.id, { bitter: 0.1 })).error, 'can\'t write someone else\'s');
  });
});

describe('the queue', () => {
  test('saving a drink queues one debounced job; a new spec changes the fingerprint', async () => {
    const id = await drink('Queued', [[ids.gin, 50], [ids.lime, 20]]);
    const job = await jobFor(id);
    assert.equal(job.status, 'pending');
    assert.equal(Number(job.revision), 3, 'item insert and two recipe lines coalesce');
    assert.ok(new Date(job.run_after) > new Date(Date.now() + 10_000), 'debounced');

    const fingerprint = async () => (await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [id])).rows[0].fp;
    const before = await fingerprint();
    await db.query('UPDATE public.recipes SET amount = 25 WHERE recipe_item_id = $1 AND ingredient_item_id = $2', [id, ids.lime]);
    assert.notEqual(await fingerprint(), before);
    assert.equal(Number((await jobFor(id)).revision), 4);
  });

  test('renaming an ingredient re-queues the drinks that use it; ingredients get no job', async () => {
    await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [ids.daiquiri]);
    await db.query('UPDATE public.items SET name = $2 WHERE id = $1', [ids.rum, `Aged Rum ${run}`]);
    assert.ok(await jobFor(ids.daiquiri));
    assert.equal(await jobFor(ids.rum), null);
  });
});

describe('flavor worker', { skip: workerSkip }, () => {
  test('refuses callers without the shared secret', async () => {
    for (const headers of [{}, { 'x-flavor-worker-secret': 'nope' }, { Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` }]) {
      const res = await fetch(WORKER_URL, { method: 'POST', headers });
      assert.equal(res.status, 401);
      await res.body?.cancel();
    }
  });

  test('scores a classic with the rules alone, and spends nothing', async () => {
    const id = await drink('Rules Negroni', [[ids.gin, 30], [ids.campari, 30], [ids.vermouth, 30]]);
    await work(id);
    const row = await flavorRow(id);
    assert.equal(row.source, 'rules');
    assert.equal(row.coverage, 1);
    assert.ok(row.bitter > 0.8 && row.strong > 0.7, `bitter ${row.bitter}, strong ${row.strong}`);
    const { rows } = await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [id]);
    assert.equal(row.spec_fingerprint, rows[0].fp);
    assert.equal(await jobFor(id), null);
  });

  test('recomputes when the spec changes', async () => {
    const id = await drink('Shifting Sour', [[ids.gin, 50], [ids.lime, 10], [ids.syrup, 10]]);
    await work(id);
    const before = await flavorRow(id);
    await db.query('UPDATE public.recipes SET amount = 30 WHERE recipe_item_id = $1 AND ingredient_item_id = $2', [id, ids.lime]);
    await work(id);
    const after = await flavorRow(id);
    assert.ok(after.sour > before.sour, 'more lime reads more sour');
    assert.notEqual(after.spec_fingerprint, before.spec_fingerprint);
  });

  test('asks the AI fill about unknown ingredients once, billed to the venue', async () => {
    const bar = (await serviceInsert('bars', { name: `AI Bar ${run}` })).id;
    const secret = await newItem({ name: 'House Tincture', item_type: 'ingredient' });
    const first = await drink('Tinctured', [[ids.gin, 45], [secret, 15]], { bar_id: bar });
    await work(first);
    let row = await flavorRow(first);
    assert.equal(row.source, 'ai');
    assert.equal(row.coverage, 1);
    assert.equal(await usage(bar), 1);
    const { rows } = await db.query('SELECT flavor FROM private.ingredient_flavors WHERE item_id = $1', [secret]);
    assert.deepEqual(rows[0].flavor, { taste: { sweet: 0.5, fruity: 0.5 }, abv: 0 });

    const second = await drink('Tinctured Again', [[ids.rum, 45], [secret, 15]], { bar_id: bar });
    await work(second);
    row = await flavorRow(second);
    assert.equal(row.source, 'ai');
    assert.equal(await usage(bar), 1, 'the cached answer is reused, not paid for again');
  });

  test('a failed AI call is refunded, keeps the rules profile, and retries later', async () => {
    const bar = (await serviceInsert('bars', { name: `Failing Bar ${run}` })).id;
    const broken = await newItem({ name: '[mock-fail] tincture', item_type: 'ingredient' });
    const id = await drink('Unlucky', [[ids.gin, 45], [broken, 15]], { bar_id: bar });
    await work(id);
    assert.equal(await usage(bar), 0, 'refunded');
    const row = await flavorRow(id);
    assert.equal(row.source, 'rules');
    assert.ok(row.coverage < 1);
    const job = await jobFor(id);
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 1);
    assert.match(job.last_error, /on purpose/);
    assert.ok(new Date(job.run_after) > new Date(), 'backs off');
  });

  test('a venue past its daily allowance waits an hour, with the rules profile meanwhile', async () => {
    const bar = (await serviceInsert('bars', { name: `Busy Bar ${run}` })).id;
    await db.query("INSERT INTO private.ai_usage (bar_id, fn) SELECT $1, 'flavor-worker' FROM generate_series(1, 1000)", [bar]);
    const unknown = await newItem({ name: 'Mystery Bottle Nine', item_type: 'ingredient' });
    const id = await drink('Waiting', [[ids.gin, 45], [unknown, 15]], { bar_id: bar });
    await work(id);
    assert.equal((await flavorRow(id)).source, 'rules');
    const job = await jobFor(id);
    assert.equal(job.attempts, 0, 'waiting for quota is not a failed attempt');
    assert.ok(new Date(job.run_after) > new Date(Date.now() + 50 * 60_000));
  });
});
