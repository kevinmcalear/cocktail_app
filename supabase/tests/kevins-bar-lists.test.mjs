// Bars from Kevin's Google Maps lists (20261009100000_kevins_bar_lists.sql):
// every seeded bar is a public, unclaimed profile on the map, menus only hold
// their own bar's drinks, no drink queued a paid flavour job, signed-out
// visitors see the bars and their people, and running the seed again adds
// nothing.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const status = JSON.parse(
  execSync("supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(
    `Refusing to run bar-list seed tests against a non-local API: ${status.API_URL}`,
  );
}

const MIGRATION = new URL(
  "../migrations/20261009100000_kevins_bar_lists.sql",
  import.meta.url,
);
const SQL = readFileSync(MIGRATION, "utf8");
// The seeded handles: the first column of the mb_bars rows.
const HANDLES = [
  ...SQL.split('INSERT INTO "mb_bars" VALUES')[1]
    .split(";\n")[0]
    .matchAll(/^ {4}\('([a-z0-9._]+)'/gm),
].map((m) => m[1]);
const anon = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe("Kevin's bar lists", () => {
  test("the seed names hundreds of bars, once each", () => {
    assert.ok(HANDLES.length > 500, `only ${HANDLES.length} handles`);
    assert.equal(new Set(HANDLES).size, HANDLES.length);
  });

  test("every seeded bar is a public, unclaimed bar on the map", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE is_public AND NOT is_claimed AND latitude IS NOT NULL
                               AND page_visibility = 'description')::int AS ok
       FROM public.profiles WHERE kind = 'bar' AND handle = ANY($1)`,
      [HANDLES],
    );
    // A bar already here under the same name nearby is left alone, so a few
    // handles can be missing; none may be half-made.
    assert.ok(
      rows[0].n > HANDLES.length * 0.9,
      `${rows[0].n} of ${HANDLES.length} bars`,
    );
    assert.equal(rows[0].ok, rows[0].n);
  });

  test("menus hold only their own bar's drinks, and no drink queued a flavour job", async () => {
    const { rows } = await db.query(
      `SELECT count(*) FILTER (WHERE i.origin_bar_profile_id <> e.profile_id)::int AS foreign_drinks,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM private.item_flavor_jobs j WHERE j.item_id = i.id))::int AS jobs
       FROM public.profile_menu_edition_drinks d
       JOIN public.profile_menu_editions e ON e.id = d.edition_id
       JOIN public.profiles p ON p.id = e.profile_id
       JOIN public.items i ON i.id = d.item_id
       WHERE p.handle = ANY($1)`,
      [HANDLES],
    );
    assert.deepEqual(rows[0], { foreign_drinks: 0, jobs: 0 });
  });

  test("closed bars say so with a sensible year", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS closed,
              count(*) FILTER (WHERE closed_year IS NOT NULL AND closed_year NOT BETWEEN 1990 AND 2026)::int AS bad_year
       FROM public.profiles WHERE kind = 'bar' AND handle = ANY($1) AND is_closed`,
      [HANDLES],
    );
    assert.ok(rows[0].closed > 0);
    assert.equal(rows[0].bad_year, 0);
  });

  test("signed out, anyone sees a seeded bar and its people", async () => {
    const { rows } = await db.query(
      `SELECT b.id FROM public.profiles b
       WHERE b.handle = ANY($1) AND EXISTS (SELECT 1 FROM public.profile_positions pp WHERE pp.bar_profile_id = b.id)
       ORDER BY b.handle LIMIT 1`,
      [HANDLES],
    );
    const { data: bar, error } = await anon
      .from("profiles")
      .select("id, display_name")
      .eq("id", rows[0].id)
      .single();
    assert.ifError(error);
    assert.ok(bar.display_name);
    const { data: jobs, error: jobsError } = await anon
      .from("profile_positions")
      .select("title")
      .eq("bar_profile_id", bar.id);
    assert.ifError(jobsError);
    assert.ok(jobs.length > 0);
  });

  test("running it again adds nothing", async () => {
    // Counted on the seeded bars only, without locking the tables: replaying a
    // seed this size under a table lock held up other test files' fixture
    // inserts past their statement timeout.
    const count = async () =>
      (
        await admin.query(
          `WITH bars AS (SELECT id FROM public.profiles WHERE kind = 'bar' AND handle = ANY($1)),
                drinks AS (SELECT id FROM public.items WHERE origin_bar_profile_id IN (SELECT id FROM bars))
           SELECT (SELECT count(*) FROM bars)::int AS bars,
                  (SELECT count(*) FROM public.profile_positions WHERE bar_profile_id IN (SELECT id FROM bars))::int AS positions,
                  (SELECT count(*) FROM public.profile_awards WHERE profile_id IN (SELECT id FROM bars))::int AS awards,
                  (SELECT count(*) FROM drinks)::int AS drinks,
                  (SELECT count(*) FROM public.recipes WHERE recipe_item_id IN (SELECT id FROM drinks))::int AS lines,
                  (SELECT count(*) FROM public.profile_menu_editions WHERE profile_id IN (SELECT id FROM bars))::int AS menus,
                  (SELECT count(*) FROM public.profile_menu_edition_drinks d
                     JOIN public.profile_menu_editions e ON e.id = d.edition_id
                    WHERE e.profile_id IN (SELECT id FROM bars))::int AS menu_drinks`,
          [HANDLES],
        )
      ).rows[0];
    // Other seed tests lock these tables to replay their own seeds. A short
    // deadlock_timeout makes this side the one Postgres cancels if the two
    // cross, and then it simply tries again. Setting it takes the superuser.
    const adminUrl = new URL(status.DB_URL);
    adminUrl.username = "supabase_admin";
    const admin = new pg.Client({ connectionString: adminUrl.href });
    await admin.connect();
    try {
      for (let attempt = 1; ; attempt++) {
        await admin.query("BEGIN");
        try {
          await admin.query("SET LOCAL deadlock_timeout = '100ms'");
          await admin.query("SET LOCAL lock_timeout = '30s'");
          const before = await count();
          await admin.query(SQL);
          assert.deepEqual(await count(), before);
          break;
        } catch (e) {
          if (attempt >= 5 || !["40P01", "55P03"].includes(e.code)) throw e;
        } finally {
          await admin.query("ROLLBACK");
        }
      }
    } finally {
      await admin.end();
    }
  });
});
