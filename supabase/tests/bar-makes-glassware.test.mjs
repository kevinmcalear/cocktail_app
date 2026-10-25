// A bar's page may make glassware (20261116200000_bar_makes_glassware.sql):
// the tiki bars' own mugs point at their bar pages, a bar that makes
// glassware may be a glass's maker or "glass by" credit, and nothing else
// changes: a bar can't say it makes bottles, a person makes nothing, and a
// bar that doesn't make glassware is still refused as a glass's maker.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run bar glassware tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
before(() => db.connect());
after(() => db.end());

/** Runs `sql` in a transaction that is always rolled back; resolves to the error's message, or null. */
async function refused(sql) {
  await db.query('BEGIN');
  try {
    await db.query(sql);
    return null;
  } catch (err) {
    return err.message;
  } finally {
    await db.query('ROLLBACK');
  }
}

describe('a bar page may make glassware', () => {
  test("the tiki bars' own mugs point at their bar pages", async () => {
    const { rows } = await db.query(
      `SELECT p.handle, p.kind, count(*)::int AS mugs FROM public.glass_models m JOIN public.profiles p ON p.id = m.maker_profile_id
        WHERE m.name IN ('Smuggler''s Cove Kuhiko (Sunken Tiki) Mug', 'Hale Pele The Forgotten Float Bowl', 'Latitude 29 Coconut Mug',
                         'Three Dots and a Dash Rum Barrel Mug', 'Tiki Farm Mr. Moai Mug')
        GROUP BY 1, 2 ORDER BY 1`
    );
    assert.deepEqual(rows, [
      { handle: 'hale.pele', kind: 'bar', mugs: 1 },
      { handle: 'latitude29nola', kind: 'bar', mugs: 1 },
      { handle: 'smugglerscovesf', kind: 'bar', mugs: 1 },
      { handle: 'threedotsandadash', kind: 'bar', mugs: 1 },
      { handle: 'tiki.farm', kind: 'maker', mugs: 1 },
    ]);
  });

  test('a bar that makes glassware may make a venue glass', async () => {
    const err = await refused(
      // Not its main tiki glass: Smuggler's Cove already has one (bar_glassware_default_key).
      `INSERT INTO public.bar_glassware (profile_id, glass, name, maker_profile_id, is_default)
       SELECT (SELECT id FROM public.profiles WHERE handle = 'smugglerscovesf'), 'tiki', 'House mug', (SELECT id FROM public.profiles WHERE handle = 'tonga.hut'), false`
    );
    assert.equal(err, null);
  });

  test("a bar that doesn't make glassware is still refused", async () => {
    const err = await refused(
      `UPDATE public.glass_models SET maker_profile_id = (SELECT id FROM public.profiles WHERE kind = 'bar' AND cardinality(makes) = 0 LIMIT 1)
        WHERE name = 'Tiki Farm Mr. Moai Mug'`
    );
    assert.match(err ?? '', /must be a page that makes glassware/);
  });

  test('a bar makes only glassware, and a person makes nothing', async () => {
    assert.match((await refused(`UPDATE public.profiles SET makes = ARRAY['bottles'] WHERE handle = 'tonga.hut'`)) ?? '', /profiles_makes_known/);
    assert.match(
      (await refused(`UPDATE public.profiles SET makes = ARRAY['glassware'] WHERE id = (SELECT id FROM public.profiles WHERE kind = 'person' LIMIT 1)`)) ?? '',
      /profiles_makes_known/
    );
  });
});
