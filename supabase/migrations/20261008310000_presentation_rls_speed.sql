-- Faster drink reads, same visibility. Local stack only until Kevin's OK.
--
-- A single drink page (or a list embed) read through app_recipe_presentation
-- paid for the whole catalog:
--   * published_items kept its "listed" set in a CTE that three parts of the
--     view read, so Postgres built it for all ~17k items before it looked at
--     the id being asked for. app_recipe_presentation joins it, and so do
--     can_view_item, published_ingredient, the collect/rank/report policies
--     and save_menu, so all of them paid that price on every call.
--   * items_select called the SECURITY DEFINER private.can_view_bar_item for
--     every venue item (it can't be inlined), and is_app_admin() once per
--     row. item_images, item_categories and item_methods asked
--     "item_id IN (SELECT id FROM items)", which re-ran the items policy over
--     the whole table for each read.
--   * app_recipe_presentation called effective_bar_role() up to eight times
--     per recipe row, each a user_prefs lookup.
--
-- What changes (rows and columns returned are the same for every reader):
--   * private.published_listing holds the "listed" rule once, as a plain
--     view, so published_items and app_recipe_presentation can filter it by
--     id. published_items is the same two parts (listed drinks and the
--     reference rows their glass, ice, family, methods and spec need), now a
--     UNION ALL that an id filter reaches.
--   * items_select checks membership with my_bar_ids() (worked out once per
--     statement) before it calls can_view_bar_item, and wraps is_app_admin().
--   * item_images, item_categories and item_methods check their own item
--     with EXISTS, one index lookup per row.
--   * app_recipe_presentation reads the viewer's "view as" level once.
--   * Indexes for the lookups the views now make: menu_drinks.item_id,
--     items.glassware_id / ice_id / family_id, item_methods.method_item_id,
--     and recipes.ingredient_item_id / parent_ingredient_id. The two recipes
--     indexes are also in 20261008300000_db_indexes.sql (IF NOT EXISTS, same
--     names), so either PR can land first.
--
-- app_item_presentation still calls effective_bar_role(), only for venue items
-- (c.bar_id IS NULL short-circuits the rest). It is left alone here because
-- open PRs #249 and #256 redefine it.

-- --- indexes ---

CREATE INDEX IF NOT EXISTS "menu_drinks_item_id_idx" ON "public"."menu_drinks" ("item_id");
CREATE INDEX IF NOT EXISTS "items_glassware_id_idx" ON "public"."items" ("glassware_id") WHERE "glassware_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "items_ice_id_idx" ON "public"."items" ("ice_id") WHERE "ice_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "items_family_id_idx" ON "public"."items" ("family_id") WHERE "family_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "item_methods_method_item_id_idx" ON "public"."item_methods" ("method_item_id");
CREATE INDEX IF NOT EXISTS "recipes_ingredient_item_id_idx" ON "public"."recipes" ("ingredient_item_id");
CREATE INDEX IF NOT EXISTS "recipes_parent_ingredient_id_idx" ON "public"."recipes" ("parent_ingredient_id") WHERE "parent_ingredient_id" IS NOT NULL;

-- --- the listed rule, once ---

-- The drinks a reader may see as published, with the level they are
-- published at. As the "listed" CTE of 20261007130000_bar_page_visibility.sql,
-- with the blocked-users CTE written as a subquery (it's the same set) and the
-- menu lookup skipped for shared items.
-- Owned by postgres and read only through the definer views below; anon and
-- authenticated get nothing on the private schema.
CREATE VIEW "private"."published_listing" WITH ("security_invoker" = false) AS
SELECT
    "i"."id",
    "i"."name",
    "i"."item_type",
    "i"."description",
    "i"."bar_id",
    "i"."glassware_id",
    "i"."ice_id",
    "i"."family_id",
    "i"."origin",
    "i"."abv",
    "i"."icon_key",
    "i"."icon_url",
    "i"."published_at",
    "i"."riff_of_id",
    "i"."creator_profile_id",
    "i"."origin_bar_profile_id",
    "i"."origin_year",
    "i"."credit_status",
    CASE
        WHEN "eff"."mode" = 'spec' AND "pg"."page" <> 'open' THEN 'description'::"public"."item_publish_mode"
        ELSE "eff"."mode"
    END AS "effective_mode",
    ("pg"."page" = 'locked') AS "page_locked"
FROM "public"."items" "i"
LEFT JOIN "public"."bars" "bar" ON "bar"."id" = "i"."bar_id"
CROSS JOIN LATERAL (
    SELECT COALESCE(
        "i"."publish_mode",
        -- Only a venue item can be on its venue's menus (m.bar_id = i.bar_id
        -- is never true for a shared item), so shared items skip the lookup.
        CASE WHEN "i"."bar_id" IS NOT NULL THEN
            (SELECT max("m"."publish_mode")
               FROM "public"."menu_drinks" "md"
               JOIN "public"."menus" "m" ON "m"."id" = "md"."menu_id"
              WHERE "md"."item_id" = "i"."id" AND "m"."bar_id" = "i"."bar_id" AND "m"."publish_mode" IS NOT NULL)
        END,
        "bar"."default_publish_mode",
        'private'::"public"."item_publish_mode"
    ) AS "mode"
) "eff"
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN "i"."is_catalog" THEN 'open'::"public"."bar_page_visibility"
        WHEN "i"."bar_id" IS NOT NULL THEN "bar"."page_visibility"
        WHEN "i"."origin_bar_profile_id" IS NOT NULL AND "i"."created_by" IS NULL THEN COALESCE(
            (SELECT "ob"."page_visibility"
               FROM "public"."profiles" "op"
               JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
              WHERE "op"."id" = "i"."origin_bar_profile_id"),
            'description'::"public"."bar_page_visibility")
        ELSE 'open'::"public"."bar_page_visibility"
    END AS "page"
) "pg"
WHERE "eff"."mode" <> 'private'
  AND "i"."moderated_at" IS NULL
  AND CASE
      WHEN "i"."bar_id" IS NOT NULL THEN EXISTS (
          SELECT 1 FROM "public"."profiles" "p"
          WHERE "p"."bar_id" = "i"."bar_id" AND "p"."is_public" AND "p"."moderated_at" IS NULL)
      WHEN "i"."created_by" IS NOT NULL THEN EXISTS (
          SELECT 1 FROM "public"."profiles" "p"
          WHERE "p"."user_id" = "i"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL)
        AND NOT ("i"."created_by" IN (
          SELECT "b"."blocked_id" FROM "public"."user_blocks" "b" WHERE "b"."blocker_id" = "auth"."uid"()
          UNION
          SELECT "b"."blocker_id" FROM "public"."user_blocks" "b" WHERE "b"."blocked_id" = "auth"."uid"()))
      ELSE true
  END;

REVOKE ALL ON "private"."published_listing" FROM PUBLIC, "anon", "authenticated";

-- --- published_items ---

-- Same columns and rows as 20261007130000_bar_page_visibility.sql. A reference
-- row is an item that isn't listed itself but is the glass, ice, family or
-- method of a listed drink, or an ingredient of one listed with its spec.
CREATE OR REPLACE VIEW "public"."published_items" WITH ("security_invoker" = false) AS
SELECT
    "rows"."id",
    "rows"."name",
    "rows"."item_type",
    "rows"."description",
    "rows"."bar_id",
    "rows"."glassware_id",
    "rows"."ice_id",
    "rows"."family_id",
    "rows"."origin",
    "rows"."abv",
    "rows"."icon_key",
    "rows"."icon_url",
    "rows"."publish_mode",
    "rows"."published_at",
    "rows"."riff_of_id",
    "rows"."creator_profile_id",
    "rows"."origin_bar_profile_id",
    "rows"."origin_year",
    "rows"."credit_status",
    "rows"."is_reference",
    CASE WHEN "rows"."page_locked" THEN NULL::"text" ELSE "img"."url" END AS "image_url",
    CASE WHEN "rows"."page_locked" THEN NULL::boolean ELSE "img"."is_generated" END AS "image_is_generated"
FROM (
    SELECT
        "l"."id",
        "l"."name",
        "l"."item_type",
        CASE WHEN "l"."page_locked" THEN NULL::"text" ELSE "l"."description" END AS "description",
        "l"."bar_id",
        "l"."glassware_id",
        "l"."ice_id",
        "l"."family_id",
        "l"."origin",
        "l"."abv",
        "l"."icon_key",
        "l"."icon_url",
        "l"."effective_mode" AS "publish_mode",
        "l"."published_at",
        "l"."riff_of_id",
        CASE WHEN "l"."page_locked" THEN NULL::"uuid" ELSE "l"."creator_profile_id" END AS "creator_profile_id",
        "l"."origin_bar_profile_id",
        "l"."origin_year",
        "l"."credit_status",
        false AS "is_reference",
        "l"."page_locked"
    FROM "private"."published_listing" "l"
    UNION ALL
    SELECT
        "i"."id",
        "i"."name",
        "i"."item_type",
        NULL::"text",
        NULL::"uuid",
        NULL::"uuid",
        NULL::"uuid",
        NULL::"uuid",
        NULL::"text",
        NULL::numeric,
        "i"."icon_key",
        "i"."icon_url",
        'private'::"public"."item_publish_mode",
        NULL::timestamp with time zone,
        NULL::"uuid",
        NULL::"uuid",
        NULL::"uuid",
        NULL::smallint,
        NULL::"public"."credit_status",
        true,
        false
    FROM "public"."items" "i"
    -- One branch per way an item can be referenced, so a filter on id reaches
    -- each one through its index, and a read of every row stays one hash join.
    WHERE "i"."id" IN (
        SELECT "l"."glassware_id" FROM "private"."published_listing" "l"
        UNION ALL
        SELECT "l"."ice_id" FROM "private"."published_listing" "l"
        UNION ALL
        SELECT "l"."family_id" FROM "private"."published_listing" "l"
        UNION ALL
        SELECT "m"."method_item_id" FROM "public"."item_methods" "m"
        JOIN "private"."published_listing" "l" ON "l"."id" = "m"."item_id"
        UNION ALL
        -- COALESCE(parent_ingredient_id, ingredient_item_id) of a spec line
        SELECT "r"."parent_ingredient_id" FROM "public"."recipes" "r"
        JOIN "private"."published_listing" "l" ON "l"."id" = "r"."recipe_item_id"
        WHERE "l"."effective_mode" = 'spec' AND "r"."parent_ingredient_id" IS NOT NULL
        UNION ALL
        SELECT "r"."ingredient_item_id" FROM "public"."recipes" "r"
        JOIN "private"."published_listing" "l" ON "l"."id" = "r"."recipe_item_id"
        WHERE "l"."effective_mode" = 'spec' AND "r"."parent_ingredient_id" IS NULL
    )
      AND NOT EXISTS (SELECT 1 FROM "private"."published_listing" "l" WHERE "l"."id" = "i"."id")
) "rows"
LEFT JOIN LATERAL (
    SELECT "im"."url", "ii"."is_generated"
    FROM "public"."item_images" "ii"
    JOIN "public"."images" "im" ON "im"."id" = "ii"."image_id"
    WHERE "ii"."item_id" = "rows"."id"
    ORDER BY ("ii"."angle" = 'hero') DESC, "ii"."sort_order", "ii"."created_at"
    LIMIT 1
) "img" ON true;

-- --- app_recipe_presentation ---

-- As 20261007130000_bar_page_visibility.sql, with:
--   * "published with its spec" read from private.published_listing for this
--     drink only (the same rows as published_items' non-reference 'spec' rows);
--   * effective_bar_role(ub.role_level) written out once per row as er.role,
--     with the viewer's "view as" level read once per statement (va).
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
-- effective_bar_role(ub.role_level), with user_prefs read once (an InitPlan).
CROSS JOIN (
    SELECT (SELECT "up"."view_as_role_level" FROM "public"."user_prefs" "up" WHERE "up"."user_id" = "auth"."uid"()) AS "view_as"
) "va"
CROSS JOIN LATERAL (
    SELECT LEAST(COALESCE("ub"."role_level", 10), COALESCE("va"."view_as", COALESCE("ub"."role_level", 10))) AS "role"
) "er"
WHERE (
    "auth"."uid"() IS NOT NULL
    AND (
        (
            "c"."bar_id" IS NULL
            AND (
                "c"."created_by" IS NULL
                OR "c"."item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"])
                OR "c"."created_by" = "auth"."uid"()
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

-- --- items and the tables that follow an item's visibility ---

-- As 20260930500500_safety_screens.sql. A venue item is only possible for a
-- member: my_bar_ids() is one hashed lookup per statement, Managers and up
-- (my_bar_ids(35)) see every item of their venue as can_view_bar_item does,
-- and only lower roles still need the per-item level check.
DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated" USING (
CASE
    WHEN "bar_id" IS NOT NULL THEN
        "bar_id" IN (SELECT "private"."my_bar_ids"(35))
        OR ("bar_id" IN (SELECT "private"."my_bar_ids"(0))
            AND "private"."can_view_bar_item"("bar_id", "override_visibility_level"))
    WHEN "created_by" IS NULL OR "item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"]) THEN true
    ELSE "created_by" = (SELECT "auth"."uid"())
        OR (SELECT "private"."is_app_admin"())
        OR ("publish_mode" = ANY (ARRAY['description'::"public"."item_publish_mode", 'spec'::"public"."item_publish_mode"])
            AND "moderated_at" IS NULL
            AND NOT ("created_by" IN (SELECT "private"."blocked_user_ids"()))
            AND EXISTS (
                SELECT 1 FROM "public"."profiles" "p"
                WHERE "p"."user_id" = "items"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL))
END);

-- "item_id IN (SELECT id FROM items)" built the visible set of every item for
-- each read; EXISTS checks just this row's item. Same rows.
DROP POLICY "item_images_select" ON "public"."item_images";
CREATE POLICY "item_images_select" ON "public"."item_images" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_images"."item_id"));

DROP POLICY "item_categories_select" ON "public"."item_categories";
CREATE POLICY "item_categories_select" ON "public"."item_categories" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_categories"."item_id"));

DROP POLICY "item_methods_select" ON "public"."item_methods";
CREATE POLICY "item_methods_select" ON "public"."item_methods" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_methods"."item_id")
           AND NOT "public"."is_spec_locked"("item_id"));
