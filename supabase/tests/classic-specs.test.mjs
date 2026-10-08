// The catalog classics have a spec and no outside citation
// (20261008840000_classic_specs.sql).
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run classic spec tests against a non-local database: ${status.DB_URL}`);
}
const db = new pg.Client({ connectionString: status.DB_URL });

// Other test files add catalog fixtures named with their run id.
const NOT_FIXTURE = "i.name !~ ' [0-9a-f]{8}$'";

before(() => db.connect());
after(() => db.end());

test('every seeded classic has a spec', async () => {
  const { rows } = await db.query(`
    SELECT i.name FROM public.items i
    WHERE i.is_catalog AND i.item_type = 'cocktail' AND ${NOT_FIXTURE}
      AND (SELECT count(*) FROM public.recipes r WHERE r.recipe_item_id = i.id) < 2`);
  assert.deepEqual(rows.map((r) => r.name), []);
});

test("no classic cites Punch or Difford's", async () => {
  const { rows } = await db.query(`
    SELECT i.name FROM public.items i
    WHERE i.is_catalog AND ${NOT_FIXTURE}
      AND (i.notes ~* '(punchdrink|diffordsguide|difford|spec (as )?adapted from)'
           OR i.notes ~ 'Punch''s|Punch (notes|calls|says|counts|describes|stresses|reports|suggests|recommends|prefers|favors|places|dismisses|credits|points|treats|pitches|sums|dates|has|lists)')`);
  assert.deepEqual(rows.map((r) => r.name), []);
});
