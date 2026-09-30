// Spirited Awards (2016-2026), James Beard bar awards and CLASS Bar Awards
// (20260930940000_bar_awards.sql): the awards land on the
// right bars and people, signed-out visitors see them, and running the seed
// again adds nothing.
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
  throw new Error(`Refusing to run Spirited Awards tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20260930940000_bar_awards.sql', import.meta.url);
const AWARD = 'Tales of the Cocktail Spirited Awards';
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('Spirited Awards', () => {
  test("World's Best Bar goes to the right bars", async () => {
    const { rows } = await db.query(
      `SELECT a.year, p.handle FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = $1 AND a.title IN ('World''s Best Bar', 'World''s Best Cocktail Bar') AND a.year BETWEEN 2023 AND 2025
       ORDER BY a.year`,
      [AWARD]
    );
    assert.deepEqual(
      rows.map((r) => `${r.year} ${r.handle}`),
      ['2023 sips.barcelona', '2024 alquimicocartagena', '2025 barkumiko']
    );
  });

  test('James Beard Outstanding Bar goes to the right bars', async () => {
    const { rows } = await db.query(
      `SELECT a.year, p.handle FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = 'James Beard Awards' AND a.title IN ('Outstanding Bar', 'Outstanding Bar Program')
         AND a.year IN (2012, 2024, 2025) ORDER BY a.year`
    );
    assert.deepEqual(rows.map((r) => `${r.year} ${r.handle}`), ['2012 pdtnyc', '2024 jewelnola', '2025 barkumiko']);
  });

  test('CLASS Bar of the Year goes to the right bars, in the years it was given', async () => {
    const { rows } = await db.query(
      `SELECT a.year, p.handle FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = 'CLASS Bar Awards' AND a.title = 'Bar of the Year' AND a.year >= 2024 ORDER BY a.year`
    );
    assert.deepEqual(rows.map((r) => `${r.year} ${r.handle}`), ['2024 satans_whiskers', '2025 satans_whiskers', '2026 satans_whiskers']);
    const { rows: years } = await db.query(
      "SELECT DISTINCT year FROM public.profile_awards WHERE award = 'CLASS Bar Awards' ORDER BY year"
    );
    assert.deepEqual(years.map((r) => r.year), [2017, 2018, 2019, 2020, 2022, 2023, 2024, 2025, 2026]);
  });

  test('every year from 2016 has Spirited Awards winners, with a source', async () => {
    const { rows } = await db.query(
      `SELECT year, count(*)::int AS n, count(*) FILTER (WHERE source_url IS NULL)::int AS unsourced
       FROM public.profile_awards WHERE award = $1 AND year >= 2016 GROUP BY year ORDER BY year`,
      [AWARD]
    );
    assert.deepEqual(rows.map((r) => r.year), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    assert.ok(rows.every((r) => r.n >= 3 && r.unsourced === 0));
  });

  test('signed out, anyone sees a winning bar and its award', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('display_name, profile_awards(award, year, title)')
      .eq('handle', 'barkumiko')
      .single();
    assert.ifError(error);
    assert.ok(data.profile_awards.some((a) => a.award === AWARD && a.year === 2025 && a.title === "World's Best Bar"));
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_awards)::int AS awards,
                               (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        // Other test files write to these tables at the same time; hold them
        // still so the counts only see this run.
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.profiles, public.profile_awards, public.items, public.recipes, public.item_methods IN SHARE MODE');
        const before = await count();
        await db.query(readFileSync(MIGRATION, 'utf8'));
        assert.deepEqual(await count(), before);
        break;
      } catch (e) {
        if (attempt >= 3 || !['40P01', '55P03'].includes(e.code)) throw e;
      } finally {
        await db.query('ROLLBACK');
      }
    }
  });
});
