// Tables and functions nothing used are gone, and old drafts are swept nightly
// (supabase/migrations/20261102300000_drop_dead_tables.sql).
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error('Refusing to run clean-up tests against a non-local database');
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe('dropped', () => {
  test('the four old tables, their enum and the retired sketch links', async () => {
    const { rows } = await db.query(
      `SELECT to_regclass('public.attributes') AS a, to_regclass('public.category_attributes') AS ca,
              to_regclass('public.item_attributes') AS ia, to_regclass('public.substitutions') AS s,
              to_regclass('private.retired_drink_sketches') AS r, to_regtype('public.attribute_type_enum') AS e`
    );
    assert.deepEqual(rows[0], { a: null, ca: null, ia: null, s: null, r: null, e: null });
  });

  test('the three functions with no caller, but not merge_ingredients or confirm_item_photos', async () => {
    const { rows } = await db.query(
      `SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
       AND proname IN ('assign_item_to_bar', 'confirm_item_photos', 'flavor_for_you', 'get_my_bars', 'merge_ingredients')
       ORDER BY proname`
    );
    assert.deepEqual(rows.map((r) => r.proname), ['confirm_item_photos', 'merge_ingredients']);
  });
});

describe('old drafts', () => {
  test('a nightly job deletes drafts unsaved for 60 days and keeps newer ones', async () => {
    const { rows: jobs } = await db.query("SELECT schedule, command FROM cron.job WHERE jobname = 'sweep-old-drafts'");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].schedule, '53 3 * * *');

    await db.query('BEGIN');
    try {
      const { rows: users } = await db.query(
        `INSERT INTO auth.users (id, email, aud, role) VALUES (gen_random_uuid(), $1, 'authenticated', 'authenticated') RETURNING id`,
        [`drafts-${run}@security-test.local`]
      );
      // Saves stamp updated_at with the server's clock, so age the rows with the trigger off.
      await db.query('ALTER TABLE public.drafts DISABLE TRIGGER drafts_updated_at');
      const draft = async (days) =>
        (await db.query(
          `INSERT INTO public.drafts (user_id, entity_type, draft_data, updated_at)
           VALUES ($1, 'cocktail', '{}', now() - make_interval(days => $2)) RETURNING id`,
          [users[0].id, days]
        )).rows[0].id;
      const stale = await draft(61);
      const recent = await draft(59);
      await db.query('ALTER TABLE public.drafts ENABLE TRIGGER drafts_updated_at');

      await db.query(jobs[0].command);

      const { rows } = await db.query('SELECT id FROM public.drafts WHERE id = ANY($1)', [[stale, recent]]);
      assert.deepEqual(rows.map((r) => r.id), [recent]);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test("a save stamps updated_at with the server's clock, not the phone's", async () => {
    await db.query('BEGIN');
    try {
      const { rows: users } = await db.query(
        `INSERT INTO auth.users (id, email, aud, role) VALUES (gen_random_uuid(), $1, 'authenticated', 'authenticated') RETURNING id`,
        [`drafts-clock-${run}@security-test.local`]
      );
      const behind = "now() - interval '90 days'";
      const { rows: inserted } = await db.query(
        `INSERT INTO public.drafts (user_id, entity_type, draft_data, updated_at)
         VALUES ($1, 'cocktail', '{}', ${behind}) RETURNING id, updated_at > now() - interval '1 minute' AS fresh`,
        [users[0].id]
      );
      assert.equal(inserted[0].fresh, true, 'insert');
      const { rows: updated } = await db.query(
        `UPDATE public.drafts SET draft_data = '{"name":"x"}', updated_at = ${behind} WHERE id = $1
         RETURNING updated_at > now() - interval '1 minute' AS fresh`,
        [inserted[0].id]
      );
      assert.equal(updated[0].fresh, true, 'update');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
