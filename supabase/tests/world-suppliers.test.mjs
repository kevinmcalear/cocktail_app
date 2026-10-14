// Suppliers beyond Melbourne (supabase/migrations/20261019500000_world_suppliers.sql):
// supplier pages land in Australia's other cities, London and New York, each
// saying what it supplies and in its own country; every line links a supplier
// to a maker's page in a region with the page that says so; the brand makers
// it adds make something; and running it again changes nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run supplier load tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261019500000_world_suppliers.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('Suppliers beyond Melbourne', () => {
  test('supplier pages land in Australia, Britain and the US, public, each saying what it supplies', async () => {
    const { rows } = await db.query(
      `SELECT country_code, count(*)::int AS n, count(*) FILTER (WHERE cardinality(supplies) > 0 AND is_public)::int AS ok
         FROM public.profiles WHERE kind = 'supplier' GROUP BY 1`
    );
    const by = Object.fromEntries(rows.map((r) => [r.country_code, r]));
    assert.ok(by.AU?.n >= 60, `${by.AU?.n} Australian suppliers`);
    assert.ok(by.GB?.n >= 5 && by.US?.n >= 5, 'London and New York suppliers');
    for (const r of rows) assert.equal(r.ok, r.n, `${r.country_code}: every supplier public with supplies`);
  });

  test("lines link a supplier to a maker's page, in the supplier's country, each with its source page", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE s.kind = 'supplier' AND m.kind = 'maker')::int AS kinds,
              count(*) FILTER (WHERE l.source_url ~ '^https?://')::int AS sourced,
              count(*) FILTER (WHERE left(l.region, 2) = s.country_code)::int AS home
         FROM public.supplier_lines l
         JOIN public.profiles s ON s.id = l.supplier_profile_id
         JOIN public.profiles m ON m.id = l.maker_profile_id`
    );
    assert.ok(rows[0].n > 300, `${rows[0].n} lines`);
    assert.equal(rows[0].kinds, rows[0].n);
    assert.equal(rows[0].sourced, rows[0].n);
    assert.equal(rows[0].home, rows[0].n);
  });

  test('a New York distributor carries brands in New York', async () => {
    const { rows } = await db.query(
      `SELECT DISTINCT l.region FROM public.supplier_lines l JOIN public.profiles s ON s.id = l.supplier_profile_id
        WHERE s.kind = 'supplier' AND s.display_name = 'Winebow'`
    );
    assert.ok(rows.some((r) => r.region === 'US-NY'));
  });

  test('every maker page a line points to says it makes something', async () => {
    const { rows } = await db.query(
      `SELECT count(DISTINCT m.id)::int AS bad FROM public.supplier_lines l
         JOIN public.profiles m ON m.id = l.maker_profile_id WHERE cardinality(m.makes) = 0`
    );
    assert.equal(rows[0].bad, 0);
  });

  test('a second run changes nothing', async () => {
    await db.query('BEGIN');
    try {
      const count = async () => {
        const { rows } = await db.query(
          `SELECT (SELECT count(*) FROM public.profiles WHERE kind IN ('maker', 'supplier'))::int AS pages,
                  (SELECT count(*) FROM public.supplier_lines)::int AS lines,
                  (SELECT md5(string_agg(id::text || array_to_string(makes, ','), ',' ORDER BY id)) FROM public.profiles WHERE kind = 'maker') AS makes`
        );
        return rows[0];
      };
      const before = await count();
      await db.query(MIGRATION);
      assert.deepEqual(await count(), before);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
