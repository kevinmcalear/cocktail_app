// Melbourne suppliers (supabase/migrations/20261017770000_melbourne_suppliers.sql):
// supplier pages say what they supply, every line links a supplier to a
// maker's page in a region with the page that says so, the brand makers the
// load adds make something, and running it again changes nothing.
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

const MIGRATION = readFileSync(new URL('../migrations/20261017770000_melbourne_suppliers.sql', import.meta.url), 'utf8');
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('Melbourne suppliers', () => {
  test('supplier pages land, public, each saying what it supplies', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE cardinality(supplies) > 0)::int AS with_supplies,
              count(*) FILTER (WHERE is_public)::int AS public
         FROM public.profiles WHERE kind = 'supplier' AND country_code = 'AU'`
    );
    assert.ok(rows[0].n >= 40, `${rows[0].n} suppliers`);
    assert.equal(rows[0].with_supplies, rows[0].n);
    assert.equal(rows[0].public, rows[0].n);
  });

  test("lines link a supplier to a maker's page in a region, each with its source page", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE s.kind = 'supplier' AND m.kind = 'maker')::int AS kinds,
              count(*) FILTER (WHERE l.source_url ~ '^https?://')::int AS sourced,
              count(*) FILTER (WHERE l.region = 'AU-VIC')::int AS vic
         FROM public.supplier_lines l
         JOIN public.profiles s ON s.id = l.supplier_profile_id
         JOIN public.profiles m ON m.id = l.maker_profile_id`
    );
    assert.ok(rows[0].n > 250, `${rows[0].n} lines`);
    assert.equal(rows[0].kinds, rows[0].n);
    assert.equal(rows[0].sourced, rows[0].n);
    assert.ok(rows[0].vic > 0, 'some lines are Victoria only');
  });

  test('a supplier carries its brands where it says: Pail & Cooper in Victoria', async () => {
    const { rows } = await db.query(
      `SELECT DISTINCT l.region FROM public.supplier_lines l JOIN public.profiles s ON s.id = l.supplier_profile_id
        WHERE s.kind = 'supplier' AND s.display_name = 'Pail & Cooper'`
    );
    assert.ok(rows.some((r) => r.region === 'AU-VIC'));
  });

  test('a second run changes nothing', async () => {
    await db.query('BEGIN');
    try {
      const count = async () => {
        const { rows } = await db.query(
          `SELECT (SELECT count(*) FROM public.profiles WHERE kind IN ('maker', 'supplier'))::int AS pages,
                  (SELECT count(*) FROM public.supplier_lines)::int AS lines`
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
