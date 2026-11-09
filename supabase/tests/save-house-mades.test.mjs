// A house-made made in parts, saved all at once (20261206760000_save_house_mades.sql,
// board Add-parts: "If one can't save, none do"). Penicillin batch uses
// Honey-ginger syrup, which uses Fresh ginger juice: three rows with their
// lines, cards and steps in one call, or nothing at all.
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
  throw new Error(`Refusing to run house-made tests against a non-local API: ${status.API_URL}`);
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

const named = (n) => `${n} ${run}`;
const rowsNamed = (names) => db.query('SELECT id, name FROM public.items WHERE name = ANY($1)', [names.map(named)]).then((r) => r.rows);
const CARD = { yield_amount: 800, yield_unit: 'ml', shelf_life_hours: 336, lead_time_minutes: null, lead_time_note: null, storage: 'Fridge', actions: [] };

/** Penicillin batch, its Honey-ginger syrup and that one's Fresh ginger juice, as the app sends them. */
const penicillin = (juice = 'Fresh ginger juice') => [
  {
    name: named('Penicillin batch'),
    lines: [{ name: named('Blended scotch'), bottle: true, amount: 500, unit: 'ml' }, { part: 1, amount: 200, unit: 'ml' }, { id: ids.water, amount: 125, unit: 'ml', note: 'for dilution' }],
    card: { ...CARD, yield_amount: 825 },
    steps: [{ body: 'Stir everything in a jug', timer_seconds: null }],
    base: 0,
    allergens: null,
  },
  {
    name: named('Honey-ginger syrup'),
    lines: [{ id: ids.honey, amount: 500, unit: 'g' }, { id: ids.water, amount: 250, unit: 'ml' }, { part: 2, amount: 100, unit: 'ml' }],
    card: CARD,
    steps: [{ body: 'Warm, stir, rest 20 min', timer_seconds: 1200 }],
    allergens: ['sulphites'],
  },
  { name: named(juice), lines: [{ name: named('Fresh ginger'), amount: 1000, unit: 'g', note: 'unpeeled' }], card: { ...CARD, shelf_life_hours: 72 }, steps: [{ body: 'Juice, strain fine', timer_seconds: null }] },
];

before(async () => {
  await db.connect();
  for (const label of ['manager', 'barback', 'home']) users[label] = await makeUser(label);
  ids.bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`house-mades ${run}`])).rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 20)', [ids.bar, users.manager.id, users.barback.id]);
  const item = (name) => db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'ingredient', $2) RETURNING id", [named(name), ids.bar]).then((r) => r.rows[0].id);
  ids.honey = await item('Honey');
  ids.water = await item('Water');
  ids.taken = await item('Taken juice');
  ids.shared = (await db.query("INSERT INTO public.items (name, item_type) VALUES ($1, 'ingredient') RETURNING id", [named('Shared cordial')])).rows[0].id;
});

after(async () => {
  const mine = `SELECT id FROM public.items WHERE bar_id = $1 OR name LIKE '%' || $2`;
  await db.query(`DELETE FROM public.recipes WHERE recipe_item_id IN (${mine})`, [ids.bar, run]);
  await db.query(`DELETE FROM public.items WHERE id IN (${mine}) AND generic_id IS NOT NULL`, [ids.bar, run]);
  await db.query(`DELETE FROM public.items WHERE id IN (${mine})`, [ids.bar, run]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('save_house_mades', () => {
  test('saves the house-made and its parts together, each its own row, linked by its lines', async () => {
    const { data, error } = await users.manager.client.rpc('save_house_mades', { p_bar: ids.bar, p_preps: penicillin() });
    assert.ifError(error);
    assert.equal(data.length, 3);
    const [batch, syrup, juice] = data;
    const items = await db.query('SELECT id, bar_id, ingredient_role, made_from_id FROM public.items WHERE id = ANY($1)', [data]);
    for (const row of items.rows) {
      assert.equal(row.bar_id, ids.bar);
      assert.equal(row.ingredient_role, 'prep');
    }
    const lines = async (id) => (await db.query('SELECT ingredient_item_id, amount::float AS amount, unit, preparation_notes FROM public.recipes WHERE recipe_item_id = $1 ORDER BY sort_order', [id])).rows;
    const batchLines = await lines(batch);
    assert.equal(batchLines[1].ingredient_item_id, syrup);
    assert.equal(batchLines[2].preparation_notes, 'for dilution');
    assert.equal((await lines(syrup))[2].ingredient_item_id, juice);
    // A new name on a line is added once, here; a bottle base makes the batch "made from" it.
    const scotch = (await rowsNamed(['Blended scotch']))[0];
    assert.equal(batchLines[0].ingredient_item_id, scotch.id);
    assert.equal(items.rows.find((r) => r.id === batch).made_from_id, scotch.id);
    assert.equal((await rowsNamed(['Fresh ginger'])).length, 1);
    const card = await db.query('SELECT shelf_life_hours FROM public.item_prep WHERE item_id = $1', [juice]);
    assert.equal(card.rows[0].shelf_life_hours, 72);
    const steps = await db.query('SELECT body, timer_seconds FROM public.item_steps WHERE item_id = $1', [syrup]);
    assert.deepEqual(steps.rows, [{ body: 'Warm, stir, rest 20 min', timer_seconds: 1200 }]);
    const allergens = await db.query('SELECT allergen FROM public.item_allergens WHERE item_id = $1', [syrup]);
    assert.deepEqual(allergens.rows, [{ allergen: 'sulphites' }]);
  });

  test('if one part can’t save, none do: a part named like one the bar has', async () => {
    const { error } = await users.manager.client.rpc('save_house_mades', { p_bar: ids.bar, p_preps: penicillin('Taken juice').map((p, i) => (i < 2 ? { ...p, name: p.name.replace(run, `${run} again`) } : p)) });
    assert.ok(error, 'expected the save to be refused');
    assert.match(error.message, /already here/);
    const left = await db.query('SELECT name FROM public.items WHERE name LIKE $1', [`%${run} again`]);
    assert.equal((await rowsNamed(['Taken juice'])).length, 1);
    assert.deepEqual(left.rows, []);
  });

  test('a shared ingredient’s name at a venue makes the venue’s own version, linked to it', async () => {
    const { data, error } = await users.manager.client.rpc('save_house_mades', { p_bar: ids.bar, p_preps: [{ name: named('Shared cordial'), lines: [{ id: ids.water, amount: 100, unit: 'ml' }], card: CARD, steps: [] }] });
    assert.ifError(error);
    const row = await db.query('SELECT generic_id, bar_id FROM public.items WHERE id = $1', [data[0]]);
    assert.deepEqual(row.rows[0], { generic_id: ids.shared, bar_id: ids.bar });
  });

  test('at home a taken name is refused, and nothing is kept', async () => {
    const preps = [
      { name: named('Home batch'), lines: [{ part: 1, amount: 100, unit: 'ml' }], card: CARD, steps: [] },
      { name: named('Shared cordial'), lines: [], card: CARD, steps: [] },
    ];
    const { error } = await users.home.client.rpc('save_house_mades', { p_bar: null, p_preps: preps });
    assert.ok(error);
    assert.match(error.message, /Name this one/);
    assert.deepEqual(await rowsNamed(['Home batch']), []);
  });

  test('only people who can make house-mades here can save them, and a refusal keeps nothing', async () => {
    const { error } = await users.barback.client.rpc('save_house_mades', { p_bar: ids.bar, p_preps: [{ name: named('Barback syrup'), lines: [], card: CARD, steps: [] }] });
    assert.ok(error);
    assert.deepEqual(await rowsNamed(['Barback syrup']), []);
    const signedOut = await anon.rpc('save_house_mades', { p_bar: ids.bar, p_preps: [{ name: named('Anon syrup'), lines: [], card: CARD, steps: [] }] });
    assert.ok(signedOut.error);
    assert.deepEqual(await rowsNamed(['Anon syrup']), []);
  });
});
