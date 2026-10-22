// Merging a copy of a drink into the one we keep
// (20261102100000_tidy_test_and_duplicate_drinks.sql, private.merge_item):
// everything that points at the copy ends up on the kept drink, the copy's
// own spec goes, and the copy is recorded in private.item_merges. Also runs
// the migration's test-drink step on stand-ins with its ids.
//
// Runs in one transaction that is rolled back, so it leaves nothing behind.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

  // The copy was made by a bring-in: Undo deletes what its list names.
  ids.batch = (
    await one(
      `INSERT INTO public.bring_in_batches (user_id, source, title, item_ids) VALUES ($1, 'a link', 'Merge test', ARRAY[$2]::uuid[]) RETURNING id`,
      [ids.onlyCopy, ids.copy],
    )
  ).id;

  // What hangs off the copy's ranking for someone who ranked both.
  const entry = async (item) =>
    (
      await one(
        "SELECT id FROM public.rank_entries WHERE user_id = $1 AND item_id = $2",
        [ids.both, item],
      )
    ).id;
  ids.copyEntry = await entry(ids.copy);
  ids.keepEntry = await entry(ids.keep);
  ids.otherEntry = (
    await one(
      `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, sentiment, rank_key)
       VALUES ($1, $2, $2, 'fine', 3) RETURNING id`,
      [ids.both, ids.riff],
    )
  ).id;
  ids.comparison = (
    await one(
      `INSERT INTO public.rank_comparisons (user_id, winner_entry_id, loser_entry_id) VALUES ($1, $2, $3) RETURNING id`,
      [ids.both, ids.copyEntry, ids.otherEntry],
    )
  ).id;
  ids.selfComparison = (
    await one(
      `INSERT INTO public.rank_comparisons (user_id, winner_entry_id, loser_entry_id) VALUES ($1, $2, $3) RETURNING id`,
      [ids.both, ids.copyEntry, ids.keepEntry],
    )
  ).id;
  const image = await one(
    `INSERT INTO public.images (url) VALUES ($1) RETURNING id`,
    [`https://example.test/${run}/photo.jpg`],
  );
  ids.photo = (
    await one(
      `INSERT INTO public.drink_photos (item_id, user_id, image_id, rank_entry_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [ids.copy, ids.both, image.id, ids.copyEntry],
    )
  ).id;
  // The copy's ranking was pinned to their profile; the classic's wasn't shown.
  await db.query(
    "UPDATE public.rank_entries SET on_profile = (id = $1), profile_pin = CASE WHEN id = $1 THEN 1 END WHERE id = ANY($2)",
    [ids.copyEntry, [ids.copyEntry, ids.keepEntry]],
  );
  ids.made = (
    await one(
      `INSERT INTO public.made_drinks (user_id, item_id, rank_entry_id) VALUES ($1, $2, $3) RETURNING id`,
      [ids.both, ids.copy, ids.copyEntry],
    )
  ).id;

  await db.query("SELECT private.merge_item($1, $2)", [ids.copy, ids.keep]);

  // A second pair where both are bar-credited, and the kept one was linked
  // to the copy as its riff.
  ids.keep2 = (
    await one(
      `INSERT INTO public.items (name, item_type, origin_bar_profile_id) VALUES ($1, 'cocktail', $2) RETURNING id`,
      [`Merge Two ${run}`, ids.page],
    )
  ).id;
  ids.copy2 = (
    await one(
      `INSERT INTO public.items (name, item_type, origin_bar_profile_id, notes) VALUES ($1, 'cocktail', $2, 'The copy''s bar note.') RETURNING id`,
      [`Merge Two ${run}`, ids.page],
    )
  ).id;
  await db.query("UPDATE public.items SET riff_of_id = $2 WHERE id = $1", [
    ids.keep2,
    ids.copy2,
  ]);
  // Both have a readable link: the copy's clashes and is kept in the record.
  await db.query(
    `INSERT INTO private.share_slugs (kind, slug, item_id) VALUES ('d', $1, $2), ('d', $3, $4)`,
    [`merge-two-${run}`, ids.keep2, `merge-two-copy-${run}`, ids.copy2],
  );
  await db.query("SELECT private.merge_item($1, $2)", [ids.copy2, ids.keep2]);

  // The test-drink step of the migration, on stand-ins with its ids.
  ids.cottage = "532e5250-161e-4439-b8d1-9dd4b403ef19";
  ids.test = "cc7e22e2-907e-4aa1-bc05-a1be451cb9a9";
  ids.testStuff = "5ec3ebce-0d1f-4523-a784-ae50103f0db0";
  ids.testHi = "89a0d3d5-daaa-4d06-9789-0e374e376547";
  await db.query(
    `INSERT INTO public.bars (id, name, slug) VALUES ($1, 'Cottage stand-in', $2) ON CONFLICT (id) DO NOTHING`,
    [ids.cottage, `cottage-${run}`],
  );
  await db.query(
    `INSERT INTO public.items (id, name, item_type, bar_id) VALUES ($1, 'Test', 'cocktail', $4), ($2, 'Testing stuff', 'cocktail', $4), ($3, 'Testing hi', 'cocktail', $4)
     ON CONFLICT (id) DO NOTHING`,
    [ids.test, ids.testStuff, ids.testHi, ids.cottage],
  );
  // Worked out from the drink: goes with it.
  await db.query(
    `INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 1, 'oz', 0)`,
    [ids.test, a],
  );
  // Real things pointing at the other two: they stay.
  await db.query(
    `INSERT INTO public.collected_items (user_id, item_id) VALUES ($1, $2)`,
    [ids.onlyCopy, ids.testStuff],
  );
  await db.query(
    `INSERT INTO public.bring_in_batches (user_id, source, title, item_ids) VALUES ($1, 'a link', 'Test drinks', ARRAY[$2]::uuid[])`,
    [ids.onlyCopy, ids.testHi],
  );
  const migration = readFileSync(
    new URL(
      "../migrations/20261102100000_tidy_test_and_duplicate_drinks.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const step = migration.slice(
    migration.indexOf("-- --- 1. The test drinks ---"),
    migration.indexOf("-- --- 2 and 3. Duplicates ---"),
  );
  assert.ok(step.length > 100, "the test-drink step is in the migration");
  await db.query(step);
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
        "SELECT user_id, item_id, ranked_as_item_id FROM public.rank_entries WHERE user_id = ANY($1) AND item_id <> $2",
        [[ids.onlyCopy, ids.both], ids.riff],
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

  test("someone who ranked both keeps what hung off the copy's ranking", async () => {
    assert.equal(
      await count("SELECT count(*) n FROM public.rank_entries WHERE id = $1", [
        ids.copyEntry,
      ]),
      0,
    );
    const moved = await one(
      "SELECT winner_entry_id, loser_entry_id FROM public.rank_comparisons WHERE id = $1",
      [ids.comparison],
    );
    assert.equal(moved.winner_entry_id, ids.keepEntry);
    assert.equal(moved.loser_entry_id, ids.otherEntry);
    // Copy against classic is the same drink now: that one goes.
    assert.equal(
      await count("SELECT count(*) n FROM public.rank_comparisons WHERE id = $1", [
        ids.selfComparison,
      ]),
      0,
    );
    const photo = await one(
      "SELECT item_id, rank_entry_id FROM public.drink_photos WHERE id = $1",
      [ids.photo],
    );
    assert.equal(photo.item_id, ids.keep);
    assert.equal(photo.rank_entry_id, ids.keepEntry);
    const made = await one(
      "SELECT item_id, rank_entry_id FROM public.made_drinks WHERE id = $1",
      [ids.made],
    );
    assert.equal(made.item_id, ids.keep);
    assert.equal(made.rank_entry_id, ids.keepEntry);
    const kept = await one(
      "SELECT on_profile, profile_pin FROM public.rank_entries WHERE id = $1",
      [ids.keepEntry],
    );
    assert.deepEqual(kept, { on_profile: true, profile_pin: 1 });
  });

  test("a bring-in's undo list drops the copy and never gains the kept drink", async () => {
    const batch = await one(
      "SELECT item_ids FROM public.bring_in_batches WHERE id = $1",
      [ids.batch],
    );
    assert.deepEqual(batch.item_ids, []);
  });

  test("the kept drink survives a link to the copy on itself", async () => {
    const keep2 = await one(
      "SELECT id, riff_of_id FROM public.items WHERE id = $1",
      [ids.keep2],
    );
    assert.equal(keep2?.id, ids.keep2);
    assert.equal(keep2.riff_of_id, null);
    const merge = await one(
      "SELECT into_id FROM private.item_merges WHERE from_id = $1",
      [ids.copy2],
    );
    assert.equal(merge.into_id, ids.keep2);
  });

  test("a row that clashes with the kept drink's is kept in the merge record", async () => {
    const merge = await one(
      "SELECT snapshot FROM private.item_merges WHERE from_id = $1",
      [ids.copy2],
    );
    assert.deepEqual(
      merge.snapshot.dropped.map((d) => [d.table, d.row.slug]),
      [["private.share_slugs", `merge-two-copy-${run}`]],
    );
    assert.equal(
      (
        await one("SELECT item_id FROM private.share_slugs WHERE slug = $1", [
          `merge-two-${run}`,
        ])
      ).item_id,
      ids.keep2,
    );
  });

  test("a bar-credited copy's notes follow onto a bar-credited drink", async () => {
    const note = await one(
      "SELECT notes FROM public.credited_drink_notes WHERE item_id = $1",
      [ids.keep2],
    );
    assert.equal(note?.notes, "The copy's bar note.");
  });

  test("the merge record outlives the kept drink", async () => {
    await db.query("SAVEPOINT gone");
    await db.query("DELETE FROM public.items WHERE id = $1", [ids.keep2]);
    const merge = await one(
      "SELECT into_id, snapshot FROM private.item_merges WHERE from_id = $1",
      [ids.copy2],
    );
    assert.equal(merge.into_id, null);
    assert.equal(merge.snapshot.item.id, ids.copy2);
    await db.query("ROLLBACK TO SAVEPOINT gone");
  });

  test("a test drink goes only while nothing real points at it", async () => {
    const left = (
      await db.query("SELECT id FROM public.items WHERE id = ANY($1)", [
        [ids.test, ids.testStuff, ids.testHi],
      ])
    ).rows.map((r) => r.id);
    assert.ok(!left.includes(ids.test), "the clean test drink is deleted");
    assert.ok(left.includes(ids.testStuff), "a collected one stays");
    assert.ok(left.includes(ids.testHi), "one a bring-in names stays");
  });

  test("refuses ingredients, different kinds, different venues and the same item", async () => {
    const ing = await one(
      `SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL LIMIT 1`,
    );
    const method = await one(
      `INSERT INTO public.items (name, item_type) VALUES ($1, 'method') RETURNING id`,
      [`Merge Method ${run}`],
    );
    const venueDrink = await one(
      `INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'cocktail', (SELECT bar_id FROM public.menus WHERE id = $2)) RETURNING id`,
      [`Merge Plane ${run}`, ids.menu],
    );
    for (const [from, into, message] of [
      [ing.id, ids.keep, /same kind/],
      [method.id, ids.keep, /same kind/],
      [venueDrink.id, ids.keep, /same venue/],
      [ids.riff, ids.riff, /two different/],
    ]) {
      await db.query("SAVEPOINT refused");
      await assert.rejects(
        db.query("SELECT private.merge_item($1, $2)", [from, into]),
        message,
      );
      await db.query("ROLLBACK TO SAVEPOINT refused");
    }
  });
});
