-- DRAFT (schema proposal, docs/schema_proposal.md section 7). Local stack only.
--
-- Home bar inventory, and rankings by comparison.
--
--   home_bar_items    the bottles on a person's shelf. "Can make" is worked
--                     out from these and recipes (see the proposal).
--   rank_entries      a drink someone had, at a bar or at home, placed in their
--                     own ordered list for the drink it's ranked as ("my
--                     martinis"). A first pick (loved, fine, didn't like) sets
--                     the score band, and the order inside the band is built
--                     from comparisons, like Beli.
--   rank_comparisons  each "which was better?" answer: who, winner, loser.
--   rank_entry_scores a view of every entry with its personal 0 to 10 score.
--
-- Area rankings ("best martini in 3065, Melbourne, Australia") are computed
-- by pg_cron into materialized views in the private schema, and read through
-- RPCs that only return a drink at a bar once enough people have ranked it.
-- All ranking rows are private to their owner; only the aggregates are public.

CREATE TABLE "public"."home_bar_items" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "item_id")
);

CREATE INDEX "home_bar_items_item_id_idx" ON "public"."home_bar_items" ("item_id");

CREATE TYPE "public"."rank_sentiment" AS ENUM ('loved', 'fine', 'disliked');

CREATE TABLE "public"."rank_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- The drink they had: a bar's published version, a home riff, or the
    -- classic itself when the bar's own version isn't visible to them.
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- The list it's compared in, usually the classic ("martinis"). Usually the
    -- item itself for originals and riffs.
    "ranked_as_item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- Where they had it: a bar's profile. NULL: made at home.
    "venue_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "sentiment" "public"."rank_sentiment" NOT NULL,
    -- Order inside the user's list and sentiment band, best first. The app
    -- inserts between neighbours ((a + b) / 2), so nothing else moves.
    "rank_key" double precision NOT NULL,
    "had_on" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rank_entries_once_key" UNIQUE NULLS NOT DISTINCT ("user_id", "item_id", "ranked_as_item_id", "venue_profile_id")
);

CREATE INDEX "rank_entries_list_idx" ON "public"."rank_entries" ("user_id", "ranked_as_item_id", "sentiment", "rank_key");
CREATE INDEX "rank_entries_item_id_idx" ON "public"."rank_entries" ("item_id");
CREATE INDEX "rank_entries_ranked_as_item_id_idx" ON "public"."rank_entries" ("ranked_as_item_id");
CREATE INDEX "rank_entries_venue_profile_id_idx" ON "public"."rank_entries" ("venue_profile_id");

CREATE TABLE "public"."rank_comparisons" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "winner_entry_id" "uuid" NOT NULL REFERENCES "public"."rank_entries"("id") ON DELETE CASCADE,
    "loser_entry_id" "uuid" NOT NULL REFERENCES "public"."rank_entries"("id") ON DELETE CASCADE,
    -- "Too close to call"
    "is_tie" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rank_comparisons_two_entries" CHECK ("winner_entry_id" <> "loser_entry_id")
);

CREATE INDEX "rank_comparisons_user_id_idx" ON "public"."rank_comparisons" ("user_id");
CREATE INDEX "rank_comparisons_winner_entry_id_idx" ON "public"."rank_comparisons" ("winner_entry_id");
CREATE INDEX "rank_comparisons_loser_entry_id_idx" ON "public"."rank_comparisons" ("loser_entry_id");

-- --- Personal scores ---

-- Score for the entry at 0-based position p_index of p_count in its band:
-- loved 10 down towards 6.7, fine 6.6 towards 3.4, didn't like 3.3 towards 0.
CREATE FUNCTION "private"."rank_score"("p_sentiment" "public"."rank_sentiment", "p_index" bigint, "p_count" bigint) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT round(hi - (hi - lo) * p_index / greatest(p_count, 1), 1)
  FROM (SELECT
    CASE p_sentiment WHEN 'loved' THEN 10.0 WHEN 'fine' THEN 6.6 ELSE 3.3 END AS hi,
    CASE p_sentiment WHEN 'loved' THEN 6.7 WHEN 'fine' THEN 3.4 ELSE 0.0 END AS lo
  ) band;
$$;

-- Each entry with its personal score. Runs as the caller, so people see only
-- their own; the ranking refresh runs it as the owner over everyone's.
CREATE VIEW "public"."rank_entry_scores" WITH ("security_invoker" = true) AS
SELECT
    "e"."id", "e"."user_id", "e"."item_id", "e"."ranked_as_item_id", "e"."venue_profile_id",
    "e"."sentiment", "e"."rank_key", "e"."had_on", "e"."created_at",
    "private"."rank_score"(
        "e"."sentiment",
        row_number() OVER "band" - 1,
        count(*) OVER (PARTITION BY "e"."user_id", "e"."ranked_as_item_id", "e"."sentiment")
    ) AS "score"
FROM "public"."rank_entries" "e"
WINDOW "band" AS (PARTITION BY "e"."user_id", "e"."ranked_as_item_id", "e"."sentiment" ORDER BY "e"."rank_key", "e"."created_at");

REVOKE ALL ON "public"."rank_entry_scores" FROM "anon";

-- --- Area rankings ---

-- The fewest people who must rank a drink at a bar (or a drink overall)
-- before its score is shown anywhere.
CREATE FUNCTION "private"."ranking_min_rankers"() RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ SELECT 20 $$;

-- One row per drink at a bar. Each person counts once (their best score for
-- it there), staff don't count at their own bar, and the score is pulled
-- towards the drink's average across all bars until enough people rank it
-- (a Bayesian average with a prior of 10 rankers), so three fans can't top a
-- list that others have 300 rankings in.
CREATE MATERIALIZED VIEW "private"."venue_drink_scores" AS
WITH "per_user" AS (
    SELECT "s"."ranked_as_item_id", "s"."venue_profile_id", "s"."user_id", max("s"."score") AS "score"
    FROM "public"."rank_entry_scores" "s"
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

-- One row per drink, wherever it was had: the score beside a riff in "best
-- riffs". The creator's own rankings don't count.
CREATE MATERIALIZED VIEW "private"."item_scores" AS
WITH "per_user" AS (
    SELECT "s"."item_id", "s"."user_id", max("s"."score") AS "score"
    FROM "public"."rank_entry_scores" "s"
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

REVOKE ALL ON "private"."venue_drink_scores", "private"."item_scores" FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."refresh_rankings"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY private.venue_drink_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY private.item_scores;
END;
$$;

SELECT "cron"."schedule"('refresh-rankings', '7 * * * *', 'SELECT private.refresh_rankings()');

-- "Best martini" in an area, best first. Area filters are optional and
-- combine: country, then city, then postcode. Anyone can call it, signed in
-- or not; it only returns public bars with enough rankers.
CREATE FUNCTION "public"."get_drink_rankings"(
    "p_ranked_as_item_id" "uuid",
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_postcode" "text" DEFAULT NULL,
    "p_limit" integer DEFAULT 20
) RETURNS TABLE("position" bigint, "venue_profile_id" "uuid", "handle" "text", "display_name" "text",
                "locality" "text", "city" "text", "score" numeric, "rankers" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT row_number() OVER (ORDER BY v.score DESC, v.rankers DESC), p.id, p.handle, p.display_name,
         p.locality, p.city, v.score, v.rankers
  FROM private.venue_drink_scores v
  JOIN public.profiles p ON p.id = v.venue_profile_id
  WHERE v.ranked_as_item_id = p_ranked_as_item_id
    AND v.rankers >= private.ranking_min_rankers()
    AND p.is_public
    AND (p_country_code IS NULL OR p.country_code = upper(p_country_code))
    AND (p_city IS NULL OR lower(p.city) = lower(p_city))
    AND (p_postcode IS NULL OR p.postcode = p_postcode)
  ORDER BY v.score DESC, v.rankers DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- Scores for a set of drinks (a family tree's riffs), where enough people
-- have ranked them.
CREATE FUNCTION "public"."get_item_scores"("p_item_ids" "uuid"[])
    RETURNS TABLE("item_id" "uuid", "score" numeric, "rankers" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT s.item_id, s.score, s.rankers
  FROM private.item_scores s
  WHERE s.item_id = ANY (p_item_ids[1:200])
    AND s.rankers >= private.ranking_min_rankers();
$$;

-- --- Policies ---

ALTER TABLE "public"."home_bar_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rank_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rank_comparisons" ENABLE ROW LEVEL SECURITY;

-- Everything here is the owner's alone. Items must be visible to them.
CREATE POLICY "home_bar_items_own" ON "public"."home_bar_items" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()) AND "item_id" IN (SELECT "id" FROM "public"."items"));

CREATE POLICY "rank_entries_own" ON "public"."rank_entries" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "item_id" IN (SELECT "id" FROM "public"."items")
        AND "ranked_as_item_id" IN (SELECT "id" FROM "public"."items")
        AND ("venue_profile_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."id" = "venue_profile_id" AND "p"."kind" = 'bar' AND "p"."is_public"
        ))
    );

-- Both entries must be the caller's, in the same list.
CREATE POLICY "rank_comparisons_own" ON "public"."rank_comparisons" FOR ALL TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND EXISTS (
            SELECT 1 FROM "public"."rank_entries" "w", "public"."rank_entries" "l"
            WHERE "w"."id" = "winner_entry_id" AND "l"."id" = "loser_entry_id"
              AND "w"."user_id" = (SELECT "auth"."uid"()) AND "l"."user_id" = (SELECT "auth"."uid"())
              AND "w"."ranked_as_item_id" = "l"."ranked_as_item_id"
        )
    );

REVOKE EXECUTE ON FUNCTION "private"."rank_score"("p_sentiment" "public"."rank_sentiment", "p_index" bigint, "p_count" bigint) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."rank_score"("p_sentiment" "public"."rank_sentiment", "p_index" bigint, "p_count" bigint) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."ranking_min_rankers"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_rankings"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_drink_rankings"("p_ranked_as_item_id" "uuid", "p_country_code" "text", "p_city" "text", "p_postcode" "text", "p_limit" integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."get_item_scores"("p_item_ids" "uuid"[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_drink_rankings"("p_ranked_as_item_id" "uuid", "p_country_code" "text", "p_city" "text", "p_postcode" "text", "p_limit" integer) TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_item_scores"("p_item_ids" "uuid"[]) TO "anon", "authenticated", "service_role";
