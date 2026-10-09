-- Faster cocktail lists, drink pages and ingredient pages, same rows.
-- Local stack only until Kevin's OK.
--
-- Measured on production as a venue admin (8 Oct):
--   * A cocktail list page spent 376 of 611 ms in 2,963 calls to
--     display_ingredient(). It and published_ingredient() carried
--     SET search_path, and any SET clause stops Postgres inlining a SQL
--     function, so every recipe line ran it as a separate function call.
--     Without it the planner folds the body into the query as one primary
--     key lookup on items, and the items policy's per-statement InitPlans
--     (my_bar_ids, is_app_admin) run once per request instead of once per
--     line. Both are SECURITY INVOKER, STABLE, a single SELECT and name
--     everything with its schema (the = included), so nothing in them
--     depends on the caller's search_path. The Supabase linter's
--     "function_search_path_mutable" warning for these two is expected.
--     PostgREST passes the whole app_recipe_presentation row as the
--     argument, and Postgres won't inline a function whose argument holds a
--     subquery. The view read "view as" with a scalar subquery
--     (CROSS JOIN (SELECT (SELECT view_as_role_level ...)) va), which ends
--     up in that row once the view is flattened, so it is now a LEFT JOIN on
--     user_prefs (one row per user_id, its primary key). Same columns, same
--     rows: no user_prefs row still means no "view as" level.
--   * A drink page spent 22 of 27 ms in the credited_drink_notes policy:
--     "item_id IN (SELECT id FROM items)" built the visible set of every item
--     to check one note. EXISTS checks just this row's item, the same change
--     20261008810000 made for item_images, item_categories and item_methods.
--   * Each ingredient catalog page (160 to 180 ms) builds and sorts every
--     visible row of the type to return 1,000, and the later pages' top-N
--     sort holds up to all ~14k rows, past the 3.5 MB default work_mem.
--     authenticated gets 8MB. No index on items (item_type, name, id):
--     the enum = isn't leakproof, so under RLS Postgres applies the type
--     filter after the policy and never uses such an index (checked locally,
--     with a partial index too). Keyset paging in the app is the fix there.
--   * Foreign keys with no index on the referencing side, so deleting an
--     item, category or image read the whole child table:
--     ingredient_pairs.a_id and b_id (the primary key leads with era),
--     item_categories.category_id (the primary key leads with item_id) and
--     item_images.image_id.

-- --- app_recipe_presentation ---

-- As 20261008830000_home_items_private.sql, with "view as" read through a join.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" WITH ("security_invoker" = false) AS
SELECT
    "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        ELSE NULL::"uuid"
    END AS "display_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."amount"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level") THEN "r"."amount"
        WHEN "ps"."id" IS NOT NULL THEN "r"."amount"
        ELSE NULL::numeric
    END AS "amount",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."unit"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level") THEN "r"."unit"
        WHEN "ps"."id" IS NOT NULL THEN "r"."unit"
        ELSE NULL::"text"
    END AS "unit",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."preparation_notes"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_prep_level", "b"."default_prep_level") THEN "r"."preparation_notes"
        ELSE NULL::"text"
    END AS "preparation_notes",
    "r"."is_optional",
    CASE
        WHEN "c"."bar_id" IS NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        ELSE NULL::"uuid"
    END AS "parent_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        ELSE NULL::"uuid"
    END AS "ingredient_item_id",
    "r"."sort_order",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."at_service"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level") THEN "r"."at_service"
        WHEN "ps"."id" IS NOT NULL THEN "r"."at_service"
        ELSE NULL::boolean
    END AS "at_service"
FROM "public"."recipes" "r"
JOIN "public"."items" "c" ON "r"."recipe_item_id" = "c"."id"
LEFT JOIN "public"."items" "s" ON "s"."id" = "r"."ingredient_item_id"
LEFT JOIN "public"."bars" "b" ON "c"."bar_id" = "b"."id"
LEFT JOIN "public"."user_bars" "ub" ON "ub"."bar_id" = "c"."bar_id" AND "ub"."user_id" = "auth"."uid"()
    AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"())
LEFT JOIN (
    SELECT "l"."id" FROM "private"."published_listing" "l" WHERE "l"."effective_mode" = 'spec'
) "ps" ON "ps"."id" = "c"."id"
LEFT JOIN "public"."profiles" "op" ON "op"."id" = "c"."origin_bar_profile_id"
    AND "c"."bar_id" IS NULL AND NOT "c"."is_catalog" AND "c"."created_by" IS NULL
LEFT JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
-- effective_bar_role(ub.role_level). A join, not a scalar subquery: see above.
LEFT JOIN "public"."user_prefs" "up" ON "up"."user_id" = "auth"."uid"()
CROSS JOIN LATERAL (
    SELECT LEAST(COALESCE("ub"."role_level", 10), COALESCE("up"."view_as_role_level", COALESCE("ub"."role_level", 10))) AS "role"
) "er"
WHERE (
    "auth"."uid"() IS NOT NULL
    AND (
        (
            "c"."bar_id" IS NULL
            AND (
                "c"."created_by" IS NULL
                OR "c"."created_by" = "auth"."uid"()
                OR ("c"."item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"])
                    AND ("c"."is_catalog" OR "private"."can_see_home_item"("c"."id")))
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
            )
            AND (
                "op"."id" IS NULL
                OR COALESCE("ob"."page_visibility", 'description'::"public"."bar_page_visibility") = 'open'
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
                OR EXISTS (
                    SELECT 1 FROM "public"."user_bars" "tb"
                    WHERE "tb"."bar_id" = "ob"."id" AND "tb"."user_id" = "auth"."uid"()
                      AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "tb"."venue_role_id" AND "vr"."ends_at" <= "now"()))
            )
        )
        OR ("ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level"))
    )
) OR "ps"."id" IS NOT NULL;

-- --- recipe ingredient embeds ---

-- No SET clause, so these inline (see the top). The id goes through an
-- OFFSET 0 subquery so the items lookup compares two plain columns: the
-- display_ingredient_id expression has COALESCE in it, which Postgres doesn't
-- count as leakproof, and under RLS a comparison with it can't use the
-- primary key (each line read every item instead).

CREATE OR REPLACE FUNCTION "public"."display_ingredient"("public"."app_recipe_presentation") RETURNS SETOF "public"."items"
    LANGUAGE "sql" STABLE ROWS 1
    AS $$
  SELECT i.* FROM (SELECT $1.display_ingredient_id AS id OFFSET 0) k
  JOIN public.items i ON i.id OPERATOR(pg_catalog.=) k.id;
$$;

CREATE OR REPLACE FUNCTION "public"."published_ingredient"("public"."app_recipe_presentation") RETURNS SETOF "public"."published_items"
    LANGUAGE "sql" STABLE ROWS 1
    AS $$
  SELECT i.* FROM (SELECT $1.display_ingredient_id AS id OFFSET 0) k
  JOIN public.published_items i ON i.id OPERATOR(pg_catalog.=) k.id;
$$;

-- --- credited drink notes ---

DROP POLICY "credited_drink_notes_select" ON "public"."credited_drink_notes";
CREATE POLICY "credited_drink_notes_select" ON "public"."credited_drink_notes" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "credited_drink_notes"."item_id")
           AND NOT "public"."is_spec_locked"("item_id"));

-- --- sort memory ---

-- 8MB, written in kB with no unit: PostgREST applies the impersonated
-- role's settings per request and lowercases the value, and Postgres rejects
-- '8mb' (every signed-in request would fail). It reads them when it loads
-- its config.
ALTER ROLE "authenticated" SET "work_mem" = '8192';
NOTIFY "pgrst", 'reload config';

-- --- foreign key indexes ---

CREATE INDEX IF NOT EXISTS "ingredient_pairs_a_id_idx" ON "public"."ingredient_pairs" ("a_id");
CREATE INDEX IF NOT EXISTS "ingredient_pairs_b_id_idx" ON "public"."ingredient_pairs" ("b_id");
CREATE INDEX IF NOT EXISTS "item_categories_category_id_idx" ON "public"."item_categories" ("category_id");
CREATE INDEX IF NOT EXISTS "item_images_image_id_idx" ON "public"."item_images" ("image_id");
