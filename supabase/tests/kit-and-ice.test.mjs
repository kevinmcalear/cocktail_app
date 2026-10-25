// Kit and ice (20261110100000_kit_and_ice.sql): a venue's ice is an ice item
// of the venue with item_ice beside it. Its team reads it (venue_ice); anyone
// with Prep writes it through save_venue_ice and remove_venue_ice, never
// directly; Prep writes what its ice starts from (recipes); glassware comes
// from the venue's own supplier; a step names at most 12 tools.
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
  throw new Error(`Refusing to run kit and ice tests against a non-local API: ${status.API_URL}`);
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

const save = (who, args) => users[who].client.rpc('save_venue_ice', { p_bar_id: ids.bar, ...args });

before(async () => {
  await db.connect();
  // prepper: a bartender given Prep, without Edit drinks. barback: neither.
  for (const label of ['manager', 'prepper', 'barback', 'outsider']) users[label] = await makeUser(label);
  for (const key of ['bar', 'other']) {
    ids[key] = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`ice kit ${key} ${run}`])).rows[0].id;
  }
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30), ($1, $4, 20), ($5, $6, 40)', [
    ids.bar, users.manager.id, users.prepper.id, users.barback.id, ids.other, users.outsider.id,
  ]);
  await db.query("INSERT INTO public.venue_level_overrides (bar_id, base_level, granted) VALUES ($1, 30, '{prep}')", [ids.bar]);
  ids.page = (await db.query(
    "INSERT INTO public.profiles (kind, handle, display_name, is_public, bar_id) VALUES ('bar', $1, $2, true, $3) RETURNING id",
    [`icekit${run}`, `Ice kit ${run}`, ids.bar]
  )).rows[0].id;
  ids.supplier = (await db.query('INSERT INTO public.suppliers (bar_id, name, cuts_to_order) VALUES ($1, $2, true) RETURNING id', [ids.bar, `Coldwater ${run}`])).rows[0].id;
  ids.otherSupplier = (await db.query('INSERT INTO public.suppliers (bar_id, name) VALUES ($1, $2) RETURNING id', [ids.other, `Other Co ${run}`])).rows[0].id;
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE bar_id = ANY($1)', [[ids.bar, ids.other]]);
  await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.page]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.other]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a venue\'s ice', () => {
  test('anyone with Prep adds it, as an ice item of the venue', async () => {
    const { data: id, error } = await save('prepper', {
      p_name: 'Clear cube · 50 mm', p_shape: 'large', p_size_mm: 50, p_clear: true, p_stamped: true, p_source: 'bought', p_supplier_id: ids.supplier,
    });
    assert.ifError(error);
    ids.clear = id;
    const { rows } = await db.query('SELECT name, item_type, bar_id, created_by FROM public.items WHERE id = $1', [id]);
    assert.deepEqual(rows, [{ name: 'Clear cube · 50 mm', item_type: 'ice', bar_id: ids.bar, created_by: users.prepper.id }]);
    const { data: block, error: blockError } = await save('manager', { p_name: 'Block', p_shape: 'block', p_source: 'made', p_note: 'frozen clear in a cooler' });
    assert.ifError(blockError);
    ids.block = block;
  });

  test('without Prep, at another venue or signed out, it can\'t be added', async () => {
    for (const who of ['barback', 'outsider']) {
      const { error } = await save(who, { p_name: 'Cubes', p_shape: 'cubes' });
      assert.ok(error, `${who} refused`);
    }
    const { error } = await anon.rpc('save_venue_ice', { p_bar_id: ids.bar, p_name: 'Cubes', p_shape: 'cubes' });
    assert.ok(error, 'anon refused');
  });

  test('nobody writes item_ice directly', async () => {
    const { error: insertError } = await users.manager.client.from('item_ice').insert({ item_id: ids.block, bar_id: ids.bar, shape: 'slab' });
    assert.ok(insertError, 'no insert');
    await users.manager.client.from('item_ice').update({ shape: 'slab' }).eq('item_id', ids.block);
    await users.manager.client.from('item_ice').delete().eq('item_id', ids.block);
    const { rows } = await db.query('SELECT shape FROM public.item_ice WHERE item_id = $1', [ids.block]);
    assert.deepEqual(rows, [{ shape: 'block' }], 'no update or delete');
  });

  test('the whole team reads it; a supplier\'s name only with Prep or Costs; nobody else reads it', async () => {
    const { data: prepper } = await users.prepper.client.rpc('venue_ice', { p_bar_id: ids.bar });
    assert.deepEqual(prepper.map((r) => [r.name, r.shape, r.supplier_name]), [['Clear cube · 50 mm', 'large', `Coldwater ${run}`], ['Block', 'block', null]]);
    const { data: barback, error } = await users.barback.client.rpc('venue_ice', { p_bar_id: ids.bar });
    assert.ifError(error);
    assert.deepEqual(barback.map((r) => [r.name, r.source, r.supplier_name]), [['Clear cube · 50 mm', 'bought', null], ['Block', 'made', null]]);
    const { data: table } = await users.barback.client.from('item_ice').select('shape').eq('bar_id', ids.bar);
    assert.equal(table.length, 2, 'the table too');
    const { data: outsider } = await users.outsider.client.rpc('venue_ice', { p_bar_id: ids.bar });
    assert.deepEqual(outsider, []);
    const { data: outsiderTable } = await users.outsider.client.from('item_ice').select('item_id').eq('bar_id', ids.bar);
    assert.deepEqual(outsiderTable, []);
    const { error: anonError } = await anon.rpc('venue_ice', { p_bar_id: ids.bar });
    assert.ok(anonError, 'anon refused');
    const { data: anonTable, error: anonTableError } = await anon.from('item_ice').select('item_id');
    assert.ok(anonTableError || anonTable.length === 0, 'anon reads nothing');
  });

  test('changing it keeps the item and says every fact again', async () => {
    const { data: id, error } = await save('prepper', { p_id: ids.clear, p_name: 'Clear cube', p_shape: 'large', p_size_mm: 45, p_source: 'machine', p_machine: 'Klaris' });
    assert.ifError(error);
    assert.equal(id, ids.clear);
    const { rows } = await db.query(
      'SELECT i.name, x.size_mm, x.clear, x.stamped, x.source, x.supplier_id, x.machine FROM public.item_ice x JOIN public.items i ON i.id = x.item_id WHERE x.item_id = $1',
      [ids.clear]
    );
    assert.deepEqual(rows, [{ name: 'Clear cube', size_mm: 45, clear: null, stamped: false, source: 'machine', supplier_id: null, machine: 'Klaris' }]);
  });

  test('only the venue\'s own ice, suppliers and known shapes', async () => {
    const outsiderIce = (await db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ('Theirs', 'ice', $1) RETURNING id", [ids.other])).rows[0].id;
    await db.query("INSERT INTO public.item_ice (item_id, bar_id, shape) VALUES ($1, $2, 'cubes')", [outsiderIce, ids.other]);
    for (const [label, args] of [
      ['another venue\'s ice', { p_id: outsiderIce, p_name: 'Mine now', p_shape: 'cubes' }],
      ['a drink as ice', { p_id: randomUUID(), p_name: 'Nope', p_shape: 'cubes' }],
      ['another venue\'s supplier', { p_name: 'Cubes', p_shape: 'cubes', p_source: 'bought', p_supplier_id: ids.otherSupplier }],
      ['a supplier for ice made here', { p_name: 'Cubes', p_shape: 'cubes', p_source: 'made', p_supplier_id: ids.supplier }],
      ['a machine for bought ice', { p_name: 'Cubes', p_shape: 'cubes', p_source: 'bought', p_machine: 'Hoshizaki' }],
      ['drawn as, on a plain cube', { p_name: 'Cubes', p_shape: 'cubes', p_draw_as: 'large' }],
      ['an unknown shape', { p_name: 'Cubes', p_shape: 'star' }],
      ['no name', { p_name: '  ', p_shape: 'cubes' }],
      ['a 3 m block', { p_name: 'Huge', p_shape: 'block', p_length_mm: 3000 }],
    ]) {
      const { error } = await save('prepper', args);
      assert.ok(error, `${label} refused`);
    }
    const { rows } = await db.query('SELECT name FROM public.items WHERE id = $1', [outsiderIce]);
    assert.deepEqual(rows, [{ name: 'Theirs' }]);
  });

  test('Prep writes what its ice starts from, without Edit drinks', async () => {
    const { error } = await users.prepper.client.from('recipes').insert({ recipe_item_id: ids.clear, ingredient_item_id: ids.block, sort_order: 0 });
    assert.ifError(error);
    const { data } = await users.prepper.client.from('recipes').select('ingredient_item_id').eq('recipe_item_id', ids.clear);
    assert.deepEqual(data, [{ ingredient_item_id: ids.block }]);
    const { error: barbackError } = await users.barback.client.from('recipes').insert({ recipe_item_id: ids.clear, ingredient_item_id: ids.block, sort_order: 1 });
    assert.ok(barbackError, 'not without Prep');
    // A drink's recipe still needs Edit drinks.
    const drink = (await db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'cocktail', $2) RETURNING id", [`Highball ${run}`, ids.bar])).rows[0].id;
    const { error: drinkError } = await users.prepper.client.from('recipes').insert({ recipe_item_id: drink, ingredient_item_id: ids.block, sort_order: 0 });
    assert.ok(drinkError, 'a drink\'s lines need Edit drinks');
    ids.drink = drink;
  });

  test('its recipe steps name their tools, up to 12', async () => {
    const { error } = await users.prepper.client.from('item_steps').insert({ item_id: ids.clear, position: 0, body: 'Cut 50 mm cubes.', equipment: ['bandsaw', 'Our ice stamp'] });
    assert.ifError(error);
    const { error: tooMany } = await users.prepper.client.from('item_steps').insert({ item_id: ids.clear, position: 1, body: 'Too much.', equipment: Array.from({ length: 13 }, (_, i) => `tool-${i}`) });
    assert.ok(tooMany, '13 refused');
    const { error: blank } = await users.prepper.client.from('item_steps').insert({ item_id: ids.clear, position: 1, body: 'Blank.', equipment: [' '] });
    assert.ok(blank, 'a blank tool refused');
  });

  test('removing it is refused while a drink pours it or another ice starts from it', async () => {
    const { error: startsFrom } = await users.prepper.client.rpc('remove_venue_ice', { p_id: ids.block });
    assert.match(startsFrom?.message ?? '', /uses this ice/);
    await db.query('UPDATE public.items SET ice_id = $1 WHERE id = $2', [ids.clear, ids.drink]);
    const { error: poured } = await users.prepper.client.rpc('remove_venue_ice', { p_id: ids.clear });
    assert.match(poured?.message ?? '', /Highball/);
    const { error: barback } = await users.barback.client.rpc('remove_venue_ice', { p_id: ids.clear });
    assert.ok(barback, 'not without Prep');
    const { error: anonError } = await anon.rpc('remove_venue_ice', { p_id: ids.clear });
    assert.ok(anonError, 'not signed out');
    await db.query('UPDATE public.items SET ice_id = NULL WHERE id = $1', [ids.drink]);
    const { error } = await users.prepper.client.rpc('remove_venue_ice', { p_id: ids.clear });
    assert.ifError(error);
    const { rows } = await db.query('SELECT (SELECT count(*) FROM public.items WHERE id = $1)::int AS items, (SELECT count(*) FROM public.item_steps WHERE item_id = $1)::int AS steps', [ids.clear]);
    assert.deepEqual(rows, [{ items: 0, steps: 0 }]);
  });
});

describe('glassware and suppliers', () => {
  test('a glass is bought from one of the venue\'s own suppliers, or already ours', async () => {
    const { error } = await users.manager.client.from('bar_glassware')
      .insert({ profile_id: ids.page, glass: 'coupe', source: 'bought', supplier_id: ids.supplier, count: 24 });
    assert.ifError(error);
    const { error: theirs } = await users.manager.client.from('bar_glassware')
      .insert({ profile_id: ids.page, glass: 'rocks', is_default: false, source: 'bought', supplier_id: ids.otherSupplier });
    assert.ok(theirs, 'not another venue\'s supplier');
    const { error: ours } = await users.manager.client.from('bar_glassware')
      .insert({ profile_id: ids.page, glass: 'rocks', is_default: false, source: 'ours', supplier_id: ids.supplier });
    assert.ok(ours, 'a supplier only when bought');
    const { error: none } = await users.manager.client.from('bar_glassware').insert({ profile_id: ids.page, glass: 'flute', count: 0 });
    assert.ok(none, 'at least one');
  });

  test('a supplier says whether it cuts to order, still private to Prep and Costs', async () => {
    const { data } = await users.prepper.client.from('suppliers').select('cuts_to_order').eq('id', ids.supplier).single();
    assert.deepEqual(data, { cuts_to_order: true });
    const { data: barback } = await users.barback.client.from('suppliers').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(barback, []);
  });
});
