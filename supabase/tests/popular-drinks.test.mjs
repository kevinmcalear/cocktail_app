// The add-drink list's Popular group (lib/popularDrinks.ts, Q12): every name
// is a catalog cocktail, spelled as the catalog spells it, and none repeats.
// Local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, test } from 'node:test';

import pg from 'pg';
import { tsImport } from 'tsx/esm/api';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run popular drinks tests against a non-local database: ${status.DB_URL}`);
}

const { POPULAR_DRINKS } = await tsImport('../../lib/popularDrinks.ts', import.meta.url);
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

test('every popular drink names one catalog cocktail', async () => {
  const lower = POPULAR_DRINKS.map((n) => n.toLowerCase());
  assert.equal(new Set(lower).size, lower.length, 'a name is in the list twice');
  const { rows } = await db.query(
    `select name from public.items where is_catalog and bar_id is null and item_type = 'cocktail' and name = any($1::text[])`,
    [POPULAR_DRINKS]
  );
  const found = rows.map((r) => r.name);
  assert.deepEqual(POPULAR_DRINKS.filter((n) => !found.includes(n)), [], 'not a catalog cocktail (check the spelling)');
  assert.equal(found.length, POPULAR_DRINKS.length, 'a name matches more than one catalog cocktail');
});
