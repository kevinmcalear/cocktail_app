// Classics from a venue's menu (20261121500000_venue_menu_classics.sql): each
// is a catalog classic in the tree with a family, a parent, a spec and a
// source; the other names are aliases with a source (Turf Club on the Turf);
// credits go only to people and bars we have; and loading it again adds
// nothing.
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
  throw new Error(`Refusing to run venue menu classics tests against a non-local database: ${status.DB_URL}`);
}

const MIGRATION = new URL('../migrations/20261121500000_venue_menu_classics.sql', import.meta.url);
const NAMES = [
  'Addington', 'Allies Cocktail', 'Loud Speaker', 'Astoria', 'Bronx Terrace', 'Campden', 'Charlie Lindbergh',
  'Claridge Cocktail', 'Self-Starter', 'Deauville', 'Dick, Jr.', 'Fairbank', "Frank's Special", 'Hoop La', 'Odd McIntyre',
  'Jabberwock', 'Last Round', 'Montana', 'Swan', 'Trinity', 'Betsy Ross', 'Allegheny', 'Arsenic and Old Lace',
  'Battle of New Orleans', 'Bennett', 'Bermuda Rose', 'Ford', 'Frisco Sour', 'Pan American Clipper', 'Vanilla Punch',
  'Kitty Highball', 'Archangel', 'Flame of Love', 'London Calling', 'Rome With a View', 'Too Soon?', 'Medicina Latina',
  "Shaky Pete's Ginger Brew", 'Adderley', 'Commando', 'Gypsy Queen', 'Dr Henderson', 'Astor Hotel Special', 'Sputnik',
  'Coo-ee Special', 'Naked Ape', 'Precursory',
];
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('venue menu classics', () => {
  test('each is a classic in the tree with a parent, a glass, a spec and a source', async () => {
    const { rows } = await db.query(
      `SELECT i.name,
              i.lineage_family IS NOT NULL AS in_tree,
              (i.lineage_parent_id IS NOT NULL OR i.lineage_style_id IS NOT NULL) AS has_parent,
              i.glassware_id IS NOT NULL AS has_glass,
              EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id) AS has_spec,
              EXISTS (SELECT 1 FROM public.source_recipes s WHERE s.item_id = i.id) AS has_source
       FROM public.items i
       WHERE i.is_catalog AND i.item_type = 'cocktail' AND i.name = ANY($1)`,
      [NAMES]
    );
    assert.deepEqual(rows.map((r) => r.name).sort(), [...NAMES].sort());
    for (const r of rows) assert.ok(r.in_tree && r.has_parent && r.has_glass && r.has_spec && r.has_source, `${r.name}: ${JSON.stringify(r)}`);
  });

  test('a drink can descend from another of them: the Swan and Dick, Jr. from the Bronx Terrace', async () => {
    const { rows } = await db.query(
      `SELECT i.name, p.name AS parent FROM public.items i JOIN public.items p ON p.id = i.lineage_parent_id
       WHERE i.is_catalog AND i.name IN ('Swan', 'Dick, Jr.') ORDER BY i.name`
    );
    assert.deepEqual(rows, [
      { name: 'Dick, Jr.', parent: 'Bronx Terrace' },
      { name: 'Swan', parent: 'Bronx Terrace' },
    ]);
  });

  test('other names point at their classic, and Turf Club is the Turf', async () => {
    const { rows } = await db.query(
      `SELECT a.alias, i.name FROM public.classic_aliases a JOIN public.items i ON i.id = a.classic_id
       WHERE a.alias IN ('Allies Martini', 'Betty Ross', 'Bermudiana Rose', 'Fairbanks No. 2', 'Turf Club') ORDER BY a.alias`
    );
    assert.deepEqual(rows, [
      { alias: 'Allies Martini', name: 'Allies Cocktail' },
      { alias: 'Bermudiana Rose', name: 'Bermuda Rose' },
      { alias: 'Betty Ross', name: 'Betsy Ross' },
      { alias: 'Fairbanks No. 2', name: 'Fairbank' },
      { alias: 'Turf Club', name: 'Turf' },
    ]);
  });

  test('credits go to the maker a source names; a drink a book only printed has none', async () => {
    const { rows } = await db.query(
      `SELECT i.name, c.handle AS creator, b.handle AS bar
       FROM public.items i
       LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
       LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
       WHERE i.is_catalog AND i.name IN ('Rome With a View', 'Trinity') ORDER BY i.name`
    );
    assert.deepEqual(rows, [
      { name: 'Rome With a View', creator: 'michael.mcilroy', bar: 'milkandhoney.nyc' },
      { name: 'Trinity', creator: null, bar: null },
    ]);
  });

  test('loading it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_methods)::int AS methods,
                               (SELECT count(*) FROM public.classic_aliases)::int AS aliases,
                               (SELECT count(*) FROM public.sources)::int AS sources,
                               (SELECT count(*) FROM public.source_recipes)::int AS source_recipes,
                               (SELECT count(*) FROM public.items WHERE riff_of_id IS NOT NULL)::int AS versions`)
      ).rows[0];
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.items, public.recipes, public.item_methods, public.classic_aliases, public.source_recipes IN SHARE MODE');
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
