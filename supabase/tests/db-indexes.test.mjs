// Ingredient indexes, search_bar_drinks checking the editor before the
// ingredient match, and the job crons returning early on an empty queue
// (supabase/migrations/20261008800000_db_indexes.sql).
// Fixtures go in directly (no write guards) and are removed afterwards; each
// check runs in its own short transaction, so no lock is held across files.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run index tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
const run = randomUUID().slice(0, 8);
const id = {};
const uid = (key) => (id[key] ??= randomUUID());

// search_bar_drinks as 20261007153000_menu_edition_dates.sql defined it.
const OLD_SEARCH = `
CREATE FUNCTION pg_temp.old_search_bar_drinks(p_query text, p_limit integer DEFAULT 48) RETURNS TABLE(item_id uuid, credit text, edition_id uuid, edition_name text, start_year smallint, start_month smallint, end_year smallint, end_month smallint, is_current boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
    WITH q AS (
        SELECT lower(btrim(p_query)) AS text,
               replace(replace(replace(lower(btrim(p_query)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS pat
    )
    SELECT i.id, coalesce(b.display_name, c.display_name),
           r.edition_id, r.edition_name, r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
    FROM public.items i
    CROSS JOIN q
    LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
    LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
    LEFT JOIN public.menu_drink_runs r ON r.item_id = i.id
    WHERE i.item_type = 'cocktail'
      AND i.bar_id IS NULL
      AND i.moderated_at IS NULL
      AND (b.id IS NOT NULL OR c.id IS NOT NULL)
      AND q.text <> ''
      AND (
          lower(i.name) LIKE '%' || q.pat || '%'
          OR lower(i.description) LIKE '%' || q.pat || '%'
          OR lower(b.display_name) LIKE '%' || q.pat || '%'
          OR lower(c.display_name) LIKE '%' || q.pat || '%'
          OR EXISTS (
              SELECT 1 FROM public.recipes rc
              JOIN public.items ing ON ing.id = rc.ingredient_item_id
              WHERE rc.recipe_item_id = i.id AND lower(ing.name) LIKE '%' || q.pat || '%'
          )
      )
    ORDER BY
        CASE WHEN r.is_current THEN 0 WHEN r.item_id IS NULL THEN 1 WHEN r.end_year IS NULL THEN 2 ELSE 3 END,
        lower(i.name) LIKE q.pat || '%' DESC,
        i.name, i.id
    LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;`;

async function asUser(key, fn) {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid(`user:${key}`), role: 'authenticated' })]);
    await db.query('SET LOCAL ROLE authenticated');
    return await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}

before(async () => {
  await db.connect();
  await db.query('SET session_replication_role = replica');
  for (const u of ['maker', 'reader', 'admin']) {
    await db.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now(), now())`,
      [uid(`user:${u}`), `${u}-${run}@security-test.local`]
    );
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [uid('user:admin')]);
  const profile = (key, cols) =>
    db.query(
      'INSERT INTO public.profiles (id, kind, handle, display_name, is_public, bar_id, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [uid(`profile:${key}`), cols.kind, `idx${key.toLowerCase()}${run}`, cols.name, cols.is_public ?? true, cols.bar_id ?? null, cols.user_id ?? null]
    );
  await profile('bar', { kind: 'bar', name: `Quokka Lounge ${run}` });
  await profile('hiddenBar', { kind: 'bar', name: `Quokka Hidden ${run}`, is_public: false });
  await profile('maker', { kind: 'person', name: `Wombat Barkeep ${run}`, user_id: uid('user:maker') });
  const item = (key, cols) => {
    const row = { id: uid(`item:${key}`), name: `${key} ${run}`, created_by: null, ...cols };
    const names = Object.keys(row);
    return db.query(`INSERT INTO public.items (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
  };
  await item('Numbat Gin', { item_type: 'ingredient' });
  await item('Quokka Sour', { item_type: 'cocktail', origin_bar_profile_id: uid('profile:bar'), description: 'Bright, with a wombat garnish' });
  await item('Bilby Fizz', { item_type: 'cocktail', origin_bar_profile_id: uid('profile:bar') });
  await item('Hidden Sour', { item_type: 'cocktail', origin_bar_profile_id: uid('profile:hiddenBar') });
  await item('Maker Sour', { item_type: 'cocktail', creator_profile_id: uid('profile:maker'), created_by: uid('user:maker'), publish_mode: 'spec' });
  await item('Moderated Sour', { item_type: 'cocktail', origin_bar_profile_id: uid('profile:bar'), moderated_at: new Date() });
  for (const drink of ['Bilby Fizz', 'Maker Sour']) {
    await db.query('INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit) VALUES ($1, $2, 30, $3)', [uid(`item:${drink}`), uid('item:Numbat Gin'), 'ml']);
  }
  await db.query('SET session_replication_role = origin');
  await db.query(OLD_SEARCH);
});

after(async () => {
  const of = (prefix) => Object.entries(id).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
  await db.query('SET session_replication_role = replica');
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1)', [of('item:')]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [of('item:')]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [of('profile:')]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [of('user:')]);
  await db.query('DELETE FROM auth.users WHERE id = ANY($1)', [of('user:')]);
  await db.end();
});

describe('search_bar_drinks', () => {
  const queries = [`quokka`, `sour ${run}`, `wombat`, `numbat`, `bilby fizz ${run}`, 'x', '%', `_${run}`, '  ', `QUOKKA LOUNGE ${run}`];
  for (const who of ['reader', 'maker', 'admin']) {
    test(`gives ${who} the same rows, in the same order, as before`, async () => {
      await asUser(who, async () => {
        for (const q of queries) {
          const sql = (fn) => `SELECT t::text FROM ${fn}($1, 100) t`;
          const before = (await db.query(sql('pg_temp.old_search_bar_drinks'), [q])).rows.map((r) => r.t);
          const now = (await db.query(sql('public.search_bar_drinks'), [q])).rows.map((r) => r.t);
          assert.deepEqual(now, before, `query ${JSON.stringify(q)}`);
        }
      });
    });
  }

  test('finds drinks by name, description, credit and (for an editor) ingredient', async () => {
    await asUser('reader', async () => {
      const rows = (await db.query('SELECT item_id FROM public.search_bar_drinks($1)', [`numbat gin ${run}`])).rows;
      assert.ok(!rows.some((r) => r.item_id === uid('item:Maker Sour')), 'someone else cannot match its spec');
    });
    const found = (rows) => rows.map((r) => r.item_id);
    await asUser('maker', async () => {
      const byCredit = found((await db.query('SELECT item_id FROM public.search_bar_drinks($1)', [`quokka lounge ${run}`])).rows);
      assert.deepEqual(byCredit.sort(), [uid('item:Quokka Sour'), uid('item:Bilby Fizz')].sort());
      const byDescription = found((await db.query('SELECT item_id FROM public.search_bar_drinks($1)', ['wombat garnish'])).rows);
      assert.ok(byDescription.includes(uid('item:Quokka Sour')));
      const byIngredient = found((await db.query('SELECT item_id FROM public.search_bar_drinks($1)', [`numbat gin ${run}`])).rows);
      assert.ok(byIngredient.includes(uid('item:Maker Sour')), 'the maker edits their own drink, so its spec matches');
    });
  });
});

describe('indexes', () => {
  const plan = async (sql, params) => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL enable_seqscan = off');
      return (await db.query(`EXPLAIN ${sql}`, params)).rows.map((r) => r['QUERY PLAN']).join('\n');
    } finally {
      await db.query('ROLLBACK');
    }
  };

  test('the drinks using an ingredient come from an index', async () => {
    assert.match(await plan('SELECT recipe_item_id FROM public.recipes WHERE ingredient_item_id = $1', [uid('item:Numbat Gin')]), /recipes_ingredient_item_id_idx/);
    assert.match(await plan('SELECT recipe_item_id FROM public.recipes WHERE parent_ingredient_id = $1', [uid('item:Numbat Gin')]), /recipes_parent_ingredient_id_idx/);
  });
});

describe('job crons', () => {
  test('still hand a due job to the worker', async () => {
    // The early return only skips work when no job is waiting, ready or running.
    await db.query('BEGIN');
    try {
      await db.query("SELECT set_config('app.image_worker', 'off', true)");
      await db.query("INSERT INTO private.item_image_jobs (item_id, run_after) VALUES ($1, now() - interval '1 minute')", [uid('item:Numbat Gin')]);
      await db.query('SELECT private.run_item_image_jobs()');
      const job = await db.query('SELECT status FROM private.item_image_jobs WHERE item_id = $1', [uid('item:Numbat Gin')]);
      assert.notEqual(job.rows[0]?.status, 'pending', 'the due job was picked up');
      assert.equal(typeof (await db.query('SELECT private.run_item_flavor_jobs() n')).rows[0].n, 'number');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
