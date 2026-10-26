// The venue's ice look in its drinks' drawings (20261122100000_ice_look_drawings.sql):
// a drink with one ice gets inputs.iceLook (size, clear, stamp, frozen inside)
// from the venue ice it names, else the venue's ice of the kind it's drawn with;
// a build's layers carry theirs; a change to the venue's ice redraws its drinks.
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
  throw new Error(`Refusing to run ice look tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

const inputs = (ice, from = 'rules') => ({
  v: 1, glass: 'rocks', ice, method: 'stir', liquid: { hex: '#aa3322', alpha: 0.8 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, coverage: 0.6, from: { glass: 'rules', ice: from, method: 'rules', liquid: 'rules', garnish: 'default' },
});

async function drink(key, fields, ice, from) {
  const cols = ['name', 'item_type', ...Object.keys(fields)];
  const values = [`${key} ${run}`, 'cocktail', ...Object.values(fields)];
  const { rows } = await db.query(
    `INSERT INTO public.items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    values
  );
  ids[key] = rows[0].id;
  await db.query(
    "INSERT INTO public.item_sketches (item_id, inputs, source, spec_fingerprint, rules_version) VALUES ($1, $2, 'rules', 'f', 1)",
    [ids[key], JSON.stringify(inputs(ice, from))]
  );
}

const sketch = async (key) => (await db.query('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [ids[key]])).rows[0].inputs;
const redraw = (key) => db.query('UPDATE public.item_sketches SET inputs = inputs WHERE item_id = $1', [ids[key]]);

// One of the venue's ice, with its look.
async function ice(key, shape, look = {}) {
  const { rows } = await db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'ice', $2) RETURNING id", [`${key} ${run}`, ids.bar]);
  ids[key] = rows[0].id;
  await db.query(
    'INSERT INTO public.item_ice (item_id, bar_id, shape, size_mm, length_mm, clear, stamped, frozen_inside) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [rows[0].id, ids.bar, shape, look.size ?? null, look.length ?? null, look.clear ?? null, look.stamped ?? false, look.inside ?? null]
  );
}

before(async () => {
  await db.connect();
  ids.bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`ice look bar ${run}`])).rows[0].id;
  await drink('rocks', { bar_id: ids.bar }, 'large');
  await drink('spec', { bar_id: ids.bar }, 'large', 'data');
  await drink('elsewhere', {}, 'large');
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [Object.values(ids).filter((v) => v !== ids.bar)]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.end();
});

describe('the venue\'s ice look in its drawings', () => {
  test('nothing changes while the venue lists no ice', async () => {
    assert.equal((await sketch('rocks')).iceLook, undefined);
  });

  test('a drink is drawn with the look of the venue\'s ice of its kind, spec-named or not', async () => {
    await ice('clear-large', 'large', { size: 50, clear: true, stamped: true });
    assert.deepEqual((await sketch('rocks')).iceLook, { mm: 50, clear: true, stamp: true });
    assert.deepEqual((await sketch('spec')).iceLook, { mm: 50, clear: true, stamp: true });
    assert.equal((await sketch('elsewhere')).iceLook, undefined, 'another bar\'s drink');
  });

  test('a change to the venue\'s ice redraws its drinks', async () => {
    await db.query("UPDATE public.item_ice SET size_mm = 45, frozen_inside = 'a glass prism' WHERE item_id = $1", [ids['clear-large']]);
    assert.deepEqual((await sketch('rocks')).iceLook, { mm: 45, clear: true, stamp: true, inside: true });
  });

  test('a drink naming one of the venue\'s ice gets that one, redrawn when it switches', async () => {
    await ice('cloudy-large', 'large', { size: 60, clear: false });
    await db.query('UPDATE public.items SET ice_id = $1 WHERE id = $2', [ids['cloudy-large'], ids.rocks]);
    assert.deepEqual((await sketch('rocks')).iceLook, { mm: 60, clear: false });
    assert.deepEqual((await sketch('spec')).iceLook, { mm: 45, clear: true, stamp: true, inside: true }, 'the first large still draws the rest');
  });

  test('a block or slab never lends its look; sizes outside the drawing\'s range are left out', async () => {
    await ice('block', 'block', { size: 500, clear: true });
    await ice('house-cubes', 'cubes', { size: 500, clear: true });
    await db.query("UPDATE public.item_sketches SET inputs = jsonb_set(inputs, '{ice}', '\"cubes\"') WHERE item_id = $1", [ids.spec]);
    assert.deepEqual((await sketch('spec')).iceLook, { clear: true });
  });

  test('a build\'s layers carry their ice\'s look, and the drawing has no single iceLook', async () => {
    await ice('spear', 'spear', { size: 32, length: 120, clear: true });
    await db.query('UPDATE public.items SET ice_build = $1 WHERE id = $2', [
      JSON.stringify([{ ice: ids['house-cubes'], n: 2 }, { ice: ids.spear, n: 1 }]), ids.rocks,
    ]);
    const s = await sketch('rocks');
    assert.equal(s.iceLook, undefined);
    assert.deepEqual(s.build, [{ kind: 'cubes', n: 2, clear: true }, { kind: 'spear', n: 1, mm: 32, lengthMm: 120, clear: true }]);
  });

  test('a writer can\'t set it, and the check refuses a bad look', async () => {
    await db.query('UPDATE public.items SET ice_build = NULL, ice_id = NULL WHERE id = $1', [ids.rocks]);
    await db.query("UPDATE public.item_sketches SET inputs = inputs || '{\"iceLook\": {\"mm\": 99}}' WHERE item_id = $1", [ids.rocks]);
    assert.deepEqual((await sketch('rocks')).iceLook, { mm: 45, clear: true, stamp: true, inside: true });
    const check = async (extra) =>
      (await db.query('SELECT private.valid_sketch_inputs($1) AS ok', [JSON.stringify({ ...inputs('large'), ...extra })])).rows[0].ok;
    assert.equal(await check({ iceLook: { mm: 50, lengthMm: 120, clear: true, stamp: true, inside: true } }), true);
    assert.equal(await check({ iceLook: { mm: 500 } }), false);
    assert.equal(await check({ iceLook: { colour: 'red' } }), false);
    assert.equal(await check({ iceLook: { stamp: false } }), false);
    assert.equal(await check({ build: [{ kind: 'cubes', n: 2, mm: 32 }] }), true);
    assert.equal(await check({ build: [{ kind: 'cubes', colour: 'red' }] }), false);
  });
});
