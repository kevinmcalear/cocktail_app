// Bring in batches (20261013800000_bring_in_batches.sql): a bring-in is
// recorded so "Undo all" can take back what it made until tomorrow. A batch is
// yours alone, and undo runs as you, so a batch naming someone else's things
// removes nothing of theirs.
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
  throw new Error(`Refusing to run bring-in tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};

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

const exists = async (id) => (await db.query('SELECT 1 FROM public.items WHERE id = $1', [id])).rowCount === 1;

before(async () => {
  await db.connect();
  for (const label of ['maker', 'stranger']) users[label] = await makeUser(label);
});

after(async () => {
  const ids = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM public.bring_in_batches WHERE user_id = ANY ($1)', [ids]);
  await db.query('DELETE FROM public.items WHERE created_by = ANY ($1)', [ids]);
  for (const id of ids) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('bring_in_batches', () => {
  test('a batch is yours: others can neither read it nor write one as you', async () => {
    const { maker, stranger } = users;
    const mine = await maker.client.from('bring_in_batches').insert({ source: 'a photo', title: `Spring ${run}` }).select('id, user_id').single();
    assert.ifError(mine.error);
    assert.equal(mine.data.user_id, maker.id);

    const peek = await stranger.client.from('bring_in_batches').select('id').eq('id', mine.data.id);
    assert.ifError(peek.error);
    assert.equal(peek.data.length, 0);

    const forged = await stranger.client.from('bring_in_batches').insert({ user_id: maker.id, source: 'a photo', title: 'Forged' });
    assert.ok(forged.error, 'inserting a batch as someone else is refused');

    const undoneAlready = await maker.client.from('bring_in_batches').insert({ source: 'a photo', title: 'Pre-undone', undone_at: new Date().toISOString() });
    assert.ok(undoneAlready.error, 'a batch starts not undone');

    const edit = await maker.client.from('bring_in_batches').update({ title: 'Changed' }).eq('id', mine.data.id).select('id');
    assert.equal(edit.data?.length ?? 0, 0, 'batches are not edited directly');

    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const anonRead = await anon.from('bring_in_batches').select('id');
    assert.ok(anonRead.error || anonRead.data.length === 0);
  });

  test('undo removes what the batch made, puts prices back, and only once', async () => {
    const { maker } = users;
    const prep = await item({ name: `Fig syrup ${run}`, item_type: 'ingredient', created_by: maker.id, ingredient_role: 'prep' });
    const drink = await item({ name: `Rye & Fig ${run}`, item_type: 'cocktail', created_by: maker.id });
    await db.query("INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 1, 'oz', 0)", [drink, prep]);
    const had = await item({ name: `Had it ${run}`, item_type: 'cocktail', created_by: maker.id, price: '16' });
    const changed = await item({ name: `Repriced ${run}`, item_type: 'cocktail', created_by: maker.id, price: '20' });

    const batch = await maker.client
      .from('bring_in_batches')
      .insert({ source: 'a photo', title: `Undo ${run}`, item_ids: [prep, drink], prices: [{ id: had, price: '16' }, { id: changed, price: '15' }] })
      .select('id')
      .single();
    assert.ifError(batch.error);

    const undo = await maker.client.rpc('undo_bring_in', { p_batch: batch.data.id });
    assert.ifError(undo.error);
    assert.deepEqual(undo.data, { removed: 2, kept: 0 });
    assert.equal(await exists(prep), false);
    assert.equal(await exists(drink), false);
    const prices = await db.query('SELECT id, price FROM public.items WHERE id = ANY ($1)', [[had, changed]]);
    const byId = Object.fromEntries(prices.rows.map((r) => [r.id, r.price]));
    assert.equal(byId[had], null, 'the price it set is cleared');
    assert.equal(byId[changed], '20', 'a price changed since stays');

    const again = await maker.client.rpc('undo_bring_in', { p_batch: batch.data.id });
    assert.ok(again.error, 'a batch undoes once');
  });

  test('an ingredient since used by another drink stays', async () => {
    const { maker } = users;
    const bottle = await item({ name: `Walnut bitters ${run}`, item_type: 'ingredient', created_by: maker.id });
    const later = await item({ name: `Later drink ${run}`, item_type: 'cocktail', created_by: maker.id });
    await db.query("INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 2, 'dash', 0)", [later, bottle]);
    const batch = await maker.client.from('bring_in_batches').insert({ source: 'a list', title: `Kept ${run}`, item_ids: [bottle] }).select('id').single();
    assert.ifError(batch.error);
    const undo = await maker.client.rpc('undo_bring_in', { p_batch: batch.data.id });
    assert.ifError(undo.error);
    const left = await exists(bottle);
    assert.equal(undo.data.removed + undo.data.kept, 1);
    assert.equal(left, undo.data.kept === 1, 'kept means it is still there');
  });

  test('a batch naming someone else\'s things removes nothing of theirs', async () => {
    const { maker, stranger } = users;
    const theirs = await item({ name: `Maker's drink ${run}`, item_type: 'cocktail', created_by: maker.id });
    const batch = await stranger.client.from('bring_in_batches').insert({ source: 'a photo', title: `Sneaky ${run}`, item_ids: [theirs] }).select('id').single();
    assert.ifError(batch.error);
    const undo = await stranger.client.rpc('undo_bring_in', { p_batch: batch.data.id });
    assert.ifError(undo.error);
    assert.equal(undo.data.removed, 0);
    assert.equal(await exists(theirs), true);

    const other = await maker.client.rpc('undo_bring_in', { p_batch: batch.data.id });
    assert.ok(other.error, 'only the batch\'s owner can undo it');
  });

  test('too late after a day', async () => {
    const { maker } = users;
    const drink = await item({ name: `Old drink ${run}`, item_type: 'cocktail', created_by: maker.id });
    const { rows } = await db.query(
      "INSERT INTO public.bring_in_batches (user_id, source, title, item_ids, created_at) VALUES ($1, 'a photo', 'Old', $2, now() - interval '25 hours') RETURNING id",
      [maker.id, [drink]]
    );
    const undo = await maker.client.rpc('undo_bring_in', { p_batch: rows[0].id });
    assert.ok(undo.error);
    assert.equal(await exists(drink), true);
  });
});
