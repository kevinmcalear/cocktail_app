// Caretaker's Cottage menus (20261002200000_caretakers_cottage_menus.sql):
// every dated menu reads with the bar's profile, signed out included; the
// drinks on them are the bar's own shared cocktails with the lines a source
// lists and no sketch queued; and running the seed again adds nothing.
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
  throw new Error(`Refusing to run menu seed tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261002200000_caretakers_cottage_menus.sql', import.meta.url);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
let profileId;

before(async () => {
  await db.connect();
  const { rows } = await db.query(
    "SELECT id FROM public.profiles WHERE kind = 'bar' AND handle = 'caretakers.cottage'"
  );
  assert.equal(rows.length, 1, "the bar's profile is seeded by 20260929100000");
  profileId = rows[0].id;
});

after(async () => {
  await db.end();
});

describe("Caretaker's Cottage menus", () => {
  test('every menu on record reads signed out, with its drinks in menu order', async () => {
    const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: profileId });
    assert.ifError(error);
    const dated = data.map((m) => `${m.name} ${m.year}-${m.month}`);
    for (const expected of ['September 2026 menu 2026-9', 'Sun Goes Down, Music Goes Up 2023-10', 'Opening menu 2022-2']) {
      assert.ok(dated.includes(expected), `${expected} is on the record: ${dated.join(', ')}`);
    }
    assert.ok(data.length >= 11, `eleven menus on record, found ${data.length}`);

    const september = data.find((m) => m.name === 'September 2026 menu');
    assert.equal(september.source_url, 'https://www.caretakerscottage.bar/ccbwmenu');
    assert.deepEqual(
      september.drinks.map((d) => d.name),
      ['House Martini', 'Café Coldada', 'Bubble Fiction', 'Caravan #2', 'Thrills & Chills', "Nature's Radio", 'Alter Ego', 'Clover Club Milk Punch']
    );

    // The opening menu seeded with only a year now has its month, not a twin.
    const opening = data.filter((m) => m.name === 'Opening menu');
    assert.equal(opening.length, 1);
    assert.equal(opening[0].month, 2);
  });

  test("each menu drink is the bar's shared cocktail, with lines only where a source lists them", async () => {
    const { rows } = await db.query(
      `SELECT DISTINCT i.name, i.bar_id, i.origin_bar_profile_id = $1 AS ours,
              (SELECT count(*) FROM public.recipes r WHERE r.recipe_item_id = i.id)::int AS lines,
              EXISTS (SELECT 1 FROM private.item_image_jobs j WHERE j.item_id = i.id) AS sketch
       FROM public.profile_menu_edition_drinks d
       JOIN public.profile_menu_editions e ON e.id = d.edition_id
       JOIN public.items i ON i.id = d.item_id
       WHERE e.profile_id = $1`,
      [profileId]
    );
    assert.ok(rows.length >= 25, `the menus list the bar's drinks, found ${rows.length}`);
    assert.deepEqual(rows.filter((r) => !r.ours || r.bar_id !== null).map((r) => r.name), []);
    assert.deepEqual(rows.filter((r) => r.sketch).map((r) => r.name), [], 'no sketches queued');
    const lines = Object.fromEntries(rows.map((r) => [r.name, r.lines]));
    assert.equal(lines["Nature's Radio"], 6);
    assert.equal(lines['Fire Drill Milk Punch'], 5);
    assert.equal(lines.Nightbird, 0, 'a drink whose ingredients are unpublished gets none');

    // Doublethink had no lines; the named bottle sits under its generic.
    const doublethink = await db.query(
      `SELECT s.name AS ingredient, g.name AS generic
       FROM public.items i
       JOIN public.recipes r ON r.recipe_item_id = i.id
       JOIN public.items s ON s.id = r.ingredient_item_id
       LEFT JOIN public.items g ON g.id = r.parent_ingredient_id
       WHERE i.origin_bar_profile_id = $1 AND i.name = 'Doublethink'
       ORDER BY r.sort_order`,
      [profileId]
    );
    assert.equal(doublethink.rows.length, 6);
    assert.deepEqual(doublethink.rows[0], { ingredient: 'Purple Carrot-Infused Tequila', generic: 'Tequila' });

    // A bottle or prep the seed adds carries its generic on the item too,
    // so the generics backfill (ingredient-generics.test.mjs) stays a no-op.
    const { rows: bottles } = await db.query(
      `SELECT i.name, g.name AS generic
       FROM public.items i
       LEFT JOIN public.items g ON g.id = i.generic_id
       WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
         AND i.name IN ('Purple Carrot-Infused Tequila', 'Chamomile-Infused Mezcal', 'Olive Oil-Washed Rye', 'Four Pillars Christmas Gin')
       ORDER BY i.name`
    );
    assert.deepEqual(bottles, [
      { name: 'Chamomile-Infused Mezcal', generic: 'Mezcal' },
      { name: 'Four Pillars Christmas Gin', generic: 'Gin' },
      { name: 'Olive Oil-Washed Rye', generic: 'Rye Whiskey' },
      { name: 'Purple Carrot-Infused Tequila', generic: 'Tequila' },
    ]);
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.profile_menu_editions)::int AS menus,
                               (SELECT count(*) FROM public.profile_menu_edition_drinks)::int AS menu_drinks,
                               (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query(
          'LOCK TABLE public.profiles, public.profile_menu_editions, public.profile_menu_edition_drinks, public.items, public.recipes IN SHARE MODE'
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
