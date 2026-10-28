// Mathew Resler's career (20261128100000_mathew_resler_career.sql): his eight
// jobs, past jobs at closed bars shown signed out and the rest kept for him,
// his two credited drinks with no paid flavour jobs, and running the seed
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
  throw new Error(`Refusing to run Mathew Resler tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261128100000_mathew_resler_career.sql', import.meta.url);
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('Mathew Resler', () => {
  test('all eight jobs, in order, with the closed bars shown', async () => {
    const { rows } = await db.query(
      `SELECT b.handle, pp.title, pp.is_current, pp.is_shown, pp.start_year FROM public.profile_positions pp
       JOIN public.profiles a ON a.id = pp.person_profile_id JOIN public.profiles b ON b.id = pp.bar_profile_id
       WHERE a.handle = 'mathew.resler' ORDER BY pp.start_year NULLS LAST, b.handle`
    );
    assert.deepEqual(
      rows.map((r) => `${r.handle} ${r.title} ${r.is_current} ${r.is_shown} ${r.start_year}`),
      [
        'empellon.taqueria.nyc Bar manager false false 2011',
        'goldencadillac.nyc Bartender false true 2013',
        'bargoto_nyc Head bartender false false 2015',
        'bar7.cocktailomakase Head bartender true false 2026',
        'cocktail_omakase_nyc Head bartender true false 2026',
        'bargoto_niban Bartender false false null',
        'barsardine.nyc Bartender false true null',
        'empellon.cocina.nyc Beverage director false true null',
      ]
    );
  });

  test('signed out, his current jobs and the closed bars show; open past ones wait for him', async () => {
    const { data: person, error } = await anon.from('profiles').select('id').eq('handle', 'mathew.resler').single();
    assert.ifError(error);
    const { data: jobs, error: jobsError } = await anon
      .from('profile_positions')
      .select('title, bar:profiles!bar_profile_id(handle)')
      .eq('person_profile_id', person.id);
    assert.ifError(jobsError);
    assert.deepEqual(jobs.map((j) => j.bar.handle).sort(), [
      'bar7.cocktailomakase',
      'barsardine.nyc',
      'cocktail_omakase_nyc',
      'empellon.cocina.nyc',
      'goldencadillac.nyc',
    ]);
  });

  test('his two drinks are credited to him, with no paid flavour jobs', async () => {
    const { rows } = await db.query(
      `SELECT i.name, b.handle, i.credit_status,
              (SELECT count(*)::int FROM public.recipes r WHERE r.recipe_item_id = i.id) AS lines,
              EXISTS (SELECT 1 FROM private.item_flavor_jobs j WHERE j.item_id = i.id) AS job
       FROM public.items i JOIN public.profiles b ON b.id = i.origin_bar_profile_id
       WHERE i.creator_profile_id = (SELECT id FROM public.profiles WHERE handle = 'mathew.resler') ORDER BY i.name`
    );
    assert.deepEqual(rows, [
      { name: 'Hojicha Espresso Martini', handle: 'bar7.cocktailomakase', credit_status: 'suggested', lines: 4, job: false },
      { name: 'Pork Fat Mezcal', handle: 'empellon.cocina.nyc', credit_status: 'suggested', lines: 5, job: false },
    ]);
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_positions)::int AS positions,
                               (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_notes)::int AS notes`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query(
          `LOCK TABLE public.profiles, public.profile_positions, public.items, public.recipes, public.item_notes IN SHARE MODE`
        );
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
