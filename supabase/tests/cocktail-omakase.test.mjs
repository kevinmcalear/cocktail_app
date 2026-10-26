// Cocktail Omakase and Bar 7 (20261008000000_cocktail_omakase.sql): both bars,
// Mathew Resler and his jobs, the drinks with their ingredients on the right
// menus, no paid flavour jobs queued, signed-out visitors see the bar, and
// running the seed again adds nothing.
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
  throw new Error(`Refusing to run Cocktail Omakase tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261008000000_cocktail_omakase.sql', import.meta.url);
const BARS = ['bar7.cocktailomakase', 'cocktail_omakase_nyc'];
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('Cocktail Omakase and Bar 7', () => {
  test('both bars are at 217 Eldridge Street', async () => {
    const { rows } = await db.query(
      'SELECT handle, address_line, is_public FROM public.profiles WHERE kind = $1 AND handle = ANY($2) ORDER BY handle',
      ['bar', BARS]
    );
    assert.deepEqual(rows, BARS.map((handle) => ({ handle, address_line: '217 Eldridge Street', is_public: true })));
  });

  test('Mathew Resler heads both bars; his Bar Goto job is a past one', async () => {
    const { rows } = await db.query(
      `SELECT b.handle, pp.is_current FROM public.profile_positions pp
       JOIN public.profiles a ON a.id = pp.person_profile_id JOIN public.profiles b ON b.id = pp.bar_profile_id
       WHERE a.handle = 'mathew.resler' ORDER BY b.handle`
    );
    assert.deepEqual(
      rows.map((r) => `${r.handle} ${r.is_current}`),
      ['bar7.cocktailomakase true', 'bargoto_nyc false', 'cocktail_omakase_nyc true']
    );
  });

  test('each opening menu lists its five drinks in order, all with ingredients', async () => {
    const { rows } = await db.query(
      `SELECT e.name, array_agg(i.name ORDER BY d.sort_order) AS drinks,
              bool_and(EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id)) AS all_have_lines
       FROM public.profile_menu_editions e
       JOIN public.profiles p ON p.id = e.profile_id
       JOIN public.profile_menu_edition_drinks d ON d.edition_id = e.id
       JOIN public.items i ON i.id = d.item_id
       WHERE p.handle = 'cocktail_omakase_nyc' GROUP BY e.name ORDER BY e.name`
    );
    assert.deepEqual(rows, [
      {
        name: 'Opening menu: Low ABV',
        drinks: ['Yōkoso', 'Ember Highball', 'Tomatillo Shiso Sour', 'Bamboo Tonic', 'Kogashi and Grain'],
        all_have_lines: true,
      },
      {
        name: 'Opening menu: Non-alcoholic',
        drinks: ['Yōkoso', 'Ember Highball', 'Tomatillo Shiso (non-alcoholic)', 'Kurenai', 'N/A Groni'],
        all_have_lines: true,
      },
      {
        name: 'Opening menu: Spirited',
        drinks: ['Yōkoso', 'Ember Highball', 'Tomatillo Shiso', 'Sushi Sazerac', 'Mizunara Negroni'],
        all_have_lines: true,
      },
    ]);
  });

  test("Bar 7's drinks are its own, and no drink queued a flavour job", async () => {
    const { rows } = await db.query(
      `SELECT p.handle, count(*)::int AS drinks,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM private.item_flavor_jobs j WHERE j.item_id = i.id))::int AS jobs
       FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
       WHERE p.handle = ANY($1) AND i.item_type = 'cocktail' GROUP BY p.handle ORDER BY p.handle`,
      [BARS]
    );
    assert.deepEqual(rows, [
      { handle: 'bar7.cocktailomakase', drinks: 4, jobs: 0 },
      { handle: 'cocktail_omakase_nyc', drinks: 11, jobs: 0 },
    ]);
  });

  test('signed out, anyone sees the bar and its head bartender', async () => {
    const { data: bar, error } = await anon
      .from('profiles')
      .select('id, display_name')
      .eq('handle', 'cocktail_omakase_nyc')
      .single();
    assert.ifError(error);
    assert.equal(bar.display_name, 'Cocktail Omakase');
    const { data: jobs, error: jobsError } = await anon
      .from('profile_positions')
      .select('title')
      .eq('bar_profile_id', bar.id);
    assert.ifError(jobsError);
    assert.ok(jobs.some((p) => p.title === 'Head bartender'));
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_positions)::int AS positions,
                               (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.profile_menu_editions)::int AS menus,
                               (SELECT count(*) FROM public.profile_menu_edition_drinks)::int AS menu_drinks`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        // Other test files write to these tables at the same time; hold them
        // still so the counts only see this run.
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query(
          `LOCK TABLE public.profiles, public.profile_positions, public.items, public.recipes,
                      public.profile_menu_editions, public.profile_menu_edition_drinks IN SHARE MODE`
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
