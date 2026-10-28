// Every Cocktail Omakase and Bar 7 menu (20261128200000_omakase_every_menu.sql):
// the mockup's Tomatillo Shiso is gone, Bar 7's list is in its printed order
// with prices, the later tasting menus and Bar Libre's residency are there,
// every drink has notes and no paid flavour job, signed-out visitors see the
// menus, and running it again adds nothing.
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
  throw new Error(`Refusing to run Omakase menu tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261128200000_omakase_every_menu.sql', import.meta.url);
const BARS = ['bar7.cocktailomakase', 'barlibre_ikebukuro', 'cocktail_omakase_nyc'];
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

const menus = async (handle) =>
  (
    await db.query(
      `SELECT e.name, array_agg(i.name || coalesce(' $' || i.price, '') ORDER BY d.sort_order) AS drinks
       FROM public.profile_menu_editions e
       JOIN public.profiles p ON p.id = e.profile_id
       JOIN public.profile_menu_edition_drinks d ON d.edition_id = e.id
       JOIN public.items i ON i.id = d.item_id
       WHERE p.handle = $1 GROUP BY e.name, e.month ORDER BY e.month, e.name`,
      [handle]
    )
  ).rows;

describe('Every Cocktail Omakase and Bar 7 menu', () => {
  test("the mockup's Tomatillo Shiso is gone; the served sour has soda", async () => {
    const { rows } = await db.query(
      `SELECT i.name, array_agg(x.name ORDER BY r.sort_order) AS lines
       FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
       LEFT JOIN public.recipes r ON r.recipe_item_id = i.id LEFT JOIN public.items x ON x.id = r.ingredient_item_id
       WHERE p.handle = 'cocktail_omakase_nyc' AND i.name IN ('Tomatillo Shiso', 'Tomatillo Shiso Sour') GROUP BY i.name`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Tomatillo Shiso Sour');
    assert.equal(rows[0].lines.length, 5);
  });

  test("Bar 7's list is in printed order, with prices", async () => {
    assert.deepEqual(await menus('bar7.cocktailomakase'), [
      {
        name: 'Cocktails',
        drinks: [
          '7&7 $19.50',
          'Highball $19.50',
          'Charred Lemon Sour $19.50',
          'Hojicha Espresso Martini $21.50',
          'Apple Chrysanthemum $21.50',
          'Mizunara Negroni $22.50',
          'Gibson $22.50',
        ],
      },
    ]);
  });

  test('the later tasting menus follow the opening ones', async () => {
    const later = (await menus('cocktail_omakase_nyc')).filter((m) => !m.name.startsWith('Opening menu:'));
    assert.deepEqual(later, [
      {
        name: 'Summer menu: Low ABV',
        drinks: ['Mukaebi Dashi', 'SerenTea', 'Rising Sun Sour', '19/24', 'Apricot & Basil Cooler'],
      },
      {
        name: 'Summer menu: Spirited',
        drinks: ['Mukaebi Dashi', 'Raspberry Sansho Fizz', 'Wakayama Spritz', 'Lemongrass Negroni', 'Midori Gimlet'],
      },
      {
        name: 'Autumn menu: Spirited',
        drinks: ['Ember Highball (calvados)', 'Little Osaka', 'Mizunara Negroni (umeshu)', 'Shochu Slipper'],
      },
    ]);
  });

  test("Bar Libre's residency menu is on Bar Libre's page", async () => {
    const residency = (await menus('barlibre_ikebukuro')).find((m) => m.name === 'Residency at Bar 7, New York');
    assert.deepEqual(residency?.drinks, ['Wa-Tini $21.50', 'Fresarita', 'Edo Manhattan', 'Fresh Fruit Cocktail']);
  });

  test('every drink has notes and none queued a flavour job', async () => {
    const { rows } = await db.query(
      `SELECT i.name FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
       WHERE p.handle = ANY($1) AND i.item_type = 'cocktail' AND i.bar_id IS NULL
         AND (NOT EXISTS (SELECT 1 FROM public.item_notes n WHERE n.item_id = i.id)
              OR EXISTS (SELECT 1 FROM private.item_flavor_jobs j WHERE j.item_id = i.id))`,
      [BARS]
    );
    assert.deepEqual(rows, []);
  });

  test('signed out, anyone sees the summer menu', async () => {
    const { data, error } = await anon
      .from('profile_menu_editions')
      .select('name')
      .eq('name', 'Summer menu: Spirited');
    assert.ifError(error);
    assert.equal(data.length, 1);
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_notes)::int AS notes,
                               (SELECT count(*) FROM public.profile_menu_editions)::int AS menus,
                               (SELECT count(*) FROM public.profile_menu_edition_drinks)::int AS menu_drinks`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query(
          `LOCK TABLE public.items, public.recipes, public.item_notes, public.profile_menu_editions,
                      public.profile_menu_edition_drinks IN SHARE MODE`
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
