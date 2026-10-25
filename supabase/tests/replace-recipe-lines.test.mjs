// Replacing an item's recipe lines (20261113200000_replace_recipe_lines.sql):
// replace_recipe_lines swaps them in one transaction, so a save that fails
// part way keeps the recipe it had, and it lets exactly the people the
// recipes policies let write lines directly (can_edit_item, or Prep at the
// venue for its own ice).
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
  throw new Error(`Refusing to run recipe line tests against a non-local API: ${status.API_URL}`);
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

const item = (name, type, bar = ids.bar) =>
  db.query('INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, $2, $3) RETURNING id', [`${name} ${run}`, type, bar]).then((r) => r.rows[0].id);

const lines = (itemId) =>
  db.query('SELECT id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order, at_service FROM public.recipes WHERE recipe_item_id = $1 ORDER BY sort_order', [itemId]).then((r) => r.rows);

/** Two lines, written as the database: lemon 30 ml, sugar 15 ml. */
async function reset(itemId) {
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [itemId]);
  await db.query(
    "INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 30, 'ml', 0), ($1, $3, 15, 'ml', 1)",
    [itemId, ids.lemon, ids.sugar]
  );
  return lines(itemId);
}

before(async () => {
  await db.connect();
  // manager: Edit drinks. prepper: a bartender given Prep, without Edit drinks. barback: neither. outsider: another venue's manager.
  for (const label of ['manager', 'prepper', 'barback', 'outsider']) users[label] = await makeUser(label);
  for (const key of ['bar', 'other']) {
    ids[key] = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`recipe lines ${key} ${run}`])).rows[0].id;
  }
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30), ($1, $4, 20), ($5, $6, 40)', [
    ids.bar, users.manager.id, users.prepper.id, users.barback.id, ids.other, users.outsider.id,
  ]);
  await db.query("INSERT INTO public.venue_level_overrides (bar_id, base_level, granted) VALUES ($1, 30, '{prep}')", [ids.bar]);
  ids.lemon = await item('Lemon', 'ingredient');
  ids.sugar = await item('Sugar', 'ingredient');
  ids.water = await item('Water', 'ingredient');
  ids.prep = await item('Sherbet', 'ingredient');
  ids.drink = await item('Sour', 'cocktail');
  const { data: ice, error } = await users.prepper.client.rpc('save_venue_ice', { p_bar_id: ids.bar, p_name: `Cube ${run}`, p_shape: 'large', p_source: 'made' });
  if (error) throw error;
  ids.ice = ice;
});

after(async () => {
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id IN (SELECT id FROM public.items WHERE bar_id = ANY($1))', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.items WHERE bar_id = ANY($1)', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.other]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('replace_recipe_lines', () => {
  test('swaps the lines: kept rows keep their id and what hangs off them, new ones are added, the rest go', async () => {
    const [lemon, sugar] = await reset(ids.prep);
    await db.query('UPDATE public.recipes SET at_service = true WHERE id = $1', [sugar.id]);
    const { error } = await users.manager.client.rpc('replace_recipe_lines', {
      p_item: ids.prep,
      p_lines: [
        { id: sugar.id, ingredient_item_id: ids.sugar, amount: 20, unit: 'ml', preparation_notes: 'fine', is_optional: false },
        { id: null, ingredient_item_id: ids.water, amount: 10, unit: 'ml', preparation_notes: null, is_optional: true },
      ],
    });
    assert.ifError(error);
    const after = await lines(ids.prep);
    assert.equal(after.length, 2);
    assert.deepEqual(
      { ...after[0], amount: Number(after[0].amount) },
      { id: sugar.id, ingredient_item_id: ids.sugar, amount: 20, unit: 'ml', preparation_notes: 'fine', is_optional: false, sort_order: 0, at_service: true }
    );
    assert.equal(after[1].ingredient_item_id, ids.water);
    assert.equal(after[1].sort_order, 1);
    assert.equal(after[1].is_optional, true);
    assert.ok(!after.some((l) => l.id === lemon.id), 'the line left out is removed');
  });

  test('an empty list clears the recipe', async () => {
    await reset(ids.prep);
    const { error } = await users.manager.client.rpc('replace_recipe_lines', { p_item: ids.prep, p_lines: [] });
    assert.ifError(error);
    assert.deepEqual(await lines(ids.prep), []);
  });

  test('all or nothing: a line that fails part way keeps the recipe it had', async () => {
    const before = await reset(ids.prep);
    const good = { id: before[0].id, ingredient_item_id: ids.water, amount: 5, unit: 'ml', preparation_notes: null, is_optional: false };
    // A line naming an ingredient that doesn't exist fails on its foreign key, after the first line was written.
    const { error: missing } = await users.manager.client.rpc('replace_recipe_lines', {
      p_item: ids.prep,
      p_lines: [good, { ingredient_item_id: randomUUID(), amount: 1, unit: 'ml' }],
    });
    assert.ok(missing, 'an unknown ingredient is refused');
    assert.deepEqual(await lines(ids.prep), before);
    const { error: blank } = await users.manager.client.rpc('replace_recipe_lines', { p_item: ids.prep, p_lines: [good, { amount: 1 }] });
    assert.match(blank?.message ?? '', /needs an ingredient/);
    assert.deepEqual(await lines(ids.prep), before);
    const { error: notList } = await users.manager.client.rpc('replace_recipe_lines', { p_item: ids.prep, p_lines: { ingredient_item_id: ids.water } });
    assert.ok(notList, 'lines must be a list');
    assert.deepEqual(await lines(ids.prep), before);
  });

  test('a line id from another item is a new row there, and the other item is untouched', async () => {
    const drinkLines = await reset(ids.drink);
    await reset(ids.prep);
    const { error } = await users.manager.client.rpc('replace_recipe_lines', {
      p_item: ids.prep,
      p_lines: [{ id: drinkLines[0].id, ingredient_item_id: ids.water, amount: 1, unit: 'ml' }],
    });
    assert.ifError(error);
    const prepLines = await lines(ids.prep);
    assert.equal(prepLines.length, 1);
    assert.notEqual(prepLines[0].id, drinkLines[0].id);
    assert.deepEqual(await lines(ids.drink), drinkLines);
  });

  test('allows exactly whom the recipes policies allow, and a refusal changes nothing', async () => {
    const who = { manager: users.manager.client, prepper: users.prepper.client, barback: users.barback.client, outsider: users.outsider.client, anon };
    const expected = {
      manager: { prep: true, drink: true, ice: true },
      prepper: { prep: false, drink: false, ice: true },
      barback: { prep: false, drink: false, ice: false },
      outsider: { prep: false, drink: false, ice: false },
      anon: { prep: false, drink: false, ice: false },
    };
    for (const [label, client] of Object.entries(who)) {
      for (const key of ['prep', 'drink', 'ice']) {
        // Today's rule: a direct insert of a line.
        await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [ids[key]]);
        const { error: directError } = await client.from('recipes').insert({ recipe_item_id: ids[key], ingredient_item_id: ids.water, sort_order: 0 });
        const direct = !directError;
        const before = await reset(ids[key]);
        const { error } = await client.rpc('replace_recipe_lines', { p_item: ids[key], p_lines: [{ ingredient_item_id: ids.water, amount: 1, unit: 'ml' }] });
        assert.equal(!error, direct, `${label} on the ${key}: the RPC matches a direct write`);
        assert.equal(direct, expected[label][key], `${label} on the ${key}`);
        if (error) assert.deepEqual(await lines(ids[key]), before, `${label} refused on the ${key} leaves its lines`);
      }
    }
  });
});
