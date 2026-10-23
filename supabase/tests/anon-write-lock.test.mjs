// Signed-out visitors cannot write to any public table, even if a policy is
// written wrongly, and still read what signed-out pages read
// (supabase/migrations/20261102200000_anon_write_lock.sql). Every table in
// public and private has row-level security on.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run write-lock tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

// Tables signed-out pages read, or that would hurt most if written.
const SAMPLE = ['items', 'recipes', 'bars', 'menus', 'menu_drinks', 'profiles', 'user_bars', 'rank_entries', 'images'];
const WRITES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'];
const ids = {};

/** Runs fn inside a transaction that is always rolled back. */
async function rolledBack(fn) {
  await db.query('BEGIN');
  try {
    return await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}

/** The error a statement raises as anon, after a policy that lets anon do anything. */
async function asAnonDespiteOpenPolicy(table, sql) {
  return rolledBack(async () => {
    await db.query(`CREATE POLICY "open_by_mistake_${run}" ON public.${table} FOR ALL TO anon USING (true) WITH CHECK (true)`);
    await db.query('SET LOCAL ROLE anon');
    try {
      await db.query(sql);
      return null;
    } catch (error) {
      return error;
    }
  });
}

before(async () => {
  await db.connect();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0].id;
  ids.bar = await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Write Lock Bar ${run}`]);
  ids.profile = await one(
    "INSERT INTO public.profiles (kind, handle, display_name, bar_id, is_public) VALUES ('bar', $1, $2, $3, true) RETURNING id",
    [`writelock${run}`, `Write Lock Bar ${run}`, ids.bar]
  );
  // A bar's drink with its description published: what a signed-out drink page shows.
  ids.drink = await one(
    "INSERT INTO public.items (name, item_type, bar_id, publish_mode) VALUES ($1, 'cocktail', $2, 'description') RETURNING id",
    [`Write lock ${run}`, ids.bar]
  );
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = $1', [ids.drink]);
  await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.profile]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.end();
});

describe('signed-out writes', () => {
  test('anon holds no write privilege on any public table or view, whoever owns it', async () => {
    // has_any_column_privilege also sees a grant on a single column, and the
    // catalog sees MAINTAIN, which information_schema leaves out.
    const { rows } = await db.query(
      `SELECT c.relname, p.privilege FROM pg_class c
       CROSS JOIN unnest($1::text[]) AS p(privilege)
       WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
         AND CASE WHEN p.privilege IN ('INSERT', 'UPDATE', 'REFERENCES')
                  THEN has_any_column_privilege('anon', c.oid, p.privilege)
                  ELSE has_table_privilege('anon', c.oid, p.privilege) END
       ORDER BY 1, 2`,
      [WRITES]
    );
    assert.deepEqual(rows, []);
  });

  test('anon cannot draw from or set any public sequence', async () => {
    const { rows } = await db.query(
      `SELECT c.relname FROM pg_class c
       WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
         AND (has_sequence_privilege('anon', c.oid, 'USAGE') OR has_sequence_privilege('anon', c.oid, 'UPDATE'))`
    );
    assert.deepEqual(rows, []);
  });

  test('a table (and its sequence) made by a later migration gives anon reads only, and signed-in people keep writes', async () => {
    await rolledBack(async () => {
      await db.query(`CREATE TABLE public.write_lock_probe_${run} (id serial)`);
      const { rows } = await db.query(
        `SELECT has_table_privilege('anon', $1, 'SELECT') AS anon_select,
                has_table_privilege('anon', $1, 'INSERT') AS anon_insert,
                has_table_privilege('anon', $1, 'UPDATE') AS anon_update,
                has_table_privilege('anon', $1, 'DELETE') AS anon_delete,
                has_table_privilege('anon', $1, 'MAINTAIN') AS anon_maintain,
                has_sequence_privilege('anon', $2, 'USAGE') AS anon_sequence,
                has_table_privilege('authenticated', $1, 'INSERT') AS signed_in_insert,
                has_sequence_privilege('authenticated', $2, 'USAGE') AS signed_in_sequence`,
        [`public.write_lock_probe_${run}`, `public.write_lock_probe_${run}_id_seq`]
      );
      assert.deepEqual(rows[0], {
        anon_select: true,
        anon_insert: false,
        anon_update: false,
        anon_delete: false,
        anon_maintain: false,
        anon_sequence: false,
        signed_in_insert: true,
        signed_in_sequence: true,
      });
    });
  });

  for (const table of SAMPLE) {
    test(`${table}: insert, update and delete are refused even with a policy open to anon`, async () => {
      for (const sql of [
        `INSERT INTO public.${table} DEFAULT VALUES`,
        `UPDATE public.${table} SET id = id`,
        `DELETE FROM public.${table}`,
      ]) {
        const error = await asAnonDespiteOpenPolicy(table, sql);
        assert.ok(error, `${sql} was allowed`);
        assert.equal(error.code, '42501', sql);
        assert.match(error.message, /permission denied for table/, sql);
      }
    });
  }

  test('through the API, anon writes are refused for lack of privilege', async () => {
    const inserted = await anon.from('items').insert({ name: `Anon ${run}`, item_type: 'cocktail' });
    assert.equal(inserted.error?.code, '42501');
    const updated = await anon.from('items').update({ name: 'vandalised' }).eq('id', ids.drink);
    assert.equal(updated.error?.code, '42501');
    const deleted = await anon.from('items').delete().eq('id', ids.drink);
    assert.equal(deleted.error?.code, '42501');
    const { rows } = await db.query('SELECT name FROM public.items WHERE id = $1', [ids.drink]);
    assert.equal(rows[0].name, `Write lock ${run}`);
  });
});

describe('signed-out reads', () => {
  test("a bar's published drink and its public page still read", async () => {
    const drink = await anon.from('published_items').select('id, name').eq('id', ids.drink);
    assert.ifError(drink.error);
    assert.deepEqual(drink.data, [{ id: ids.drink, name: `Write lock ${run}` }]);
    const page = await anon.from('profiles').select('id, display_name').eq('id', ids.profile);
    assert.ifError(page.error);
    assert.deepEqual(page.data, [{ id: ids.profile, display_name: `Write Lock Bar ${run}` }]);
  });

  test('the other sources signed-out pages read still answer', async () => {
    for (const [source, columns] of [
      ['releases', 'id'],
      ['app_recipe_presentation', 'id'],
      ['app_item_presentation', 'id'],
    ]) {
      const { error } = await anon.from(source).select(columns).limit(1);
      assert.ifError(error, source);
    }
    const branding = await anon.rpc('get_venue_branding', { p_slug: `no-such-venue-${run}` }).maybeSingle();
    assert.ifError(branding.error);
    const names = await anon.rpc('public_drink_ingredients', { p_item_ids: [ids.drink] });
    assert.ifError(names.error);
  });
});

describe('row-level security', () => {
  test('is on for every table in public and private', async () => {
    const { rows } = await db.query(
      `SELECT n.nspname || '.' || c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname IN ('public', 'private') AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity ORDER BY 1`
    );
    assert.deepEqual(rows.map((r) => r.name), []);
  });
});
