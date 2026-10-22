// Merging a copy of a drink into the one we keep
// (20261102100000_tidy_test_and_duplicate_drinks.sql, private.merge_item):
// everything that points at the copy ends up on the kept drink, the copy's
// own spec goes, and the copy is recorded in private.item_merges.
//
// Runs in one transaction that is rolled back, so it leaves nothing behind.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import pg from "pg";

const status = JSON.parse(
  execSync("supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
if (!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)/.test(status.DB_URL)) {
  throw new Error(
    `Refusing to run merge tests against a non-local database: ${status.DB_URL}`,
  );
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const count = async (sql, params = []) => Number((await one(sql, params)).n);

async function user(name) {
  return (
    await one(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
         created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
         raw_app_meta_data, raw_user_meta_data)
       VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         $1, '', now(), now(), now(), '', '', '', '', '{}', '{}') RETURNING id`,
      [`${name}-${run}@security-test.local`],
    )
  ).id;
}

before(async () => {
  await db.connect();
  await db.query("BEGIN");
  const [a, b, c] = (
    await db.query(
      `SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL ORDER BY id LIMIT 3`,
    )
  ).rows.map((r) => r.id);

  ids.page = (
    await one(
      `INSERT INTO public.profiles (kind, is_public, handle, display_name) VALUES ('bar', true, $1, $2) RETURNING id`,
      [`merge_${run}`, `Merge Bar ${run}`],
    )
  ).id;
  const name = `Merge Plane ${run}`;
  ids.keep = (
    await one(
      `INSERT INTO public.items (name, item_type, is_catalog, origin_bar_profile_id, notes)
       VALUES ($1, 'cocktail', true, $2, 'The classic''s history.') RETURNING id`,
      [name, ids.page],
    )
  ).id;
  ids.copy = (
    await one(
      `INSERT INTO public.items (name, item_type, origin_bar_profile_id, riff_of_id, notes)
       VALUES ($1, 'cocktail', $2, $3, 'The bar''s own note.') RETURNING id`,
      [name, ids.page, ids.keep],
    )
  ).id;
  ids.riff = (
    await one(
      `INSERT INTO public.items (name, item_type, riff_of_id) VALUES ($1, 'cocktail', $2) RETURNING id`,
      [`Merge Plane Riff ${run}`, ids.copy],
    )
  ).id;
  await db.query(
    `INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order)
     VALUES ($1, $3, 1, 'oz', 0), ($1, $4, 1, 'oz', 1), ($2, $3, 1, 'oz', 0), ($2, $4, 1, 'oz', 1), ($2, $5, 1, 'oz', 2)`,
    [ids.keep, ids.copy, a, b, c],
  );

  // Where the copy was served, on the page's history and on a venue's menu.
  const edition = await one(
    `INSERT INTO public.profile_menu_editions (profile_id, name, year) VALUES ($1, 'Summer', 2024) RETURNING id`,
    [ids.page],
  );
  await db.query(
    `INSERT INTO public.profile_menu_edition_drinks (edition_id, item_id, sort_order) VALUES ($1, $2, 0)`,
    [edition.id, ids.copy],
  );
  const bar = await one(
    `INSERT INTO public.bars (name, slug) VALUES ($1, $2) RETURNING id`,
    [`Merge Venue ${run}`, `merge-venue-${run}`],
  );
  ids.menu = (
    await one(
      `INSERT INTO public.menus (bar_id, name) VALUES ($1, 'Now') RETURNING id`,
      [bar.id],
    )
  ).id;
  await db.query(
    `INSERT INTO public.menu_drinks (menu_id, item_id, sort_order) VALUES ($1, $2, 0)`,
    [ids.menu, ids.copy],
  );

  // One person ranked only the copy; another ranked both.
  ids.onlyCopy = await user("only-copy");
  ids.both = await user("both");
  await db.query(
    `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, sentiment, rank_key)
     VALUES ($1, $3, $3, 'loved', 1), ($2, $3, $3, 'loved', 1), ($2, $4, $4, 'loved', 2)`,
    [ids.onlyCopy, ids.both, ids.copy, ids.keep],
  );

  await db.query(
    `INSERT INTO public.profile_picks (profile_id, section, target_id, shown) VALUES ($1, 'originals', $2, true)`,
    [ids.page, ids.copy],
  );
  await db.query(
    `INSERT INTO private.share_slugs (kind, slug, item_id) VALUES ('d', $1, $2)`,
    [`merge-plane-${run}`, ids.copy],
  );

  await db.query("SELECT private.merge_item($1, $2)", [ids.copy, ids.keep]);
});

after(async () => {
  await db.query("ROLLBACK");
  await db.end();
});

describe("merge_item", () => {
  test("the copy is gone and recorded with its spec", async () => {
    assert.equal(
      await count("SELECT count(*) n FROM public.items WHERE id = $1", [
        ids.copy,
      ]),
      0,
    );
    const merge = await one(
      "SELECT into_id, snapshot FROM private.item_merges WHERE from_id = $1",
      [ids.copy],
    );
    assert.equal(merge.into_id, ids.keep);
    assert.equal(merge.snapshot.item.id, ids.copy);
    assert.equal(merge.snapshot.recipes.length, 3);
  });

  test("the kept drink keeps its own spec and is not a riff of itself", async () => {
    assert.equal(
      await count(
        "SELECT count(*) n FROM public.recipes WHERE recipe_item_id = $1",
        [ids.keep],
      ),
      2,
    );
    const keep = await one(
      "SELECT riff_of_id, notes FROM public.items WHERE id = $1",
      [ids.keep],
    );
    assert.equal(keep.riff_of_id, null);
    assert.equal(keep.notes, "The classic's history.");
    assert.equal(
      await count(
        "SELECT count(*) n FROM public.credited_drink_notes WHERE item_id = $1",
        [ids.keep],
      ),
      0,
    );
  });

  test("riffs, menus and menu history move to the kept drink", async () => {
    assert.equal(
      (
        await one("SELECT riff_of_id FROM public.items WHERE id = $1", [
          ids.riff,
        ])
      ).riff_of_id,
      ids.keep,
    );
    assert.equal(
      await count(
        "SELECT count(*) n FROM public.profile_menu_edition_drinks WHERE item_id = $1",
        [ids.keep],
      ),
      1,
    );
    assert.equal(
      await count(
        "SELECT count(*) n FROM public.menu_drinks WHERE menu_id = $1 AND item_id = $2",
        [ids.menu, ids.keep],
      ),
      1,
    );
  });

  test("rankings move, and someone who ranked both keeps one", async () => {
    const rows = (
      await db.query(
        "SELECT user_id, item_id, ranked_as_item_id FROM public.rank_entries WHERE user_id = ANY($1)",
        [[ids.onlyCopy, ids.both]],
      )
    ).rows;
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.item_id, ids.keep);
      assert.equal(r.ranked_as_item_id, ids.keep);
    }
  });

  test("picks and the readable link follow the kept drink", async () => {
    assert.equal(
      await count(
        "SELECT count(*) n FROM public.profile_picks WHERE target_id = $1",
        [ids.keep],
      ),
      1,
    );
    assert.equal(
      (
        await one("SELECT item_id FROM private.share_slugs WHERE slug = $1", [
          `merge-plane-${run}`,
        ])
      ).item_id,
      ids.keep,
    );
  });

  test("refuses ingredients and items of different kinds", async () => {
    const ing = await one(
      `SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL LIMIT 1`,
    );
    for (const [from, into] of [
      [ing.id, ids.keep],
      [ids.riff, ids.riff],
    ]) {
      await db.query("SAVEPOINT refused");
      await assert.rejects(
        db.query("SELECT private.merge_item($1, $2)", [from, into]),
      );
      await db.query("ROLLBACK TO SAVEPOINT refused");
    }
  });
});
