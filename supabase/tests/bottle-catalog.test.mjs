// The bottle catalog (20261008900100_bottle_catalog.sql): every shared
// ingredient says what it is, styles list the bottles you can buy, and the
// tree has the shape 20261008900000 asks for.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run catalog tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
const MIGRATION = new URL('../migrations/20261008900100_bottle_catalog.sql', import.meta.url);
// The catalog fills after it correct some of its styles, so it is re-run with
// them, in order (those this branch has). Found by name, since a migration is
// renumbered to land after production's latest.
const MIGRATIONS = [
  MIGRATION,
  ...readdirSync(new URL('../migrations/', import.meta.url))
    .filter((f) => /^\d{14}_ingredient_tree_fill(_\d+)?\.sql$/.test(f))
    .sort()
    .map((f) => new URL(`../migrations/${f}`, import.meta.url)),
];

before(() => db.connect());
after(() => db.end());

async function one(sql, params = []) {
  return (await db.query(sql, params)).rows[0];
}

async function bottlesOf(style) {
  const { rows } = await db.query(
    `SELECT b.name FROM public.items b JOIN public.items s ON s.id = b.generic_id
      WHERE s.bar_id IS NULL AND s.name = $1 AND b.ingredient_role = 'product' AND b.bar_id IS NULL`,
    [style]
  );
  return rows.map((r) => r.name);
}

describe('bottle catalog', () => {
  test('the styles bartenders ask about list real bottles', async () => {
    const expected = {
      'Sweet Vermouth': ['Carpano Antica Formula'],
      'Dry Vermouth': ['Dolin Dry Vermouth'],
      'Bourbon': ['Buffalo Trace'],
      'Rhum Agricole': [],
    };
    for (const [style, some] of Object.entries(expected)) {
      const bottles = await bottlesOf(style);
      assert.ok(bottles.length >= 3, `${style} has ${bottles.length} bottles`);
      for (const b of some) assert.ok(bottles.some((n) => n.startsWith(b)), `${style} lists ${b}: ${bottles.join(', ')}`);
    }
  });

  test('shared styles never sit under a bottle, and no core row is a bottle', async () => {
    const underBottle = await one(
      `SELECT count(*)::int AS n FROM public.items i JOIN public.items p ON p.id = i.generic_id
        WHERE i.bar_id IS NULL AND i.item_type = 'ingredient' AND p.ingredient_role = 'product'`
    );
    assert.equal(underBottle.n, 0);
    const coreBottles = await one(`SELECT count(*)::int AS n FROM public.items WHERE is_core AND ingredient_role = 'product'`);
    assert.equal(coreBottles.n, 0);
  });

  test('preps are made from bottles', async () => {
    const wrong = await one(
      `SELECT count(*)::int AS n FROM public.items i JOIN public.items m ON m.id = i.made_from_id
        WHERE i.bar_id IS NULL AND m.ingredient_role IS DISTINCT FROM 'product'`
    );
    assert.equal(wrong.n, 0);
  });

  test('a folded name still finds its bottle', async () => {
    const { rows } = await db.query(
      `SELECT a.key, i.name FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
        WHERE i.ingredient_role = 'product' LIMIT 20`
    );
    assert.ok(rows.length > 0, 'bottles keep their other names as aliases');
    for (const r of rows) {
      const found = await one('SELECT public.resolve_ingredient($1) AS id', [r.key]);
      assert.ok(found.id, r.key);
    }
  });

  test('running it again changes nothing', async () => {
    const snapshot = `SELECT count(*)::int AS n, count(*) FILTER (WHERE ingredient_role = 'product')::int AS bottles,
                             md5(string_agg(id::text || coalesce(generic_id::text, '') || coalesce(made_from_id::text, '') || coalesce(ingredient_role, '') || name, ',' ORDER BY id)) AS h
                        FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL`;
    const before = await one(snapshot);
    await db.query('BEGIN');
    try {
      for (const m of MIGRATIONS) await db.query(readFileSync(m, 'utf8'));
      assert.deepEqual(await one(snapshot), before);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
