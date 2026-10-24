// Classics the family tree missed (20261106100000_missing_classics.sql): each
// is a catalog classic in the tree with a family, a parent, a spec and a
// source; Eggnog takes the nogs under it; bars' drinks of the same name
// become its versions, but a same-name drink that is something else does
// not; and loading it again adds nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

import { notesBackOnRows } from './fixtures/credited-notes.mjs';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run missing classics tests against a non-local database: ${status.DB_URL}`);
}

const MIGRATION = new URL('../migrations/20261106100000_missing_classics.sql', import.meta.url);
const NAMES = [
  'Champagne Cocktail', "Planter's Punch", 'Mary Pickford', 'Douglas Fairbanks', 'Charlie Chaplin', 'Angel Face',
  'Paradise', 'Periodista', 'Floradora', 'Twelve Mile Limit', "Widow's Kiss", 'Star', 'Blackthorn', 'Algonquin',
  "Satan's Whiskers", 'Income Tax', 'Abbey', 'Leap Year', 'Journalist', 'Orange Blossom', 'Absinthe Suissesse',
  'French Martini', 'Sex on the Beach', 'Russian Spring Punch', 'Spicy Fifty', 'Illegal', 'Barracuda', 'Yellow Bird',
  'Rum Runner', 'Whisky Mac', 'Sangria', 'Mulled Wine', 'Eggnog', 'Chilcano', 'Cantarito', 'Vampiro', 'Rebujito',
  'Bicicletta',
];
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('missing classics', () => {
  test('each is a classic in the tree with a parent, a spec and a source', async () => {
    const { rows } = await db.query(
      `SELECT i.name,
              i.lineage_family IS NOT NULL AS in_tree,
              (i.lineage_parent_id IS NOT NULL OR i.lineage_style_id IS NOT NULL) AS has_parent,
              EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id) AS has_spec,
              EXISTS (SELECT 1 FROM public.source_recipes s WHERE s.item_id = i.id) AS has_source
       FROM public.items i
       WHERE i.is_catalog AND i.item_type = 'cocktail' AND i.name = ANY($1)`,
      [NAMES]
    );
    assert.deepEqual(rows.map((r) => r.name).sort(), [...NAMES].sort());
    for (const r of rows) assert.ok(r.in_tree && r.has_parent && r.has_spec && r.has_source, `${r.name}: ${JSON.stringify(r)}`);
  });

  test('the Charlie Chaplin is from the Waldorf-Astoria and the Spicy Fifty is Salvatore Calabrese\'s', async () => {
    const { rows } = await db.query(
      `SELECT i.name, c.handle AS creator, b.handle AS bar
       FROM public.items i
       LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
       LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
       WHERE i.is_catalog AND i.name IN ('Charlie Chaplin', 'Spicy Fifty') ORDER BY i.name`
    );
    assert.deepEqual(rows, [
      { name: 'Charlie Chaplin', creator: null, bar: 'waldorfastoria.1893' },
      { name: 'Spicy Fifty', creator: 'salvatore.calabrese', bar: 'fifty.london' },
    ]);
  });

  test('mulled wine keeps its 1390 date, and the two no source dates are best guesses', async () => {
    const { rows } = await db.query(
      `SELECT name, origin_year AS year, origin_year_guess AS guess FROM public.items
       WHERE is_catalog AND name IN ('Mulled Wine', 'Bicicletta', 'Cantarito') ORDER BY name`
    );
    assert.deepEqual(rows, [
      { name: 'Bicicletta', year: 1935, guess: 'mid' },
      { name: 'Cantarito', year: 1975, guess: 'decade' },
      { name: 'Mulled Wine', year: 1390, guess: null },
    ]);
  });

  test('Eggnog takes the nogs under it', async () => {
    const { rows } = await db.query(
      `SELECT i.name FROM public.items i JOIN public.items p ON p.id = i.lineage_parent_id
       WHERE p.is_catalog AND p.name = 'Eggnog' ORDER BY i.name`
    );
    assert.deepEqual(rows.map((r) => r.name), ['Baltimore Egg Nogg', 'Coquito', "General Harrison's Egg Nogg", 'Tom and Jerry']);
  });

  test("bars' drinks of the same name are versions, a same-name drink that is something else is not", async () => {
    const { rows } = await db.query(
      `SELECT v.name, b.handle, c.name AS classic
       FROM public.items v
       JOIN public.profiles b ON b.id = v.origin_bar_profile_id
       LEFT JOIN public.items c ON c.id = v.riff_of_id
       WHERE NOT v.is_catalog AND (v.name, b.handle) IN (('Charlie Chaplin', 'holygrailchapel'), ('Orange Blossom', 'theironfairieskl'))
       ORDER BY v.name`
    );
    assert.deepEqual(rows, [
      { name: 'Charlie Chaplin', handle: 'holygrailchapel', classic: 'Charlie Chaplin' },
      { name: 'Orange Blossom', handle: 'theironfairieskl', classic: null },
    ]);
  });

  test('loading it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_positions)::int AS positions,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_co_creators)::int AS co_creators,
                               (SELECT count(*) FROM public.source_recipes)::int AS sources,
                               (SELECT count(*) FROM public.items WHERE riff_of_id IS NOT NULL)::int AS versions`)
      ).rows[0];
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.profiles, public.items, public.recipes, public.item_methods, public.source_recipes IN SHARE MODE');
        await notesBackOnRows(db);
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
