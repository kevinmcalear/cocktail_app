// Glass variants (20261007100000_glass_variants.sql): a drink's pick of how
// its glass is drawn, its bar's glassware, and the "variant" the database
// writes into the drawing inputs from them. Runs against the local stack.
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
  throw new Error(`Refusing to run glass variant tests against a non-local API: ${status.API_URL}`);
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
  v: 2, glass: 'martini', ice: 'none', method: 'stir', liquid: { hex: '#efe3b0', alpha: 0.2 },
  foam: null, float: null, bleed: null, fizz: false, garnish: 'olive',
  from: { glass: 'data', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1,
};

async function makeUser(label) {
  const email = `${label}-${run}@glass-test.local`;
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

const drink = async (name, fields = {}) => (await serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', ...fields })).id;

async function saveSketch(itemId, inputs = INPUTS) {
  const { error } = await service.rpc('save_item_sketch', {
    p_item_id: itemId, p_inputs: inputs, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 2,
  });
  assert.ifError(error);
}

async function variantOf(itemId) {
  const { rows } = await db.query('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [itemId]);
  return rows[0]?.inputs.variant ?? null;
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'creator', 'bartender', 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Glass Bar ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Other Glass Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });

  ids.martini = await drink('House Martini', { bar_id: ids.bar });
  ids.rocks = await drink('House Negroni', { bar_id: ids.bar });
  ids.elsewhere = await drink('Their Martini', { bar_id: ids.otherBar });
  await saveSketch(ids.martini);
  await saveSketch(ids.rocks, { ...INPUTS, glass: 'rocks', ice: 'large' });
  await saveSketch(ids.elsewhere);
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

describe('a bar\'s glassware', () => {
  test('anyone signed in reads it; signed out, nobody', async () => {
    await serviceInsert('bar_glassware', { bar_id: ids.otherBar, glass: 'coupe', variant: 'coupe_saucer', maker: 'Maker', series: 'Series' });
    const { data } = await users.outsider.client.from('bar_glassware').select('glass, variant, maker').eq('bar_id', ids.otherBar);
    assert.deepEqual(data, [{ glass: 'coupe', variant: 'coupe_saucer', maker: 'Maker' }]);
    const { data: anonData, error } = await anon.from('bar_glassware').select('id').eq('bar_id', ids.otherBar);
    assert.ok(error || anonData.length === 0, 'anon reads nothing');
  });

  test('only the bar\'s admins write it', async () => {
    for (const who of ['creator', 'bartender', 'outsider']) {
      const { error } = await users[who].client.from('bar_glassware').insert({ bar_id: ids.bar, glass: 'martini', variant: 'martini_pony' });
      assert.ok(error, `${who} refused`);
    }
    const { error: elsewhere } = await users.admin.client.from('bar_glassware').insert({ bar_id: ids.otherBar, glass: 'martini' });
    assert.ok(elsewhere, 'not at another bar');
    const { data, error } = await users.admin.client
      .from('bar_glassware').insert({ bar_id: ids.bar, glass: 'martini', variant: 'martini_pony', name: 'House V', maker: 'Maker' }).select('id').single();
    assert.ifError(error);
    ids.barMartini = data.id;
  });

  test('a variant must be one of its own glass\'s', async () => {
    for (const variant of ['coupe_deep', 'Nude Savage', 'martini_', 'martini_pony_2']) {
      const { error } = await service.from('bar_glassware').insert({ bar_id: ids.otherBar, glass: 'martini', variant, is_default: false });
      assert.ok(error, `refused: ${variant}`);
    }
  });

  test('it loads the research pass\'s shape: maker, designer, series, a note and web sources', async () => {
    const row = { bar_id: ids.otherBar, glass: 'nick', variant: 'nick_tulip', name: 'Nick & Nora', maker: 'Maker', designer: 'Designer',
      series: 'Series', shape_note: 'Tall and narrow, closing at the rim', source_urls: ['https://example.com/glass'] };
    assert.ifError((await service.from('bar_glassware').insert(row)).error);
    for (const source_urls of [['javascript:alert(1)'], ['ftp://example.com'], Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`)]) {
      const { error } = await service.from('bar_glassware').insert({ ...row, glass: 'rocks', variant: null, source_urls });
      assert.ok(error, `refused: ${source_urls[0]}`);
    }
  });

  test('one default glass per type', async () => {
    const { error } = await service.from('bar_glassware').insert({ bar_id: ids.bar, glass: 'martini', variant: 'martini_soft' });
    assert.ok(error, 'a second default martini glass is refused');
    const { error: spare } = await service.from('bar_glassware').insert({ bar_id: ids.bar, glass: 'martini', variant: 'martini_soft', is_default: false });
    assert.ifError(spare);
  });
});

describe('the variant in the drawing inputs', () => {
  test('the bar\'s default glass draws its drinks of that glass, and only those', async () => {
    assert.equal(await variantOf(ids.martini), 'martini_pony');
    assert.equal(await variantOf(ids.rocks), null, 'a rocks drink keeps the default');
    assert.equal(await variantOf(ids.elsewhere), null, 'another bar\'s martini keeps the default');
  });

  test('the drink\'s own pick wins, while it is drawn in that glass', async () => {
    const editor = users.creator.client;
    assert.ifError((await editor.from('items').update({ sketch_variant: 'martini_soft' }).eq('id', ids.martini)).error);
    assert.equal(await variantOf(ids.martini), 'martini_soft');
    assert.ifError((await editor.from('items').update({ sketch_variant: 'coupe_deep' }).eq('id', ids.martini)).error);
    assert.equal(await variantOf(ids.martini), 'martini_pony', 'a pick for another glass falls back to the bar\'s');
    assert.ifError((await editor.from('items').update({ sketch_variant: 'martini_classic' }).eq('id', ids.martini)).error);
  });

  test('a pick must look like a variant key', async () => {
    for (const sketch_variant of ['Nude Savage', 'goblet_tall', 'martini']) {
      const { error } = await users.creator.client.from('items').update({ sketch_variant }).eq('id', ids.martini);
      assert.ok(error, `refused: ${sketch_variant}`);
    }
  });

  test('the worker\'s next drawing keeps it, and can\'t set one itself', async () => {
    await saveSketch(ids.martini, { ...INPUTS, garnish: 'lemon_peel' });
    assert.equal(await variantOf(ids.martini), 'martini_classic');
    await saveSketch(ids.rocks, { ...INPUTS, glass: 'rocks', variant: 'rocks_heavy' });
    assert.equal(await variantOf(ids.rocks), null);
  });

  test('changing or removing the bar\'s glass redraws its drinks', async () => {
    await db.query('UPDATE public.items SET sketch_variant = NULL WHERE id = $1', [ids.martini]);
    assert.equal(await variantOf(ids.martini), 'martini_pony');
    assert.ifError((await users.admin.client.from('bar_glassware').update({ variant: 'martini_soft' }).eq('id', ids.barMartini)).error);
    assert.equal(await variantOf(ids.martini), 'martini_soft');
    assert.ifError((await users.admin.client.from('bar_glassware').delete().eq('id', ids.barMartini)).error);
    assert.equal(await variantOf(ids.martini), null);
  });

  test('picking a variant doesn\'t re-queue the drink for the worker', async () => {
    await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [ids.martini]);
    await db.query("UPDATE public.items SET sketch_variant = 'martini_pony' WHERE id = $1", [ids.martini]);
    const { rows } = await db.query('SELECT 1 FROM private.item_flavor_jobs WHERE item_id = $1', [ids.martini]);
    assert.equal(rows.length, 0);
  });
});

describe('the worker\'s context', () => {
  test('says whether the drink already has a drawing', async () => {
    const fresh = await drink('Undrawn');
    const ctx = async (id) => (await service.rpc('get_item_sketch_context', { p_item_id: id })).data;
    assert.equal((await ctx(ids.martini)).hasSketch, true);
    assert.equal((await ctx(fresh)).hasSketch, false);
  });
});
