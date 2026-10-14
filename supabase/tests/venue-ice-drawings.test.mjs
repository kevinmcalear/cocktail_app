// The venue's ice in its drinks' drawings (20261019600000_venue_ice_drawings.sql):
// a guessed ice gives way to the venue's nearest kind (inputs.houseIce), a spec's
// own ice never does, and a change to the venue's Ice list redraws its drinks.
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
  throw new Error(`Refusing to run venue ice tests against a non-local API: ${status.API_URL}`);
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

const houseIce = async (key) =>
  (await db.query("SELECT inputs ->> 'houseIce' AS h FROM public.item_sketches WHERE item_id = $1", [ids[key]])).rows[0].h;
const kit = (key) => db.query("INSERT INTO public.bar_kit (bar_id, kind, key) VALUES ($1, 'ice', $2)", [ids.bar, key]);

before(async () => {
  await db.connect();
  ids.bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`ice bar ${run}`])).rows[0].id;
  ids.page = (await db.query(
    "INSERT INTO public.profiles (kind, handle, display_name, is_public, bar_id) VALUES ('bar', $1, $2, true, $3) RETURNING id",
    [`icebar${run}`, `Ice bar ${run}`, ids.bar]
  )).rows[0].id;
  await drink('guessed', { bar_id: ids.bar }, 'large');
  await drink('spec', { bar_id: ids.bar }, 'large', 'data');
  await drink('seeded', { origin_bar_profile_id: ids.page }, 'crushed');
  await drink('elsewhere', {}, 'large');
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [Object.values(ids).filter((v) => v !== ids.bar && v !== ids.page)]);
  await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.page]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.end();
});

describe('the venue\'s ice in its drawings', () => {
  test('nothing changes while the venue lists no ice', async () => {
    assert.equal(await houseIce('guessed'), null);
  });

  test('a guessed ice gives way to the venue\'s nearest kind, for its own and its seeded drinks', async () => {
    await kit('cubes');
    await kit('pebble');
    assert.equal(await houseIce('guessed'), 'cubes', 'large -> cubes');
    assert.equal(await houseIce('seeded'), 'pebble', 'crushed -> pebble');
  });

  test('a spec\'s own ice, and another bar\'s drink, never change', async () => {
    assert.equal(await houseIce('spec'), null);
    assert.equal(await houseIce('elsewhere'), null);
  });

  test('the venue having the guessed kind leaves it be; taking it away brings the nearest back', async () => {
    await kit('large');
    assert.equal(await houseIce('guessed'), null);
    await db.query("DELETE FROM public.bar_kit WHERE bar_id = $1 AND key = 'large'", [ids.bar]);
    assert.equal(await houseIce('guessed'), 'cubes');
  });

  test('a writer can\'t set it: the database works it out on every write', async () => {
    await db.query("UPDATE public.item_sketches SET inputs = jsonb_set(inputs, '{houseIce}', '\"shaved\"') WHERE item_id = $1", [ids.guessed]);
    assert.equal(await houseIce('guessed'), 'cubes');
    await db.query("UPDATE public.item_sketches SET inputs = jsonb_set(inputs, '{houseIce}', '\"shaved\"') WHERE item_id = $1", [ids.spec]);
    assert.equal(await houseIce('spec'), null);
  });

  test('the nearest-kind table matches the app\'s (lib/venueKit.ts houseIce)', async () => {
    const cases = [
      ['cubes', ['large', 'crushed'], 'large'],
      ['crushed', ['cubes', 'pebble'], 'pebble'],
      ['spear', ['crushed'], null],
      ['cubes', ['cubes', 'large'], null],
      ['none', ['cubes'], null],
      ['cubes', [], null],
    ];
    for (const [ice, kinds, want] of cases) {
      const { rows } = await db.query('SELECT private.house_ice($1, $2::text[]) AS k', [ice, kinds]);
      assert.equal(rows[0].k, want, `${ice} with ${kinds.join('/')}`);
    }
  });
});
