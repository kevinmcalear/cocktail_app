// A home prep's method stays with its maker
// (20261012410000_home_prep_steps_private.sql): people who can see a published
// drink see its home prep's name, but not its prep card (item_prep) or steps
// (item_steps). Catalog and venue preps read as before.
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
  throw new Error(`Refusing to run home prep tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = { anon: { client: createClient(status.API_URL, status.ANON_KEY, clientOptions) } };
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

async function item(row) {
  const cols = Object.keys(row);
  const { rows } = await db.query(
    `INSERT INTO public.items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row)
  );
  return rows[0].id;
}

/** A prep with a card and two steps. */
async function withCard(id) {
  await db.query("INSERT INTO public.item_prep (item_id, yield_amount, yield_unit, storage) VALUES ($1, 500, 'ml', 'Fridge')", [id]);
  await db.query("INSERT INTO public.item_steps (item_id, position, body) VALUES ($1, 0, 'Warm it.'), ($1, 1, 'Strain it.')", [id]);
}

/** What a client reads of an item: the row, its prep card and its steps. */
async function reads(who, id) {
  const client = users[who].client;
  const [card, steps] = await Promise.all([
    client.from('item_prep').select('item_id, yield_amount, storage').eq('item_id', id),
    client.from('item_steps').select('position, body').eq('item_id', id),
  ]);
  for (const r of [card, steps]) assert.ifError(r.error);
  let row = 0;
  if (who !== 'anon') {
    const found = await client.from('items').select('id, name').eq('id', id);
    assert.ifError(found.error);
    row = found.data.length;
  }
  return { row, card: card.data.length, steps: steps.data.length };
}

before(async () => {
  await db.connect();
  for (const label of ['maker', 'stranger', 'moderator', 'creator', 'bartender']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await db.query('INSERT INTO public.profiles (kind, handle, display_name, user_id, is_public) VALUES ($1, $2, $3, $4, true)', [
    'person', `prepmaker${run}`, `Prep Maker ${run}`, users.maker.id,
  ]);

  // A home prep with a card and steps, in a published home drink.
  ids.homePrep = await item({ name: `Quince cordial ${run}`, item_type: 'ingredient', created_by: users.maker.id, ingredient_role: 'prep' });
  await withCard(ids.homePrep);
  ids.drink = await item({ name: `Quince Fizz ${run}`, item_type: 'cocktail', created_by: users.maker.id, publish_mode: 'spec' });
  await db.query("INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 1, 'oz', 0)", [ids.drink, ids.homePrep]);

  // Shared catalog preps: no creator, and a creator's row marked catalog.
  ids.catalogPrep = await item({ name: `Orgeat ${run}`, item_type: 'ingredient', ingredient_role: 'prep' });
  await withCard(ids.catalogPrep);
  ids.catalogFlagged = await item({ name: `Falernum ${run}`, item_type: 'ingredient', ingredient_role: 'prep', created_by: users.moderator.id, is_catalog: true });
  await withCard(ids.catalogFlagged);

  // A venue's prep: house_made and prep open at Drink Creator (35).
  ids.venue = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Prep Privacy Bar ${run}`])).rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 35), ($1, $3, 30)', [
    ids.venue, users.creator.id, users.bartender.id,
  ]);
  ids.venuePrep = await item({ name: `Venue shrub ${run}`, item_type: 'ingredient', ingredient_role: 'prep', bar_id: ids.venue });
  await withCard(ids.venuePrep);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.venue]);
  for (const [label, user] of Object.entries(users)) if (label !== 'anon') await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe("a home prep in a published drink", () => {
  test('another signed-in person sees the drink and the prep, but not its card or steps', async () => {
    assert.equal((await reads('stranger', ids.drink)).row, 1);
    assert.deepEqual(await reads('stranger', ids.homePrep), { row: 1, card: 0, steps: 0 });
  });

  test('a signed-out reader gets no card or steps', async () => {
    assert.deepEqual(await reads('anon', ids.homePrep), { row: 0, card: 0, steps: 0 });
  });

  test('a venue member who shares nothing with it gets none either', async () => {
    const r = await reads('creator', ids.homePrep);
    assert.equal(r.card + r.steps, 0);
  });

  test('its maker, and a moderator, still read all of it', async () => {
    assert.deepEqual(await reads('maker', ids.homePrep), { row: 1, card: 1, steps: 2 });
    assert.deepEqual(await reads('moderator', ids.homePrep), { row: 1, card: 1, steps: 2 });
  });

  test('another person cannot write a card or steps onto it', async () => {
    const steps = await users.stranger.client.from('item_steps').insert({ item_id: ids.homePrep, position: 9, body: 'Not mine.' });
    assert.ok(steps.error, 'step insert should be refused');
    const card = await users.stranger.client.from('item_prep').update({ storage: 'Shelf' }).eq('item_id', ids.homePrep).select('item_id');
    assert.ifError(card.error);
    assert.equal(card.data.length, 0);
  });
});

describe('unchanged', () => {
  test("catalog preps' cards and steps read for every signed-in person", async () => {
    for (const id of [ids.catalogPrep, ids.catalogFlagged]) {
      assert.deepEqual(await reads('stranger', id), { row: 1, card: 1, steps: 2 });
    }
  });

  test('signed out, catalog cards and steps still read nothing (no anon policy)', async () => {
    assert.deepEqual(await reads('anon', ids.catalogPrep), { row: 0, card: 0, steps: 0 });
  });

  test("a venue prep's card and steps follow the venue's house-made rule", async () => {
    assert.deepEqual(await reads('creator', ids.venuePrep), { row: 1, card: 1, steps: 2 });
    for (const who of ['bartender', 'stranger']) {
      const r = await reads(who, ids.venuePrep);
      assert.equal(r.card + r.steps, 0, who);
    }
  });
});
