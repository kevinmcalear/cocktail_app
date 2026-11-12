// A drink and the house-mades written inside it, saved in one call
// (20261206780000_save_drink.sql, board Add-inside): the drink, its
// house-mades and their parts, and every ingredient added for a typed name,
// all or none; the same save sent again returns the same rows; it allows
// nobody more than the app's direct writes do.
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
  throw new Error(`Refusing to run drink save tests against a non-local API: ${status.API_URL}`);
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
const CARD = { yield_amount: 300, yield_unit: 'ml', shelf_life_hours: 336, lead_time_minutes: null, lead_time_note: null, storage: 'Fridge', actions: [] };

/**
 * A Gold rush with a Honey-ginger syrup started inside it, which has a part
 * (Fresh ginger juice), plus two typed lines the bar doesn't have: "Egg white"
 * (eggs, found in its name) and a house prep added by name only.
 */
const goldRush = (tag, bar, more = {}) => ({
  bar,
  drink: { id: randomUUID(), name: named(`Gold rush ${tag}`), item_type: 'cocktail', bar_id: bar },
  preps: [
    { name: named(`Honey-ginger syrup ${tag}`), lines: [{ id: ids.honey, amount: 200, unit: 'g' }, { part: 1, amount: 100, unit: 'ml' }], card: CARD, steps: [{ body: 'Warm and stir', timer_seconds: null }], allergens: null },
    { name: named(`Fresh ginger juice ${tag}`), lines: [{ name: named(`Fresh ginger ${tag}`), amount: 500, unit: 'g', allergens: [] }], card: CARD, steps: [] },
  ],
  lines: [
    { ingredient: { id: ids.bourbon, name: 'Bourbon' }, amount: 60, unit: 'ml' },
    { ingredient: { house_made: 0 }, amount: 22.5, unit: 'ml' },
    { ingredient: { name: named(`Egg white ${tag}`), allergens: ['eggs'] }, amount: 15, unit: 'ml' },
    { ingredient: { name: named(`Rosemary tincture ${tag}`), own: true }, amount: 2, unit: 'dash' },
  ],
  methods: [],
  note: null,
  ...more,
});

const save = (who, key, body) => who.client.rpc('save_drink', { p_key: key, p_save: body });
const leftBehind = (tag) => rowsNamed([`Gold rush ${tag}`, `Honey-ginger syrup ${tag}`, `Fresh ginger juice ${tag}`, `Fresh ginger ${tag}`, `Egg white ${tag}`, `Rosemary tincture ${tag}`]);

before(async () => {
  await db.connect();
  for (const label of ['manager', 'barback', 'otherManager', 'home']) users[label] = await makeUser(label);
  const bar = (name) => db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [name]).then((r) => r.rows[0].id);
  ids.bar = await bar(`drink save ${run}`);
  ids.other = await bar(`drink save other ${run}`);
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 20), ($4, $5, 40)', [ids.bar, users.manager.id, users.barback.id, ids.other, users.otherManager.id]);
  const item = (name, type = 'ingredient') => db.query('INSERT INTO public.items (name, item_type) VALUES ($1, $2) RETURNING id', [named(name), type]).then((r) => r.rows[0].id);
  ids.honey = await item('Honey');
  ids.bourbon = await item('Bourbon');
});

after(async () => {
  const mine = `SELECT id FROM public.items WHERE name LIKE '%' || $1 || '%'`;
  await db.query(`DELETE FROM public.recipes WHERE recipe_item_id IN (${mine}) OR ingredient_item_id IN (${mine})`, [run]);
  await db.query(`DELETE FROM public.items WHERE id IN (${mine}) AND item_type = 'cocktail'`, [run]);
  await db.query(`DELETE FROM public.items WHERE id IN (${mine}) AND generic_id IS NOT NULL`, [run]);
  await db.query(`DELETE FROM public.items WHERE id IN (${mine})`, [run]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.other]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('save_drink', () => {
  test('saves the drink, its house-made and part, and the typed names, in one call', async () => {
    const body = goldRush('home', null);
    const { data, error } = await save(users.home, randomUUID(), body);
    assert.ifError(error);
    assert.equal(data.item, body.drink.id);
    assert.equal(data.house_mades.length, 2);
    const [syrup, juice] = data.house_mades;
    const lines = (await db.query('SELECT ingredient_item_id FROM public.recipes WHERE recipe_item_id = $1 ORDER BY sort_order', [data.item])).rows.map((r) => r.ingredient_item_id);
    assert.deepEqual(lines, data.lines.map((l) => l.id));
    assert.equal(lines[0], ids.bourbon);
    assert.equal(lines[1], syrup);
    assert.deepEqual(data.lines.map((l) => l.new), [false, false, true, true]);
    const syrupLines = (await db.query('SELECT ingredient_item_id FROM public.recipes WHERE recipe_item_id = $1 ORDER BY sort_order', [syrup])).rows;
    assert.equal(syrupLines[1].ingredient_item_id, juice);
    const own = await db.query('SELECT ingredient_role, bar_id FROM public.items WHERE id = $1', [lines[3]]);
    assert.deepEqual(own.rows, [{ ingredient_role: 'prep', bar_id: null }]);
  });

  test('allergens found in a new name are stored, and the drink rolls them up', async () => {
    const body = goldRush('allergens', null);
    const { data, error } = await save(users.home, randomUUID(), body);
    assert.ifError(error);
    const egg = data.lines[2].id;
    const stored = await db.query('SELECT allergen, bar_id FROM public.item_allergens WHERE item_id = $1', [egg]);
    assert.deepEqual(stored.rows, [{ allergen: 'eggs', bar_id: null }]);
    // A guess, not a check: nobody marked it checked.
    assert.equal((await db.query('SELECT 1 FROM public.item_allergen_checks WHERE item_id = $1', [egg])).rowCount, 0);
    const rollup = (await db.query('SELECT private.allergen_rollup($1) AS r', [data.item])).rows[0].r;
    assert.deepEqual(rollup.allergens.map((a) => a.allergen), ['eggs']);
  });

  test('sent again after it went through, it returns the same rows and makes none', async () => {
    const key = randomUUID();
    const body = goldRush('retry', null);
    const first = await save(users.home, key, body);
    assert.ifError(first.error);
    const before = await leftBehind('retry');
    const again = await save(users.home, key, body);
    assert.ifError(again.error);
    assert.deepEqual(again.data, first.data);
    assert.deepEqual((await leftBehind('retry')).length, before.length);
    // The same key with other content is a new save (an edit after a lost reply), never the old rows.
    const changed = await save(users.home, key, { ...body, note: 'changed' });
    assert.ok(changed.error, 'a second save under taken names is refused, as before');
  });

  test('if any of it can’t save, none of it is left: the spec refused at the very end', async () => {
    // save_drink_spec runs last and refuses a method part with no method.
    const { error } = await save(users.home, randomUUID(), goldRush('fails', null, { methods: [], method_parts: [1] }));
    assert.ok(error, 'expected the save to be refused');
    assert.match(error.message, /Give each method its part/);
    assert.deepEqual(await leftBehind('fails'), []);
  });

  test('at a venue its manager saves it; the house-mades are the venue’s', async () => {
    const { data, error } = await save(users.manager, randomUUID(), goldRush('venue', ids.bar));
    assert.ifError(error);
    const rows = await db.query('SELECT bar_id FROM public.items WHERE id = ANY($1)', [[data.item, ...data.house_mades, data.lines[2].id]]);
    assert.ok(rows.rows.every((r) => r.bar_id === ids.bar));
  });

  test('a barback, a manager of another bar and anon are refused, and nothing is left', async () => {
    const barback = await save(users.barback, randomUUID(), goldRush('barback', ids.bar));
    assert.ok(barback.error, 'barback refused');
    assert.deepEqual(await leftBehind('barback'), []);
    const other = await save(users.otherManager, randomUUID(), goldRush('other', ids.bar));
    assert.ok(other.error, 'another bar’s manager refused');
    assert.deepEqual(await leftBehind('other'), []);
    const nobody = await anon.rpc('save_drink', { p_key: randomUUID(), p_save: goldRush('anon', null) });
    assert.ok(nobody.error, 'anon refused');
    assert.deepEqual(await leftBehind('anon'), []);
  });

  test('editing another bar’s drink through it is refused, and its house-mades go too', async () => {
    const made = await save(users.manager, randomUUID(), goldRush('theirs', ids.bar));
    assert.ifError(made.error);
    const { drink: _d, ...edit } = goldRush('edit', ids.other);
    const { error } = await save(users.manager, randomUUID(), { ...edit, item: made.data.item });
    assert.ok(error, 'expected the edit to be refused');
    const { drink: _d2, ...mine } = goldRush('edit2', ids.other);
    const theirs = await save(users.otherManager, randomUUID(), { ...mine, item: made.data.item });
    assert.ok(theirs.error, 'expected the other manager to be refused');
    assert.deepEqual([...(await leftBehind('edit')), ...(await leftBehind('edit2'))], []);
  });

  test('the cap counts the drink’s house-mades and parts together: 20 in one save', async () => {
    const preps = Array.from({ length: 21 }, (_, i) => ({ name: named(`Cap syrup ${i}`), lines: [{ id: ids.honey, amount: 1, unit: 'g' }], card: CARD, steps: [] }));
    const body = { ...goldRush('cap', null), preps, lines: preps.map((_, i) => ({ ingredient: { house_made: i }, amount: 1, unit: 'ml' })) };
    const { error } = await save(users.home, randomUUID(), body);
    assert.ok(error, 'expected the save to be refused');
    assert.match(error.message, /too many parts/);
    assert.deepEqual(await rowsNamed(preps.map((_, i) => `Cap syrup ${i}`)), []);
  });
});
