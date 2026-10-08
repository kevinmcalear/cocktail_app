// More cocktail legends, and past jobs on the public record
// (20261009200000_cocktail_legends.sql): the new people are public, unclaimed
// profiles with jobs, their drinks queued no paid work, a past job shows when
// the bar has closed, the person made a credited drink there or their drinks
// go back before 2000, other past jobs stay hidden from signed-out visitors,
// and running the seed again adds nothing.
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
    `Refusing to run legends seed tests against a non-local API: ${status.API_URL}`,
  );
}

const SQL = readFileSync(
  new URL("../migrations/20261009200000_cocktail_legends.sql", import.meta.url),
  "utf8",
);
// The new people's handles: the first column of the people VALUES rows.
const PEOPLE = [
  ...SQL.split("-- --- 2. People ---")[1]
    .split(";\n")[0]
    .matchAll(/^ {4}\('([a-z0-9._-]+)'/gm),
].map((m) => m[1]);

// A past job others may read: the bar closed, the person made a credited drink
// there, or their credited drinks go back before 2000.
const PUBLIC_RECORD = `
  (bar.is_closed
   OR EXISTS (SELECT 1 FROM public.items i WHERE i.creator_profile_id = per.id AND i.origin_bar_profile_id = bar.id)
   OR EXISTS (SELECT 1 FROM public.item_co_creators c JOIN public.items i ON i.id = c.item_id
              WHERE c.profile_id = per.id AND i.origin_bar_profile_id = bar.id)
   OR EXISTS (SELECT 1 FROM public.items i WHERE i.creator_profile_id = per.id AND i.origin_year < 2000)
   OR EXISTS (SELECT 1 FROM public.item_co_creators c JOIN public.items i ON i.id = c.item_id
              WHERE c.profile_id = per.id AND i.origin_year < 2000))`;

const anon = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: status.DB_URL });

before(() => db.connect());
after(() => db.end());

describe("cocktail legends", () => {
  test("the new legends are public, unclaimed people with a job", async () => {
    assert.ok(PEOPLE.includes("eben.freeman"), "Eben Freeman is in the seed");
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE p.is_public AND p.user_id IS NULL AND p.kind = 'person')::int AS ok,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.profile_positions pp WHERE pp.person_profile_id = p.id))::int AS with_job
       FROM public.profiles p WHERE p.handle = ANY($1)`,
      [PEOPLE],
    );
    assert.equal(rows[0].n, PEOPLE.length);
    assert.equal(rows[0].ok, rows[0].n);
    assert.ok(rows[0].with_job >= rows[0].n * 0.8, `${rows[0].with_job} of ${rows[0].n} have a job`);
  });

  test("their drinks queued no paid flavour or sketch work", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS jobs
       FROM public.items i JOIN public.profiles p ON p.id = i.creator_profile_id
       WHERE p.handle = ANY($1) AND EXISTS (SELECT 1 FROM private.item_flavor_jobs j WHERE j.item_id = i.id)`,
      [PEOPLE],
    );
    assert.equal(rows[0].jobs, 0);
  });

  test("every unclaimed past job on the public record shows", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE NOT pp.is_shown)::int AS hidden
       FROM public.profile_positions pp
       JOIN public.profiles per ON per.id = pp.person_profile_id
       JOIN public.profiles bar ON bar.id = pp.bar_profile_id
       WHERE NOT pp.is_current AND per.user_id IS NULL AND ${PUBLIC_RECORD}`,
    );
    assert.ok(rows[0].n > 100, `only ${rows[0].n} public-record past jobs`);
    assert.equal(rows[0].hidden, 0);
  });

  test("signed out, a public-record past job reads and any other past job doesn't", async () => {
    const { rows } = await db.query(
      `SELECT pp.id, pp.is_shown
       FROM public.profile_positions pp
       JOIN public.profiles per ON per.id = pp.person_profile_id
       JOIN public.profiles bar ON bar.id = pp.bar_profile_id
       WHERE NOT pp.is_current AND per.user_id IS NULL AND per.is_public AND bar.is_public
         AND (pp.is_shown OR NOT ${PUBLIC_RECORD})
       ORDER BY pp.is_shown DESC, pp.id`,
    );
    const shown = rows.find((r) => r.is_shown);
    const hidden = rows.find((r) => !r.is_shown);
    assert.ok(shown && hidden, "the seed has both kinds");
    const read = async (id) => {
      const { data, error } = await anon.from("profile_positions").select("id").eq("id", id);
      assert.ifError(error);
      return data.length;
    };
    assert.equal(await read(shown.id), 1);
    assert.equal(await read(hidden.id), 0);
  });

  test("running it again adds nothing", async () => {
    // Counted on the seeded people only, without locking the tables (see
    // kevins-bar-lists.test.mjs).
    const count = async () =>
      (
        await admin.query(
          `WITH people AS (SELECT id FROM public.profiles WHERE kind = 'person' AND handle = ANY($1)),
                drinks AS (SELECT id FROM public.items WHERE creator_profile_id IN (SELECT id FROM people))
           SELECT (SELECT count(*) FROM people)::int AS people,
                  (SELECT count(*) FROM public.profile_positions WHERE person_profile_id IN (SELECT id FROM people))::int AS positions,
                  (SELECT count(*) FROM drinks)::int AS drinks,
                  (SELECT count(*) FROM public.recipes WHERE recipe_item_id IN (SELECT id FROM drinks))::int AS lines,
                  (SELECT count(*) FROM public.source_recipes WHERE item_id IN (SELECT id FROM drinks))::int AS sources`,
          [PEOPLE],
        )
      ).rows[0];
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
