// Signature drinks and the classics' specs (20260930910000_signature_drinks.sql):
// credited to their bar, readable with their specs by anyone signed in, and
// safe to run twice.
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
  throw new Error(`Refusing to run signature drink tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = new URL('../migrations/20260930910000_signature_drinks.sql', import.meta.url);
const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
let user;

before(async () => {
  await db.connect();
  const email = `drinker-${run}@security-test.local`;
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

describe('signature drinks', () => {
  test('are shared drinks credited to a bar profile, with no sketches queued', async () => {
    const { rows } = await db.query(`
      SELECT count(*)::int AS n,
             count(*) FILTER (WHERE i.bar_id IS NOT NULL OR i.is_catalog)::int AS wrong,
             count(*) FILTER (WHERE j.item_id IS NOT NULL)::int AS sketches
      FROM public.items i
      JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
      LEFT JOIN private.item_image_jobs j ON j.item_id = i.id
      WHERE i.item_type = 'cocktail' AND i.name !~ ' [0-9a-f]{8}$' -- other test files' fixtures, named with a run id`);
    assert.ok(rows[0].n >= 100, `expected the seeded drinks, found ${rows[0].n}`);
    assert.equal(rows[0].wrong, 0);
    assert.equal(rows[0].sketches, 0);
  });

  test('every classic in the catalog has a description, its story and a spec', async () => {
    const { rows } = await db.query(`
      SELECT i.name FROM public.items i
      WHERE i.is_catalog AND i.name !~ ' [0-9a-f]{8}$' -- other test files' fixtures, named with a run id
        AND (i.description IS NULL OR i.notes IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = i.id))`);
    assert.deepEqual(rows.map((r) => r.name), []);
  });

  test("a signed-in person reads a bar's drink with its spec, and signed out sees no spec", async () => {
    const { rows } = await db.query(`
      SELECT i.id FROM public.items i
      JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.handle = 'superbuenonyc'
      WHERE lower(i.name) = 'green mango martini'`);
    assert.equal(rows.length, 1, 'Superbueno has one Green Mango Martini');
    const id = rows[0].id;

    const { data, error } = await user.client
      .from('app_recipe_presentation')
      .select('amount, unit, display_ingredient_id')
      .eq('recipe_item_id', id);
    assert.ifError(error);
    assert.ok(data.length >= 3);
    assert.ok(data.every((r) => r.display_ingredient_id));

    const { data: signedOut } = await anon.from('recipes').select('id').eq('recipe_item_id', id);
    assert.deepEqual(signedOut ?? [], []);
  });

  test('running it again adds nothing', async () => {
    const count = async () =>
      (
        await db.query(`SELECT (SELECT count(*) FROM public.items)::int AS items,
                               (SELECT count(*) FROM public.recipes)::int AS recipes,
                               (SELECT count(*) FROM public.item_methods)::int AS methods`)
      ).rows[0];
    // Retried because holding these tables can deadlock with another test
    // file's open transaction; Postgres then cancels one side.
    for (let attempt = 1; ; attempt++) {
      await db.query('BEGIN');
      try {
        // Other test files write to these tables at the same time; hold them
        // still so the counts only see this run.
        await db.query("SET LOCAL lock_timeout = '10s'");
        await db.query('LOCK TABLE public.profiles, public.profile_awards, public.items, public.recipes, public.item_methods IN SHARE MODE');
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
