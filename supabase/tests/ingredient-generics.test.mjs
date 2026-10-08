// Generic ingredients on the ingredient itself (20260930960000_ingredient_generics.sql):
// a line whose ingredient has a generic is masked to that generic, the flavor
// rules see it, only ingredients can have one, and the backfill is safe to
// run twice.
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

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run generic ingredient tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20260930960000_ingredient_generics.sql', import.meta.url);
const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const users = {};

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data;
}

async function signedIn(email) {
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

before(async () => {
  await db.connect();
  // A bar with the column defaults: generic ingredients from level 20, brands from 30.
  ids.bar = (await serviceInsert('bars', { name: `Generics ${run}`, slug: `generics-${run}` })).id;
  users.employee = await signedIn(`employee-${run}@security-test.local`);
  users.bartender = await signedIn(`bartender-${run}@security-test.local`);
  const { error } = await service.from('user_bars').insert([
    { user_id: users.employee.id, bar_id: ids.bar, role_level: 20 },
    { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 },
  ]);
  if (error) throw error;
  ids.generic = (await serviceInsert('items', { name: `Gin ${run}`, item_type: 'ingredient' })).id;
  ids.brand = (await serviceInsert('items', { name: `Tanqueray ${run}`, item_type: 'ingredient', generic_id: ids.generic })).id;
  ids.drink = (await serviceInsert('items', { name: `Martini ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  // The line names the brand only; the generic comes from the ingredient.
  ids.line = (await serviceInsert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.brand, amount: 60, unit: 'ml', sort_order: 0 })).id;
});

after(async () => {
  await service.from('items').delete().in('id', [ids.drink, ids.brand, ids.generic].filter(Boolean));
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('generic ingredients', () => {
  test("an employee sees the brand's generic, a bartender the brand", async () => {
    const read = async (client) => {
      const { data, error } = await client
        .from('app_recipe_presentation')
        .select('display_ingredient_id, ingredient_item_id, parent_ingredient_id')
        .eq('id', ids.line)
        .single();
      assert.ifError(error);
      return data;
    };
    assert.deepEqual(await read(users.employee.client), { display_ingredient_id: ids.generic, ingredient_item_id: null, parent_ingredient_id: ids.generic });
    assert.deepEqual(await read(users.bartender.client), { display_ingredient_id: ids.brand, ingredient_item_id: ids.brand, parent_ingredient_id: ids.generic });
  });

  test("the line's own parent still wins over the ingredient's generic", async () => {
    const other = await serviceInsert('items', { name: `Old Tom Gin ${run}`, item_type: 'ingredient' });
    try {
      await db.query('UPDATE public.recipes SET parent_ingredient_id = $1 WHERE id = $2', [other.id, ids.line]);
      const { data } = await users.employee.client.from('app_recipe_presentation').select('display_ingredient_id').eq('id', ids.line).single();
      assert.equal(data.display_ingredient_id, other.id);
    } finally {
      await db.query('UPDATE public.recipes SET parent_ingredient_id = NULL WHERE id = $1', [ids.line]);
      await service.from('items').delete().eq('id', other.id);
    }
  });

  test('the flavor rules read the generic name, and changing it re-queues the drink', async () => {
    const { rows } = await db.query('SELECT public.get_item_flavor_spec($1) AS spec', [ids.drink]);
    assert.equal(rows[0].spec[0].genericName, `Gin ${run}`);
    const { rows: fp1 } = await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [ids.drink]);
    await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = $1', [ids.drink]);
    await db.query('UPDATE public.items SET generic_id = NULL WHERE id = $1', [ids.brand]);
    const { rows: fp2 } = await db.query('SELECT private.item_flavor_fingerprint($1) AS fp', [ids.drink]);
    assert.notEqual(fp1[0].fp, fp2[0].fp);
    const { rows: jobs } = await db.query('SELECT 1 FROM private.item_flavor_jobs WHERE item_id = $1', [ids.drink]);
    assert.equal(jobs.length, 1, 'the drink was queued');
    await db.query('UPDATE public.items SET generic_id = $1 WHERE id = $2', [ids.generic, ids.brand]);
  });

  test('only an ingredient can have a generic, and it must be an ingredient', async () => {
    await assert.rejects(db.query('UPDATE public.items SET generic_id = $1 WHERE id = $2', [ids.generic, ids.drink]), /Only an ingredient/);
    await assert.rejects(db.query('UPDATE public.items SET generic_id = $1 WHERE id = $2', [ids.drink, ids.brand]), /must be an ingredient/);
    await assert.rejects(db.query('UPDATE public.items SET generic_id = $1 WHERE id = $1', [ids.brand]), /items_generic_not_self/);
  });

  test('the shared bottles got their generics, and categories where the catalog has them', async () => {
    const { rows } = await db.query(`
      SELECT lower(i.name) AS name, g.name AS generic, c.name AS category
      FROM public.items i
      LEFT JOIN public.items g ON g.id = i.generic_id
      LEFT JOIN public.item_categories ic ON ic.item_id = i.id
      LEFT JOIN public.categories c ON c.id = ic.category_id
      WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) IN ('campari', 'gin', 'sweet vermouth', 'dry vermouth', 'angostura bitters')`);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    assert.equal(byName['sweet vermouth']?.generic, 'Vermouth');
    assert.equal(byName['dry vermouth']?.generic, 'Vermouth');
    assert.equal(byName['angostura bitters']?.generic, 'Aromatic Bitters');
    assert.equal(byName.gin?.generic, null, 'a generic has no generic');
    // The spirit categories are production data; the local seed has none.
    const { rows: cats } = await db.query(`SELECT count(*)::int AS n FROM public.categories WHERE domain = 'spirit'`);
    if (cats[0].n) {
      assert.equal(byName.campari?.category, 'Aperitivo (Red Bitter)');
      assert.equal(byName.gin?.category, 'Gin');
    }
    // Counted against the backfill's own list. A share of every shared
    // ingredient falls each time a seed adds bottles the list doesn't name.
    const listed = [...readFileSync(MIGRATION, 'utf8').split('INSERT INTO "known_ingredients" VALUES')[1].split(';')[0]
      .matchAll(/\('((?:[^']|'')+)', '(?:[^']|'')+', /g)].map((m) => m[1].replaceAll("''", "'").toLowerCase());
    const { rows: counts } = await db.query(
      `SELECT count(*) FILTER (WHERE generic_id IS NOT NULL)::int AS with_generic, count(*)::int AS n
       FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL AND lower(name) = ANY($1)`,
      [listed]
    );
    assert.ok(counts[0].n > 0 && counts[0].with_generic === counts[0].n, `expected every listed bottle filled in, got ${counts[0].with_generic} of ${counts[0].n}`);
  });

  test('running the backfill again changes nothing', async () => {
    const backfill = readFileSync(MIGRATION, 'utf8').split('-- The shared bottles')[1].replace(/^-{10,}\n/, '');
    // Other test files' fixtures are named with a run id and left out: one
    // committed before the lock (a brand whose line names a parent, say in
    // allergens or role-scoped-reads) is a fair first fill, not a second one.
    const count = async () =>
      (
        await db.query(`WITH i AS (SELECT * FROM public.items WHERE name !~ ' [0-9a-f]{8}$')
                        SELECT (SELECT count(*) FROM i)::int AS items,
                               (SELECT count(*) FROM i WHERE generic_id IS NOT NULL)::int AS generics,
                               (SELECT count(*) FROM public.item_categories c JOIN i ON i.id = c.item_id)::int AS categories`)
      ).rows[0];
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.items, public.recipes, public.item_categories IN SHARE ROW EXCLUSIVE MODE');
        const before = await count();
        await db.query(backfill);
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
