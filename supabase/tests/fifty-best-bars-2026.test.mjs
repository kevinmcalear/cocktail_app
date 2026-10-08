// The World's 50 Best Bars 2026 (20261008960000_fifty_best_bars_2026.sql):
// places 1 to 100 on public bar profiles, the night's awards, bios quoting
// the 2026 place, and running the seed again changes nothing.
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
  throw new Error(`Refusing to run 50 Best 2026 tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261008960000_fifty_best_bars_2026.sql', import.meta.url);
const AWARD = "The World's 50 Best Bars";
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe("The World's 50 Best Bars 2026", () => {
  test('places 1 to 100, each on a public bar profile', async () => {
    const { rows } = await db.query(
      `SELECT a.position FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = $1 AND a.year = 2026 AND a.position IS NOT NULL AND p.kind = 'bar' AND p.is_public
       ORDER BY a.position`,
      [AWARD]
    );
    assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 100 }, (_, i) => i + 1));
  });

  test("the night's awards, one winner each", async () => {
    const { rows } = await db.query(
      `SELECT a.title, p.handle FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = $1 AND a.year = 2026 AND a.title IS NOT NULL`,
      [AWARD]
    );
    const winners = Object.fromEntries(rows.map((r) => [r.title, r.handle]));
    assert.equal(rows.length, Object.keys(winners).length);
    assert.equal(winners['Best Bar in Asia'], 'barleonehk');
    assert.equal(winners['Best Bar in Europe'], 'moebiusmilano');
    assert.equal(winners['Best Bar Design'], 'saikindo');
    assert.equal(winners['Industry Icon'], 'shingo.gokan');
  });

  test('signed out, anyone sees Saikindō and its award', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('display_name, city, profile_awards(award, year, title)')
      .eq('handle', 'saikindo')
      .single();
    assert.ifError(error);
    assert.equal(data.city, 'Abu Dhabi');
    assert.ok(data.profile_awards.some((a) => a.award === AWARD && a.year === 2026 && a.title === 'Best Bar Design'));
  });

  test("bios quote this year's place, and bars that dropped off keep their last one", async () => {
    const { rows } = await db.query(
      `SELECT handle, bio FROM public.profiles WHERE handle = ANY($1)`,
      [['barleonehk', 'bar.us.bkk', 'tayer_elementary']]
    );
    const bio = Object.fromEntries(rows.map((r) => [r.handle, r.bio]));
    assert.match(bio.barleonehk, /No\. 1 on The World's 50 Best Bars 2026\./);
    assert.match(bio['bar.us.bkk'], /No\. 4 on The World's 50 Best Bars 2026\./);
    assert.match(bio.tayer_elementary, /No\. 5 on The World's 50 Best Bars 2025\./);
  });

  test('running it again changes nothing', async () => {
    const snapshot = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_awards)::int AS awards,
                               (SELECT md5(string_agg(bio, '|' ORDER BY id)) FROM public.profiles WHERE kind = 'bar') AS bios`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        // Other test files write to these tables at the same time; hold them
        // still so the snapshot only sees this run.
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.profiles, public.profile_awards IN SHARE MODE');
        const before = await snapshot();
        await db.query(readFileSync(MIGRATION, 'utf8'));
        assert.deepEqual(await snapshot(), before);
        break;
      } catch (e) {
        if (attempt >= 3 || !['40P01', '55P03'].includes(e.code)) throw e;
      } finally {
        await db.query('ROLLBACK');
      }
    }
  });
});
