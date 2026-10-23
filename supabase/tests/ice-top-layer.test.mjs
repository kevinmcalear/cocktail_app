// A drink's ice (items.ice_id) is its ice build's top layer, whoever writes
// it (supabase/migrations/20261103210000_ice_top_layer.sql). Runs against the
// local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)/.test(status.DB_URL)) {
  throw new Error(`Refusing to run ice tests against a non-local database: ${status.DB_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
const run = randomUUID().slice(0, 8);

/** Runs fn inside a transaction that is always rolled back. */
async function rolledBack(fn) {
  await db.query('BEGIN');
  try {
    return await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const ice = (name) => one("INSERT INTO public.items (name, item_type) VALUES ($1, 'ice') RETURNING id", [`${name} ${run}`]).then((r) => r.id);
const build = (...ids) => JSON.stringify(ids.map((id) => ({ ice: id })));

before(() => db.connect());
after(() => db.end());

describe('ice build top layer', () => {
  test('a build sets the ice to its top layer', () =>
    rolledBack(async () => {
      const [cubes, crushed] = [await ice('Cubes'), await ice('Crushed')];
      const drink = await one(
        "INSERT INTO public.items (name, item_type, ice_id, ice_build) VALUES ($1, 'cocktail', $2, $3) RETURNING id, ice_id",
        [`Swizzle ${run}`, cubes, build(cubes, crushed)]
      );
      assert.equal(drink.ice_id, crushed);
      await db.query('UPDATE public.items SET ice_build = $2 WHERE id = $1', [drink.id, build(crushed, cubes)]);
      assert.equal((await one('SELECT ice_id FROM public.items WHERE id = $1', [drink.id])).ice_id, cubes);
    }));

  test('a new ice written on its own becomes the top layer; no ice is no build', () =>
    rolledBack(async () => {
      const [cubes, crushed, pebble] = [await ice('Cubes'), await ice('Crushed'), await ice('Pebble')];
      const { id } = await one("INSERT INTO public.items (name, item_type, ice_build) VALUES ($1, 'cocktail', $2) RETURNING id", [
        `Julep ${run}`,
        JSON.stringify([{ ice: cubes, n: 3 }, { ice: crushed, to: 'mound' }]),
      ]);
      // As merge_item moves a merged ice: the layers under it stay.
      await db.query('UPDATE public.items SET ice_id = $2 WHERE id = $1', [id, pebble]);
      assert.deepEqual(await one('SELECT ice_id, ice_build FROM public.items WHERE id = $1', [id]), {
        ice_id: pebble,
        ice_build: [{ ice: cubes, n: 3 }, { ice: pebble, to: 'mound' }],
      });
      await db.query('UPDATE public.items SET ice_id = NULL WHERE id = $1', [id]);
      assert.deepEqual(await one('SELECT ice_id, ice_build FROM public.items WHERE id = $1', [id]), { ice_id: null, ice_build: null });
    }));

  test('other writes leave a build alone', () =>
    rolledBack(async () => {
      const [cubes, crushed] = [await ice('Cubes'), await ice('Crushed')];
      const { id } = await one("INSERT INTO public.items (name, item_type, ice_build) VALUES ($1, 'cocktail', $2) RETURNING id", [
        `Cobbler ${run}`,
        build(cubes, crushed),
      ]);
      await db.query('UPDATE public.items SET description = $2, ice_id = $3 WHERE id = $1', [id, 'Sherry and sugar', crushed]);
      const row = await one('SELECT ice_id, ice_build FROM public.items WHERE id = $1', [id]);
      assert.equal(row.ice_id, crushed);
      assert.equal(row.ice_build.length, 2);
    }));
});
