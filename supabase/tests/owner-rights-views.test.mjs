// The two public views that run with owner rights, published_items and
// app_recipe_presentation, are where "outsiders don't see the spec" is
// decided (the 22 Oct 2026 audit, 4.4). They have to run as their owner: they
// read private.published_listing and rows the caller's own policies hide, and
// hand back only what an outsider may see. That makes every column they gain
// a question of what it shows to whom, so this pins them:
//
//   * no other public view runs with owner rights
//   * each view's columns are exactly the reviewed list below; a new column
//     fails here until someone checks what it shows outsiders, adds a test
//     for that, and adds it to the list
//   * signed-out and signed-in callers can only read them
//   * for a signed-out visitor and for someone signed in who isn't on the
//     team: a drink published with its spec shows with its lines, one
//     published as a menu drink shows without them, a private one not at all
//
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)/.test(status.DB_URL)) {
  throw new Error(`Refusing to run view tests against a non-local database: ${status.DB_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });

// The reviewed columns, in order. Add one only with a test of what it shows outsiders.
const COLUMNS = {
  published_items: [
    'id', 'name', 'item_type', 'description', 'bar_id', 'glassware_id', 'ice_id', 'family_id', 'origin', 'abv',
    'icon_key', 'icon_url', 'publish_mode', 'published_at', 'riff_of_id', 'creator_profile_id', 'origin_bar_profile_id',
    'origin_year', 'credit_status', 'is_reference', 'image_url', 'image_is_generated', 'is_shared',
  ],
  app_recipe_presentation: [
    'id', 'created_at', 'recipe_item_id', 'display_ingredient_id', 'amount', 'unit', 'preparation_notes', 'is_optional',
    'parent_ingredient_id', 'ingredient_item_id', 'sort_order', 'at_service',
  ],
};
const OWNER_RIGHTS = Object.keys(COLUMNS);

/** Runs fn inside a transaction that is always rolled back. */
async function rolledBack(fn) {
  await db.query('BEGIN');
  try {
    return await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}

before(() => db.connect());
after(() => db.end());

describe('views that run with owner rights', () => {
  test('only these two public views run with owner rights', async () => {
    const { rows } = await db.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
         AND NOT coalesce('security_invoker=true' = ANY (c.reloptions) OR 'security_invoker=on' = ANY (c.reloptions), false)
       ORDER BY 1`);
    assert.deepEqual(rows.map((r) => r.relname), [...OWNER_RIGHTS].sort(), 'a new public view runs as the caller (security_invoker = true)');
  });

  for (const [view, columns] of Object.entries(COLUMNS)) {
    test(`${view} has exactly the reviewed columns`, async () => {
      const { rows } = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [view]
      );
      assert.deepEqual(rows.map((r) => r.column_name), columns, `${view} changed: check what each new column shows outsiders, test it, then list it here`);
    });

    test(`${view} can only be read by signed-out and signed-in callers`, async () => {
      const { rows } = await db.query(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = $1 AND grantee IN ('anon', 'authenticated', 'PUBLIC')
          ORDER BY 1, 2`,
        [view]
      );
      assert.deepEqual(rows, [
        { grantee: 'anon', privilege_type: 'SELECT' },
        { grantee: 'authenticated', privilege_type: 'SELECT' },
      ]);
    });
  }

  test('outsiders see a published drink, the spec only when it is published with it, and nothing of a private one', async () => {
    const run = randomUUID().slice(0, 8);
    const outsider = randomUUID();
    const seen = await rolledBack(async () => {
      const one = async (sql, params) => (await db.query(sql, params)).rows[0].id;
      const bar = await one("INSERT INTO public.bars (name, page_visibility) VALUES ($1, 'open') RETURNING id", [`Owner Rights Bar ${run}`]);
      await db.query("INSERT INTO public.profiles (kind, handle, display_name, bar_id, is_public) VALUES ('bar', $1, $2, $3, true)", [`ownerrights${run}`, `Owner Rights Bar ${run}`, bar]);
      const gin = await one("INSERT INTO public.items (name, item_type) VALUES ($1, 'ingredient') RETURNING id", [`Owner Rights Gin ${run}`]);
      const drinks = {};
      for (const mode of ['spec', 'description', 'private']) {
        drinks[mode] = await one("INSERT INTO public.items (name, item_type, bar_id, publish_mode) VALUES ($1, 'cocktail', $2, $3) RETURNING id", [`Owner Rights ${mode} ${run}`, bar, mode]);
        await db.query("INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit) VALUES ($1, $2, 45, 'ml')", [drinks[mode], gin]);
      }
      const look = async () => {
        const out = {};
        for (const [mode, id] of Object.entries(drinks)) {
          const listed = (await db.query('SELECT publish_mode FROM public.published_items WHERE id = $1', [id])).rows[0]?.publish_mode ?? null;
          const lines = (await db.query('SELECT amount, unit FROM public.app_recipe_presentation WHERE recipe_item_id = $1', [id])).rows;
          out[mode] = { listed, lines: lines.map((l) => `${Number(l.amount)} ${l.unit}`) };
        }
        return out;
      };
      await db.query('SET LOCAL ROLE anon');
      const anon = await look();
      await db.query('RESET ROLE');
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: outsider, role: 'authenticated' })]);
      await db.query('SET LOCAL ROLE authenticated');
      const signedIn = await look();
      return { anon, signedIn };
    });
    const expected = {
      spec: { listed: 'spec', lines: ['45 ml'] },
      description: { listed: 'description', lines: [] },
      private: { listed: null, lines: [] },
    };
    assert.deepEqual(seen, { anon: expected, signedIn: expected });
  });
});
