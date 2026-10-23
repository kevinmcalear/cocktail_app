// Glass models (20261026100000_glass_models.sql): the real glasses a maker
// sells, a venue's glass naming one, a drink served in one, and the drawing
// following it. Runs against the local stack.
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
  throw new Error(`Refusing to run glass model tests against a non-local API: ${status.API_URL}`);
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
  v: 2, glass: 'coupe', ice: 'none', method: 'shake', liquid: { hex: '#efe3b0', alpha: 0.2 },
  foam: null, float: null, bleed: null, fizz: false, garnish: null,
  from: { glass: 'data', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1,
};

async function makeUser(label) {
  const email = `${label}-${run}@glass-model-test.local`;
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

const item = async (name, fields) => (await serviceInsert('items', { name: `${name} ${run}`, ...fields })).id;
const model = (fields) => ({
  maker_profile_id: ids.maker, glass: 'coupe', name: `Coupe ${run}`, source_urls: ['https://example.com/coupe'], ...fields,
});

async function variantOf(itemId) {
  const { rows } = await db.query('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [itemId]);
  return rows[0]?.inputs.variant ?? null;
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Model Bar ${run}` })).id;
  const profile = async (handle, fields) => (await serviceInsert('profiles', { handle: `${handle}${run}`, display_name: `${handle} ${run}`, ...fields })).id;
  ids.barProfile = await profile('modelbar', { kind: 'bar', bar_id: ids.bar });
  ids.maker = await profile('glassmaker', { kind: 'maker', makes: ['glassware'] });
  ids.distiller = await profile('distiller', { kind: 'maker', makes: ['bottles'] });
  await serviceInsert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });

  ids.coupeShape = await item('Coupe', { item_type: 'glassware' });
  ids.rocksShape = await item('Rocks', { item_type: 'glassware' });
  ids.barShape = await item('House glass', { item_type: 'glassware', bar_id: ids.bar });
  ids.gin = await item('Gin', { item_type: 'ingredient' });
  ids.coupe = (await serviceInsert('glass_models', model({ shape_item_id: ids.coupeShape, variant: 'coupe_saucer', series: 'Series', designer: 'Designer', capacity_ml: 190 }))).id;
  ids.nick = (await serviceInsert('glass_models', model({ glass: 'nick', variant: 'nick_tulip', name: `Nick ${run}` }))).id;

  ids.drink = await item('Daiquiri', { item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.rocksShape });
  const { error } = await service.rpc('save_item_sketch', {
    p_item_id: ids.drink, p_inputs: INPUTS, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 2,
  });
  assert.ifError(error);
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.glass_models WHERE name LIKE $1', [like]);
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  // The bar's glasses first: deleting the maker in the same statement as the bar
  // nulls their maker and trips the bar-glassware screen in whichever order rows go.
  await db.query('DELETE FROM public.bar_glassware WHERE profile_id = $1', [ids.barProfile]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('the catalog', () => {
  test('anyone reads it, signed in or not', async () => {
    for (const client of [anon, users.outsider.client]) {
      const { data, error } = await client.from('glass_models').select('name, capacity_ml').eq('id', ids.coupe);
      assert.ifError(error);
      assert.deepEqual(data, [{ name: `Coupe ${run}`, capacity_ml: 190 }]);
    }
  });

  test('nobody writes it from the app, not even a venue admin', async () => {
    for (const client of [anon, users.admin.client]) {
      const { error } = await client.from('glass_models').insert(model({ name: `Sneaky ${run}` }));
      assert.ok(error, 'insert refused');
      await client.from('glass_models').update({ name: 'Renamed' }).eq('id', ids.coupe);
      await client.from('glass_models').delete().eq('id', ids.coupe);
    }
    const { rows } = await db.query('SELECT name FROM public.glass_models WHERE id = $1', [ids.coupe]);
    assert.equal(rows[0]?.name, `Coupe ${run}`, 'unchanged and still there');
  });

  test('its maker makes glassware and its shape is a shared glassware item', async () => {
    for (const [why, fields] of [
      ['a maker that makes bottles', { maker_profile_id: ids.distiller }],
      ['a bar', { maker_profile_id: ids.barProfile }],
      ['a venue\'s own glass', { shape_item_id: ids.barShape }],
      ['an ingredient', { shape_item_id: ids.gin }],
    ]) {
      const { error } = await service.from('glass_models').insert(model({ name: `Bad ${run}`, ...fields }));
      assert.ok(error, `refused: ${why}`);
    }
  });

  test('every fact cites a web page, and the drawing fits the glass', async () => {
    for (const [why, fields] of [
      ['no source', { source_urls: [] }],
      ['not a web page', { source_urls: ['javascript:alert(1)'] }],
      ['a bad product page', { product_url: 'ftp://example.com/x' }],
      ['another glass\'s drawing', { variant: 'martini_pony' }],
      ['an unknown material', { material: 'unobtainium' }],
    ]) {
      const { error } = await service.from('glass_models').insert(model({ name: `Bad ${run}`, ...fields }));
      assert.ok(error, `refused: ${why}`);
    }
  });

  test('a search finds it by maker, name, series or size, signed in or not', async () => {
    const names = async (client, args) => {
      const { data, error } = await client.rpc('search_glass_models', args).select('name, maker:profiles!glass_models_maker_profile_id_fkey(display_name)');
      assert.ifError(error);
      return data.filter((m) => m.name.includes(run)).map((m) => m.name);
    };
    assert.deepEqual(await names(anon, { p_query: `glassmaker ${run} coupe` }), [`Coupe ${run}`]);
    assert.deepEqual(await names(users.outsider.client, { p_query: `series 190 ${run}` }), [`Coupe ${run}`]);
    assert.deepEqual(await names(anon, { p_query: run, p_glass: 'nick' }), [`Nick ${run}`]);
    assert.deepEqual(await names(anon, { p_query: `${run} saucer` }), [], 'every word must match');
  });

  test('a search forgives accents and a slip or two, but not a guess', async () => {
    const names = async (p_query) => {
      const { data, error } = await anon.rpc('search_glass_models', { p_query }).select('name');
      assert.ifError(error);
      return data.filter((m) => m.name.includes(run)).map((m) => m.name);
    };
    assert.deepEqual(await names(`Désigner Sériés ${run} coupe`), [`Coupe ${run}`], 'accents folded');
    assert.deepEqual(await names(`designr ${run} coupe`), [`Coupe ${run}`], 'one letter off a 7-letter word');
    assert.deepEqual(await names(`dseigner ${run} coupe`), [`Coupe ${run}`], 'two letters off an 8-letter word');
    assert.deepEqual(await names(`copue ${run}`), [], 'two letters off a 5-letter word is too far');
    assert.deepEqual(await names(`${run} cup`), [], 'words under 4 letters match only as typed');
  });

  test('one row per maker, name and size', async () => {
    const { error } = await service.from('glass_models').insert(model({ name: `coupe  ${run}`, capacity_ml: 190 }));
    assert.ok(error, 'same name and size refused');
    const { error: other } = await service.from('glass_models').insert(model({ capacity_ml: 260 }));
    assert.ifError(other);
  });
});

describe('a venue\'s glass names its model', () => {
  test('picking one makes the row that glass; its maker, series and designer stay on the model', async () => {
    const { data, error } = await users.admin.client.from('bar_glassware')
      .insert({ profile_id: ids.barProfile, glass: 'rocks', model_id: ids.coupe, maker: 'Typed maker', series: 'Typed series' })
      .select('glass, variant, name, series, designer, maker, maker_profile_id').single();
    assert.ifError(error);
    assert.deepEqual(data, {
      glass: 'coupe', variant: 'coupe_saucer', name: `Coupe ${run}`, series: null, designer: null, maker: null, maker_profile_id: null,
    });
    ids.barCoupe = (await service.from('bar_glassware').select('id').eq('profile_id', ids.barProfile).eq('glass', 'coupe').single()).data.id;
  });

  test('a row that names a model can\'t take its facts back (20261103230000)', async () => {
    const { error } = await users.admin.client.from('bar_glassware').update({ designer: 'Someone', maker_profile_id: ids.maker }).eq('id', ids.barCoupe);
    assert.ifError(error);
    const { rows } = await db.query('SELECT designer, maker_profile_id FROM public.bar_glassware WHERE id = $1', [ids.barCoupe]);
    assert.deepEqual(rows[0], { designer: null, maker_profile_id: null });
    // And with triggers off (in a transaction rolled back), the check refuses it.
    await db.query('BEGIN');
    try {
      await db.query("SET LOCAL session_replication_role = 'replica'");
      await assert.rejects(db.query("UPDATE public.bar_glassware SET series = 'x' WHERE id = $1", [ids.barCoupe]), /bar_glassware_model_holds_maker/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('the bar\'s own words and drawing win', async () => {
    const { data, error } = await users.admin.client.from('bar_glassware')
      .insert({ profile_id: ids.barProfile, glass: 'nick', variant: 'nick_bell', name: 'Our Nick', model_id: ids.nick })
      .select('variant, name').single();
    assert.ifError(error);
    assert.deepEqual(data, { variant: 'nick_bell', name: 'Our Nick' });
  });

  test('a deleted model leaves the glass as it is', async () => {
    const gone = (await serviceInsert('glass_models', model({ name: `Gone ${run}`, glass: 'flute' }))).id;
    const row = await serviceInsert('bar_glassware', { profile_id: ids.barProfile, glass: 'flute', model_id: gone, is_default: false });
    await service.from('glass_models').delete().eq('id', gone);
    const { rows } = await db.query('SELECT model_id, name FROM public.bar_glassware WHERE id = $1', [row.id]);
    assert.deepEqual(rows[0], { model_id: null, name: `Gone ${run}` });
  });
});

describe('a drink names its model', () => {
  test('only a drink', async () => {
    const { error } = await service.from('items').update({ glass_model_id: ids.coupe }).eq('id', ids.gin);
    assert.ok(error);
  });

  test('picking one sets the drink\'s shape and draws it in the model\'s drawing', async () => {
    const { error } = await users.admin.client.from('items').update({ glass_model_id: ids.coupe }).eq('id', ids.drink);
    assert.ifError(error);
    const { rows } = await db.query('SELECT glassware_id FROM public.items WHERE id = $1', [ids.drink]);
    assert.equal(rows[0].glassware_id, ids.coupeShape);
    assert.equal(await variantOf(ids.drink), 'coupe_saucer');
  });

  test('the drink\'s own pick still wins', async () => {
    assert.ifError((await users.admin.client.from('items').update({ sketch_variant: 'coupe_deep' }).eq('id', ids.drink)).error);
    assert.equal(await variantOf(ids.drink), 'coupe_deep');
    assert.ifError((await users.admin.client.from('items').update({ sketch_variant: null }).eq('id', ids.drink)).error);
    assert.equal(await variantOf(ids.drink), 'coupe_saucer');
  });

  test('saving the same shape keeps the model; another shape lets it go', async () => {
    assert.ifError((await users.admin.client.from('items').update({ glassware_id: ids.coupeShape }).eq('id', ids.drink)).error);
    let { rows } = await db.query('SELECT glass_model_id FROM public.items WHERE id = $1', [ids.drink]);
    assert.equal(rows[0].glass_model_id, ids.coupe);
    assert.ifError((await users.admin.client.from('items').update({ glassware_id: ids.rocksShape }).eq('id', ids.drink)).error);
    ({ rows } = await db.query('SELECT glass_model_id, glassware_id FROM public.items WHERE id = $1', [ids.drink]));
    assert.deepEqual(rows[0], { glass_model_id: null, glassware_id: ids.rocksShape });
  });

  test('someone outside the venue can\'t set it', async () => {
    await users.outsider.client.from('items').update({ glass_model_id: ids.coupe }).eq('id', ids.drink);
    const { rows } = await db.query('SELECT glass_model_id FROM public.items WHERE id = $1', [ids.drink]);
    assert.equal(rows[0].glass_model_id, null);
  });
});
