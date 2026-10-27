// Saving a prep card in one transaction (20261125200000_save_prep_spec.sql):
// save_prep_spec writes the card, replaces the steps and, when asked, the
// recipe lines, so a save that fails part way keeps what the prep had. It
// lets exactly the people the item_prep policies let write directly.
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
  throw new Error(`Refusing to run prep spec tests against a non-local API: ${status.API_URL}`);
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

/** The card, its steps and its lines, as the database has them. */
async function card(itemId) {
  const prep = await db.query('SELECT yield_amount::float AS yield_amount, yield_unit, shelf_life_hours, lead_time_minutes, lead_time_note, storage, actions FROM public.item_prep WHERE item_id = $1', [itemId]);
  const steps = await db.query('SELECT position, body, timer_seconds, equipment FROM public.item_steps WHERE item_id = $1 ORDER BY position', [itemId]);
  return { prep: prep.rows[0] ?? null, steps: steps.rows, lines: await lines(itemId) };
}

/** A filled card written as the database: 500 ml, two steps, lemon and sugar. */
async function reset(itemId) {
  await db.query('DELETE FROM public.item_steps WHERE item_id = $1', [itemId]);
  await db.query('DELETE FROM public.item_prep WHERE item_id = $1', [itemId]);
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1', [itemId]);
  await db.query("INSERT INTO public.item_prep (item_id, yield_amount, yield_unit, storage, actions) VALUES ($1, 500, 'ml', 'Fridge', '{Stir}')", [itemId]);
  await db.query("INSERT INTO public.item_steps (item_id, position, body) VALUES ($1, 0, 'Zest the lemons'), ($1, 1, 'Stir in the sugar')", [itemId]);
  await db.query(
    "INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 30, 'ml', 0), ($1, $3, 15, 'ml', 1)",
    [itemId, ids.lemon, ids.sugar]
  );
  return card(itemId);
}

before(async () => {
  await db.connect();
  // manager: Edit drinks. prepper: a bartender given Prep, without Edit drinks. barback: neither. outsider: another venue's manager.
  for (const label of ['manager', 'prepper', 'barback', 'outsider']) users[label] = await makeUser(label);
  for (const key of ['bar', 'other']) {
    ids[key] = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`prep spec ${key} ${run}`])).rows[0].id;
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
  await db.query('DELETE FROM public.item_steps WHERE item_id IN (SELECT id FROM public.items WHERE bar_id = ANY($1))', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.item_prep WHERE item_id IN (SELECT id FROM public.items WHERE bar_id = ANY($1))', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.items WHERE bar_id = ANY($1)', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.other]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

const PREP = { yield_amount: 750, yield_unit: 'ml', shelf_life_hours: 72, lead_time_minutes: 30, lead_time_note: null, storage: 'Freezer', actions: ['Freeze'] };

describe('save_prep_spec', () => {
  test('saves the card and replaces the steps, skipping blank ones; the lines stay without p_lines', async () => {
    const before = await reset(ids.prep);
    const { error } = await users.manager.client.rpc('save_prep_spec', {
      p_item: ids.prep,
      p_prep: PREP,
      p_steps: [{ body: '  Juice them  ', timer_seconds: 60, equipment: [] }, { body: ' ', timer_seconds: null, equipment: [] }, { body: 'Bottle it', timer_seconds: null }],
    });
    assert.ifError(error);
    const after = await card(ids.prep);
    assert.deepEqual(after.prep, { ...PREP });
    assert.deepEqual(after.steps, [
      { position: 0, body: 'Juice them', timer_seconds: 60, equipment: [] },
      { position: 1, body: 'Bottle it', timer_seconds: null, equipment: [] },
    ]);
    assert.deepEqual(after.lines, before.lines);
  });

  test('with p_lines, the recipe lines are replaced in the same save', async () => {
    await reset(ids.ice);
    const { error } = await users.prepper.client.rpc('save_prep_spec', { p_item: ids.ice, p_prep: PREP, p_steps: [], p_lines: [{ ingredient_item_id: ids.water }] });
    assert.ifError(error);
    const after = await card(ids.ice);
    assert.deepEqual(after.steps, []);
    assert.deepEqual(after.lines.map((l) => l.ingredient_item_id), [ids.water]);
  });

  test('all or nothing: a step or a line that fails keeps the card, steps and lines it had', async () => {
    const before = await reset(ids.prep);
    // The second step breaks a check (a timer over a day) after the steps were deleted and the first written.
    const { error: badStep } = await users.manager.client.rpc('save_prep_spec', {
      p_item: ids.prep,
      p_prep: PREP,
      p_steps: [{ body: 'One', timer_seconds: null }, { body: 'Two', timer_seconds: 999999 }],
    });
    assert.ok(badStep, 'a step over the timer limit is refused');
    assert.deepEqual(await card(ids.prep), before);
    // A line naming an ingredient that doesn't exist fails after the card and steps were written.
    const { error: badLine } = await users.manager.client.rpc('save_prep_spec', {
      p_item: ids.prep,
      p_prep: PREP,
      p_steps: [{ body: 'One', timer_seconds: null }],
      p_lines: [{ ingredient_item_id: randomUUID() }],
    });
    assert.ok(badLine, 'an unknown ingredient is refused');
    assert.deepEqual(await card(ids.prep), before);
    const { error: notList } = await users.manager.client.rpc('save_prep_spec', { p_item: ids.prep, p_prep: PREP, p_steps: { body: 'One' } });
    assert.ok(notList, 'steps must be a list');
    assert.deepEqual(await card(ids.prep), before);
  });

  test('allows exactly whom the item_prep policies allow, and a refusal changes nothing', async () => {
    const who = { manager: users.manager.client, prepper: users.prepper.client, barback: users.barback.client, outsider: users.outsider.client, anon };
    const expected = {
      manager: { prep: true, ice: true },
      prepper: { prep: true, ice: true },
      barback: { prep: false, ice: false },
      outsider: { prep: false, ice: false },
      anon: { prep: false, ice: false },
    };
    for (const [label, client] of Object.entries(who)) {
      for (const key of ['prep', 'ice']) {
        // Today's rule: a direct write of the card.
        await db.query('DELETE FROM public.item_prep WHERE item_id = $1', [ids[key]]);
        const { error: directError } = await client.from('item_prep').insert({ item_id: ids[key], storage: 'Shelf' });
        const direct = !directError;
        const before = await reset(ids[key]);
        const { error } = await client.rpc('save_prep_spec', { p_item: ids[key], p_prep: PREP, p_steps: [{ body: 'Mine', timer_seconds: null }] });
        assert.equal(!error, direct, `${label} on the ${key}: the RPC matches a direct write`);
        assert.equal(direct, expected[label][key], `${label} on the ${key}`);
        if (error) assert.deepEqual(await card(ids[key]), before, `${label} refused on the ${key} leaves its card`);
      }
    }
  });
});
