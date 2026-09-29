-- DRAFT (step 10b-3, open question 1 on the safety PR). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Shared scores count only people who have passed the age check. Since
-- 20260930500600 nobody can rank without it, but rankings made before the
-- check (and any from someone who later answered under age) were still
-- counted. Now the three shared scores read private.counted_rank_scores,
-- which leaves them out:
--
--   venue_drink_scores   a bar's version of a drink ("best martini")
--   item_scores          a drink wherever it was had ("best riffs")
--   venue_scores         a bar overall (Discover)
--
-- The rankings themselves stay, and their owners still see them and their
-- own taste profile. Someone who confirms later counts again from the next
-- hourly refresh. Under-age answers are final, so those never count.
--
-- Heads-up for applying: in production nobody has answered the age check
-- yet, so every area score starts empty and fills as rankers confirm.
--
-- The three views are 20260926150600's and 20260928210000's, unchanged apart
-- from reading counted_rank_scores. They're dropped and made again (with
-- their unique indexes, which REFRESH ... CONCURRENTLY needs) because a
-- materialized view can't be replaced in place.

-- Every ranking entry's personal score, from people who've confirmed their
-- age. Private: only the refresh (as the owner) reads it.
CREATE VIEW "private"."counted_rank_scores" AS
SELECT "s".*
FROM "public"."rank_entry_scores" "s"
WHERE EXISTS (
    SELECT 1 FROM "private"."age_checks" "a"
    WHERE "a"."user_id" = "s"."user_id" AND "a"."confirmed_at" IS NOT NULL
);

REVOKE ALL ON "private"."counted_rank_scores" FROM PUBLIC, "anon", "authenticated";

DROP MATERIALIZED VIEW "private"."venue_scores";
DROP MATERIALIZED VIEW "private"."venue_drink_scores";
DROP MATERIALIZED VIEW "private"."item_scores";

CREATE MATERIALIZED VIEW "private"."venue_drink_scores" AS
WITH "per_user" AS (
    SELECT "s"."ranked_as_item_id", "s"."venue_profile_id", "s"."user_id", max("s"."score") AS "score"
    FROM "private"."counted_rank_scores" "s"
    JOIN "public"."profiles" "p" ON "p"."id" = "s"."venue_profile_id"
    WHERE NOT EXISTS (
        SELECT 1 FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = "s"."user_id" AND "ub"."bar_id" = "p"."bar_id"
    )
    GROUP BY 1, 2, 3
), "drink_mean" AS (
    SELECT "ranked_as_item_id", avg("score") AS "mean" FROM "per_user" GROUP BY 1
)
SELECT
    "pu"."ranked_as_item_id",
    "pu"."venue_profile_id",
    count(*)::integer AS "rankers",
    round((count(*) * avg("pu"."score") + 10 * "dm"."mean") / (count(*) + 10), 1) AS "score"
FROM "per_user" "pu"
JOIN "drink_mean" "dm" USING ("ranked_as_item_id")
GROUP BY "pu"."ranked_as_item_id", "pu"."venue_profile_id", "dm"."mean";

CREATE UNIQUE INDEX "venue_drink_scores_key" ON "private"."venue_drink_scores" ("ranked_as_item_id", "venue_profile_id");

CREATE MATERIALIZED VIEW "private"."item_scores" AS
WITH "per_user" AS (
    SELECT "s"."item_id", "s"."user_id", max("s"."score") AS "score"
    FROM "private"."counted_rank_scores" "s"
    JOIN "public"."items" "i" ON "i"."id" = "s"."item_id"
    LEFT JOIN "public"."profiles" "c" ON "c"."id" = "i"."creator_profile_id"
    WHERE "c"."user_id" IS DISTINCT FROM "s"."user_id"
    GROUP BY 1, 2
), "overall" AS (
    SELECT avg("score") AS "mean" FROM "per_user"
)
SELECT
    "pu"."item_id",
    count(*)::integer AS "rankers",
    round((count(*) * avg("pu"."score") + 10 * "o"."mean") / (count(*) + 10), 1) AS "score"
FROM "per_user" "pu", "overall" "o"
GROUP BY "pu"."item_id", "o"."mean";

CREATE UNIQUE INDEX "item_scores_key" ON "private"."item_scores" ("item_id");

CREATE MATERIALIZED VIEW "private"."venue_scores" AS
WITH "people" AS (
    SELECT "s"."venue_profile_id", count(DISTINCT "s"."user_id")::integer AS "rankers"
    FROM "private"."counted_rank_scores" "s"
    JOIN "public"."profiles" "p" ON "p"."id" = "s"."venue_profile_id"
    WHERE NOT EXISTS (
        SELECT 1 FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = "s"."user_id" AND "ub"."bar_id" = "p"."bar_id"
    )
    GROUP BY 1
)
SELECT
    "v"."venue_profile_id",
    round(sum("v"."score" * "v"."rankers") / sum("v"."rankers"), 1) AS "score",
    "pe"."rankers",
    count(*)::integer AS "drinks"
FROM "private"."venue_drink_scores" "v"
JOIN "people" "pe" USING ("venue_profile_id")
GROUP BY "v"."venue_profile_id", "pe"."rankers";

CREATE UNIQUE INDEX "venue_scores_key" ON "private"."venue_scores" ("venue_profile_id");

REVOKE ALL ON "private"."venue_drink_scores", "private"."item_scores", "private"."venue_scores" FROM PUBLIC, "anon", "authenticated";
