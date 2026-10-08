// The cocktail family tree (20261008835000_drink_lineage.sql and
// 20261008835100_cocktail_family_tree.sql): every classic in the tree has a
// family and a parent that is a classic or a style, the lines end at a root
// without loops, only catalog admins change lineage, and loading it again
// adds nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { notesBackOnRows } from './fixtures/credited-notes.mjs';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run family tree tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20261008835100_cocktail_family_tree.sql', import.meta.url);
const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
let user;

before(async () => {
  await db.connect();
  const email = `tree-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  user = { id: data.user.id, client };
});

after(async () => {
  if (user) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('cocktail family tree', () => {
  test('every classic in the tree has a family and a parent that is a classic or a style', async () => {
    const { rows } = await db.query(`
      SELECT count(*)::int AS n,
             count(*) FILTER (WHERE i.lineage_parent_id IS NULL AND i.lineage_style_id IS NULL)::int AS orphans,
             count(*) FILTER (WHERE p.id IS NOT NULL AND NOT p.is_catalog)::int AS bad_parent
      FROM public.items i
      LEFT JOIN public.items p ON p.id = i.lineage_parent_id
      WHERE i.lineage_family IS NOT NULL`);
    assert.ok(rows[0].n >= 390, `expected the tree's classics, found ${rows[0].n}`);
    assert.equal(rows[0].orphans, 0);
    assert.equal(rows[0].bad_parent, 0);
  });

  test('every line climbs to a root style without a loop', async () => {
    const { rows } = await db.query(`
      WITH RECURSIVE up AS (
        SELECT i.id AS start, i.lineage_parent_id AS drink, i.lineage_style_id AS style, 1 AS depth
        FROM public.items i WHERE i.lineage_family IS NOT NULL
        UNION ALL
        SELECT u.start, p.lineage_parent_id, p.lineage_style_id, u.depth + 1
        FROM up u JOIN public.items p ON p.id = u.drink
        WHERE u.depth < 40
      )
      SELECT count(DISTINCT start)::int AS reached, max(depth)::int AS deepest
      FROM up WHERE drink IS NULL AND style IS NOT NULL`);
    const total = await db.query('SELECT count(*)::int AS n FROM public.items WHERE lineage_family IS NOT NULL');
    assert.equal(rows[0].reached, total.rows[0].n, 'every classic reaches a style');
    assert.ok(rows[0].deepest < 40, 'no loops');

    const styles = await db.query(`
      WITH RECURSIVE up AS (
        SELECT s.id AS start, s.parent_style_id AS next, 1 AS depth FROM public.drink_styles s
        UNION ALL
        SELECT u.start, p.parent_style_id, u.depth + 1 FROM up u JOIN public.drink_styles p ON p.id = u.next WHERE u.depth < 40
      )
      SELECT (SELECT count(*) FROM public.drink_styles)::int AS n, count(DISTINCT start)::int AS rooted, max(depth)::int AS deepest
      FROM up WHERE next IS NULL`);
    assert.equal(styles.rows[0].rooted, styles.rows[0].n);
    assert.ok(styles.rows[0].deepest < 40);
  });

  test('classics keep riff_of_id empty, so rankings still read it as a bar version', async () => {
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.items WHERE is_catalog AND riff_of_id IS NOT NULL');
    assert.equal(rows[0].n, 0);
  });

  test('creators are people and origin bars are bars, closed ones marked closed', async () => {
    const { rows } = await db.query(`
      SELECT count(*) FILTER (WHERE c.kind <> 'person')::int AS bad_creator,
             count(*) FILTER (WHERE b.kind <> 'bar')::int AS bad_bar,
             count(*) FILTER (WHERE b.is_closed)::int AS closed
      FROM public.items i
      LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
      LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
      WHERE i.lineage_family IS NOT NULL`);
    assert.equal(rows[0].bad_creator, 0);
    assert.equal(rows[0].bad_bar, 0);
    assert.ok(rows[0].closed > 0, 'some classics come from bars that have closed');
  });

  test('no paid AI work was queued for the tree', async () => {
    const { rows } = await db.query(`
      SELECT (SELECT count(*) FROM private.item_image_jobs j JOIN public.items i ON i.id = j.item_id WHERE i.lineage_family IS NOT NULL)::int AS images`);
    assert.equal(rows[0].images, 0);
  });

  test('styles are readable by everyone and writable by no one', async () => {
    const { data, error } = await anon.from('drink_styles').select('key').eq('key', 'punch');
    assert.ifError(error);
    assert.equal(data.length, 1);
    const { error: writeError } = await user.client.from('drink_styles').insert({ key: `x-${run}`, name: 'Nope', family: 'sour' });
    assert.ok(writeError, 'a signed-in user cannot add a style');
  });

  test('only catalog admins change a classic\'s lineage', async () => {
    // Run as an ordinary signed-in user at the SQL level, past RLS, to reach the trigger.
    await db.query('BEGIN');
    try {
      const { rows } = await db.query("SELECT id FROM public.items WHERE is_catalog AND lineage_parent_id IS NOT NULL LIMIT 1");
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user.id, role: 'authenticated' })]);
      await assert.rejects(
        db.query("UPDATE public.items SET lineage_note = 'changed' WHERE id = $1", [rows[0].id]),
        /Only catalog admins can change the family tree/
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('loading it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.profiles)::int AS profiles,
                               (SELECT count(*) FROM public.profile_positions)::int AS positions,
                               (SELECT count(*) FROM public.drink_styles)::int AS styles,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_co_creators)::int AS co_creators,
                               (SELECT count(*) FROM public.source_recipes)::int AS sources`)
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
