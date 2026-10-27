// Glass and ice kinds (20261124100000_glass_ice_kinds.sql): a glass or ice
// item says what kind it is, a saved drawing takes its glass and ice from the
// drink's items, only an admin changes a shared item's kind (and its drinks
// are redrawn), and a venue's ice is drawn as its shape.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run glass and ice kind tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

const inputs = () => ({
  v: 1, glass: 'rocks', ice: 'cubes', method: 'stir', liquid: { hex: '#aa3322', alpha: 0.8 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, coverage: 0.6, from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'default' },
});

async function item(key, type, fields = {}) {
  const cols = ['name', 'item_type', ...Object.keys(fields)];
  const values = [`${key} ${run}`, type, ...Object.values(fields)];
  const { rows } = await db.query(
    `INSERT INTO public.items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    values
  );
  ids[key] = rows[0].id;
  return rows[0].id;
}

async function drink(key, fields) {
  await item(key, 'cocktail', fields);
  await db.query(
    "INSERT INTO public.item_sketches (item_id, inputs, source, spec_fingerprint, rules_version) VALUES ($1, $2, 'rules', 'f', 1)",
    [ids[key], JSON.stringify(inputs())]
  );
}

const sketch = async (key) => (await db.query('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [ids[key]])).rows[0].inputs;
const kind = async (key) => (await db.query('SELECT ice_kind FROM public.items WHERE id = $1', [ids[key]])).rows[0].ice_kind;

// As a signed-in person who isn't an admin, inside a transaction rolled back after.
async function asSomeone(fn) {
  await db.query('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: randomUUID(), role: 'authenticated' })]);
    await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}

before(async () => {
  await db.connect();
  await item('coupe', 'glassware', { glass: 'coupe' });
  await item('custom', 'glassware');
  await item('crushed', 'ice', { ice_kind: 'crushed' });
  await drink('named', { glassware_id: ids.coupe, ice_id: ids.crushed });
  await drink('unsure', { glassware_id: ids.custom });
  ids.bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`kinds bar ${run}`])).rows[0].id;
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [Object.values(ids).filter((v) => v !== ids.bar)]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.end();
});

describe('glass and ice kinds', () => {
  test('a kind is one of the known ones, on its own item type', async () => {
    await assert.rejects(item('goblet', 'glassware', { glass: 'goblet' }), /items_glass_kind/);
    await assert.rejects(item('iced glass', 'ice', { glass: 'coupe' }), /items_glass_kind/);
    await assert.rejects(item('glass ice', 'glassware', { ice_kind: 'cubes' }), /items_ice_kind/);
    const { rows } = await db.query("SELECT private.is_glass_type('nick') AS nick, private.is_glass_type('goblet') AS goblet");
    assert.deepEqual(rows, [{ nick: true, goblet: false }]);
  });

  test('a drawing takes its glass and ice from the drink\'s items', async () => {
    const s = await sketch('named');
    assert.equal(s.glass, 'coupe');
    assert.equal(s.ice, 'crushed');
    assert.deepEqual([s.from.glass, s.from.ice], ['data', 'data']);
  });

  test('a glass that is not sure leaves the drawing as it was', async () => {
    const s = await sketch('unsure');
    assert.deepEqual([s.glass, s.from.glass], ['rocks', 'rules']);
  });

  test('only an admin changes a shared item\'s kind', async () => {
    await asSomeone(async () => {
      await assert.rejects(db.query("UPDATE public.items SET glass = 'nick' WHERE id = $1", [ids.coupe]), /Only an admin/);
    });
    await asSomeone(async () => {
      await assert.rejects(db.query("UPDATE public.items SET glass = 'nick' WHERE id = $1", [ids.custom]), /Only an admin/, 'not even from not sure');
    });
  });

  test('changing a kind redraws its drinks', async () => {
    await db.query("UPDATE public.items SET glass = 'nick' WHERE id = $1", [ids.coupe]);
    await db.query("UPDATE public.items SET ice_kind = 'pebble' WHERE id = $1", [ids.crushed]);
    const s = await sketch('named');
    assert.deepEqual([s.glass, s.ice], ['nick', 'pebble']);
  });

  test('a venue\'s ice is drawn as its shape, a cut one as its pick, a block not at all', async () => {
    await item('venue ice', 'ice', { bar_id: ids.bar });
    await db.query("INSERT INTO public.item_ice (item_id, bar_id, shape) VALUES ($1, $2, 'cubes')", [ids['venue ice'], ids.bar]);
    assert.equal(await kind('venue ice'), 'cubes');
    await db.query("UPDATE public.item_ice SET shape = 'sphere' WHERE item_id = $1", [ids['venue ice']]);
    assert.equal(await kind('venue ice'), 'sphere');
    await assert.rejects(db.query("UPDATE public.items SET ice_kind = 'large' WHERE id = $1", [ids['venue ice']]), /drawn as its shape/);
    await db.query("UPDATE public.item_ice SET shape = 'cut' WHERE item_id = $1", [ids['venue ice']]);
    await db.query("UPDATE public.items SET ice_kind = 'spear' WHERE id = $1", [ids['venue ice']]);
    assert.equal(await kind('venue ice'), 'spear');
    await db.query("UPDATE public.item_ice SET shape = 'block' WHERE item_id = $1", [ids['venue ice']]);
    assert.equal(await kind('venue ice'), null);
  });
});
