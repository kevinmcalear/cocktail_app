// Sketch colour (20261017100000_sketch_liquid.sql): a drink's editors pick the
// watercolour its drawing is painted in (items.sketch_liquid), and the
// database copies it into the drawing inputs as "tint" over the worker's own
// colour. Runs against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run sketch colour tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const GARNET = '#6f1426';
const WORKER = { hex: '#7a4420', alpha: 0.9 };

const INPUTS = {
  v: 2, glass: 'nick', ice: 'none', method: 'stir', liquid: WORKER,
  foam: null, float: null, bleed: null, fizz: false, garnish: 'cherry',
  from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1,
};

async function makeUser(label) {
  const email = `${label}-${run}@tint-test.local`;
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

async function saveSketch(itemId, inputs = INPUTS) {
  const { error } = await service.rpc('save_item_sketch', {
    p_item_id: itemId, p_inputs: inputs, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 2,
  });
  assert.ifError(error);
}

async function inputsOf(itemId) {
  const { rows } = await db.query('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [itemId]);
  return rows[0]?.inputs ?? null;
}
const tintOf = async (itemId) => (await inputsOf(itemId))?.tint ?? null;
const setTint = (who, itemId, tint) => users[who].client.from('items').update({ sketch_liquid: tint }).eq('id', itemId).select('id');

before(async () => {
  await db.connect();
  for (const label of ['creator', 'bartender', 'outsider', 'home']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Tint Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  ids.manhattan = (await serviceInsert('items', { name: `House Manhattan ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.home = (await serviceInsert('items', { name: `Home Manhattan ${run}`, item_type: 'cocktail', created_by: users.home.id })).id;
  await saveSketch(ids.manhattan);
  await saveSketch(ids.home);
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('who picks a drink\'s sketch colour', () => {
  test('the bar\'s creators and the home drink\'s maker can', async () => {
    const { data, error } = await setTint('creator', ids.manhattan, GARNET);
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(await tintOf(ids.manhattan), GARNET);
    const home = await setTint('home', ids.home, '#d0697a');
    assert.ifError(home.error);
    assert.equal(await tintOf(ids.home), '#d0697a');
  });

  test('a bartender, someone else, and signed out change nothing', async () => {
    for (const who of ['bartender', 'outsider']) {
      const { data } = await setTint(who, ids.manhattan, '#77726e');
      assert.equal(data?.length ?? 0, 0, `${who} refused`);
    }
    const { data } = await setTint('outsider', ids.home, '#77726e');
    assert.equal(data?.length ?? 0, 0, 'not someone else\'s home drink');
    await anon.from('items').update({ sketch_liquid: '#77726e' }).eq('id', ids.manhattan);
    assert.equal(await tintOf(ids.manhattan), GARNET);
    assert.equal(await tintOf(ids.home), '#d0697a');
  });

  test('only a lowercase #rrggbb is stored', async () => {
    for (const tint of ['red', '#FFF', '#6F1426', '#6f14266', 'url(#x)', '#6f1426;']) {
      const { error } = await setTint('creator', ids.manhattan, tint);
      assert.ok(error, `refused: ${tint}`);
    }
    assert.equal(await tintOf(ids.manhattan), GARNET);
  });

  test('nobody writes the drawing itself', async () => {
    await users.creator.client.from('item_sketches').update({ inputs: { ...INPUTS, tint: '#77726e' } }).eq('item_id', ids.manhattan);
    assert.equal(await tintOf(ids.manhattan), GARNET);
  });
});

describe('the tint in the drawing inputs', () => {
  test('sits over the worker\'s colour, which stays', async () => {
    assert.deepEqual((await inputsOf(ids.manhattan)).liquid, WORKER);
  });

  test('the worker\'s next drawing keeps it, and can\'t set one itself', async () => {
    await saveSketch(ids.manhattan, { ...INPUTS, garnish: 'orange_peel' });
    assert.equal(await tintOf(ids.manhattan), GARNET);
    await db.query('UPDATE public.items SET sketch_liquid = NULL WHERE id = $1', [ids.home]);
    await saveSketch(ids.home, { ...INPUTS, tint: '#77726e' });
    assert.equal(await tintOf(ids.home), null);
  });

  test('a maker\'s drawing can\'t bring its own either', async () => {
    const { data, error } = await users.home.client.rpc('save_maker_sketch', { p_item_id: ids.home, p_inputs: { ...INPUTS, tint: '#77726e' } });
    assert.ifError(error);
    assert.equal(data, true);
    assert.equal(await tintOf(ids.home), null);
  });

  test('Auto clears it and the worker\'s colour shows again', async () => {
    assert.ifError((await setTint('creator', ids.manhattan, null)).error);
    const inputs = await inputsOf(ids.manhattan);
    assert.equal('tint' in inputs, false);
    assert.deepEqual(inputs.liquid, WORKER);
  });

  test('a stored tint must be a colour', async () => {
    const { rows } = await db.query(
      "SELECT private.valid_sketch_inputs($1::jsonb) AS ok, private.valid_sketch_inputs($2::jsonb) AS bad, private.valid_sketch_inputs($3::jsonb) AS odd",
      [JSON.stringify({ ...INPUTS, tint: GARNET }), JSON.stringify({ ...INPUTS, tint: 'red' }), JSON.stringify({ ...INPUTS, tint: 7 })],
    );
    assert.deepEqual(rows[0], { ok: true, bad: false, odd: false });
  });

  test('picking a colour doesn\'t re-queue the drink for the worker', async () => {
    await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [ids.manhattan]);
    assert.ifError((await setTint('creator', ids.manhattan, '#c98a35')).error);
    const { rows } = await db.query('SELECT 1 FROM private.item_flavor_jobs WHERE item_id = $1', [ids.manhattan]);
    assert.equal(rows.length, 0);
    assert.equal(await tintOf(ids.manhattan), '#c98a35');
  });
});
