// Asia's, North America's and Europe's 50 Best Bars 2026
// (20260929900000_regional_fifty_best.sql): every bar on the three lists has a public profile and its place, and running the
// seed again adds nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run regional 50 Best tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20260929900000_regional_fifty_best.sql', import.meta.url);
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe("Asia's, North America's and Europe's 50 Best Bars 2026", () => {
  for (const award of ["Asia's 50 Best Bars", "North America's 50 Best Bars", "Europe's 50 Best Bars"]) {
    test(`${award}: places 1 to 50, each on a public bar profile`, async () => {
      const { rows } = await db.query(
        `SELECT a.position FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
         WHERE a.award = $1 AND a.year = 2026 AND a.position <= 50 AND p.kind = 'bar' AND p.is_public
         ORDER BY a.position`,
        [award]
      );
      assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 50 }, (_, i) => i + 1));
    });
  }

  test('signed out, anyone sees a new bar and its place', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('display_name, profile_awards(award, year, position)')
      .eq('handle', 'barkumiko')
      .single();
    assert.ifError(error);
    assert.ok(data.profile_awards.some((a) => a.award === "North America's 50 Best Bars" && a.position === 11));
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_awards)::int AS awards,
                               (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes`)
      ).rows[0];
    await db.query('BEGIN');
    try {
      // Other test files write to these tables at the same time; hold them
      // still so the counts only see this run.
      await db.query('LOCK TABLE public.profiles, public.profile_awards, public.items, public.recipes, public.item_methods IN SHARE MODE');
      const before = await count();
      await db.query(readFileSync(MIGRATION, 'utf8'));
      assert.deepEqual(await count(), before);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
