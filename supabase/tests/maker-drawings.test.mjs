// Maker drawings (20261009950000_maker_drawings.sql): the add-drink wizard's
// drawing is saved for the drink as source 'maker', only by someone who can
// edit it, and the flavor-worker leaves it alone until the drink changes.
// Runs against the local stack.
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
  throw new Error(`Refusing to run maker drawing tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

const INPUTS = {
  v: 2, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 },
  foam: null, float: null, bleed: null, fizz: false, garnish: 'orange_peel',
  from: { glass: 'data', ice: 'data', method: 'data', liquid: 'rules', garnish: 'rules' }, coverage: 1,
};

async function makeUser(label) {
  const email = `${label}-${run}@maker-test.local`;
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

const fingerprint = async (itemId) => (await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [itemId])).rows[0].fp;
const stored = async (itemId) => (await db.query('SELECT source, inputs FROM public.item_sketches WHERE item_id = $1', [itemId])).rows[0] ?? null;

async function workerSaves(itemId, fp, glass = 'coupe') {
  const { error } = await service.rpc('save_item_sketch', {
    p_item_id: itemId, p_inputs: { ...INPUTS, glass }, p_source: 'ai', p_spec_fingerprint: fp, p_rules_version: 2,
  });
  assert.ifError(error);
}

before(async () => {
  await db.connect();
  for (const label of ['maker', 'outsider']) users[label] = await makeUser(label);
  ids.drink = (await serviceInsert('items', { name: `Maker Negroni ${run}`, item_type: 'cocktail', created_by: users.maker.id })).id;
  ids.ingredient = (await serviceInsert('items', { name: `Maker Bitter ${run}`, item_type: 'ingredient', created_by: users.maker.id })).id;
});

after(async () => {
  await service.from('items').delete().in('id', [ids.drink, ids.ingredient].filter(Boolean));
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('save_maker_sketch', () => {
  test('the drink’s maker saves the wizard’s drawing', async () => {
    const { data, error } = await users.maker.client.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: INPUTS });
    assert.ifError(error);
    assert.equal(data, true);
    const row = await stored(ids.drink);
    assert.equal(row.source, 'maker');
    assert.equal(row.inputs.glass, 'rocks');
  });

  test('someone who can’t edit the drink can’t, and signed out can’t call it', async () => {
    const { data } = await users.outsider.client.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: { ...INPUTS, glass: 'flute' } });
    assert.equal(data, false);
    const { error } = await anon.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: INPUTS });
    assert.ok(error, 'anon is refused');
    assert.equal((await stored(ids.drink)).inputs.glass, 'rocks');
  });

  test('only cocktails, and only inputs the app can draw', async () => {
    const { data } = await users.maker.client.rpc('save_maker_sketch', { p_item_id: ids.ingredient, p_inputs: INPUTS });
    assert.equal(data, false);
    const { error } = await users.maker.client.rpc('save_maker_sketch', { p_item_id: ids.drink, p_inputs: { ...INPUTS, glass: 'goblet' } });
    assert.equal(error?.code, '22023');
  });
});

describe('the worker and a maker drawing', () => {
  test('the same drink keeps the maker’s drawing', async () => {
    await workerSaves(ids.drink, await fingerprint(ids.drink));
    const row = await stored(ids.drink);
    assert.equal(row.source, 'maker');
    assert.equal(row.inputs.glass, 'rocks');
  });

  test('once the drink changes, the worker draws it afresh', async () => {
    await service.from('items').update({ description: 'Now with a twist' }).eq('id', ids.drink);
    await workerSaves(ids.drink, await fingerprint(ids.drink));
    const row = await stored(ids.drink);
    assert.equal(row.source, 'ai');
    assert.equal(row.inputs.glass, 'coupe');
  });
});
