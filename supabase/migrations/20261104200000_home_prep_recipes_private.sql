-- A home prep's recipe lines stay with its maker.
--
-- 20261012410000_home_prep_steps_private.sql made a home prep's card
-- (item_prep) and steps (item_steps) readable only by people who can edit it
-- (private.can_edit_item: the maker, and app admins), and public.recipes was
-- already that way. app_recipe_presentation still let a non-drink home item's
-- lines through for anyone who could see a drink that uses it
-- (private.can_see_home_item), so its ingredients and amounts showed. Now a
-- non-drink item's own lines need a shared catalog row (no maker, or
-- is_catalog) or someone who can edit it, as item_prep_select and
-- item_steps_select do. Off a venue, can_edit_item is the maker or an app
-- admin (a credited drink has no maker), and the clause already lets both in,
-- so the non-drink branch keeps only is_catalog.
--
-- Unchanged: the drink's own lines, including the one naming the prep, and
-- every other rule of the view (as 20261101200000_role_permissions_per_role.sql).

CREATE OR REPLACE VIEW "public"."app_recipe_presentation" WITH ("security_invoker" = false) AS
SELECT
    "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        ELSE NULL::"uuid"
    END AS "display_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."amount"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."amount"
        WHEN "ps"."id" IS NOT NULL THEN "r"."amount"
        ELSE NULL::numeric
    END AS "amount",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."unit"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."unit"
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
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
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
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."at_service"
        WHEN "ps"."id" IS NOT NULL THEN "r"."at_service"
        ELSE NULL::boolean
    END AS "at_service"
FROM "public"."recipes" "r"
JOIN "public"."items" "c" ON "r"."recipe_item_id" = "c"."id"
LEFT JOIN "public"."items" "s" ON "s"."id" = "r"."ingredient_item_id"
LEFT JOIN "public"."bars" "b" ON "c"."bar_id" = "b"."id"
LEFT JOIN "public"."user_bars" "ub" ON "ub"."bar_id" = "c"."bar_id" AND "ub"."user_id" = "auth"."uid"()
    AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"())
LEFT JOIN "public"."venue_roles" "mvr" ON "mvr"."id" = "ub"."venue_role_id"
LEFT JOIN "public"."venue_level_overrides" "mlo" ON "ub"."venue_role_id" IS NULL AND "mlo"."bar_id" = "ub"."bar_id" AND "mlo"."base_level" = "ub"."role_level"
LEFT JOIN (
    SELECT "l"."id" FROM "private"."published_listing" "l" WHERE "l"."effective_mode" = 'spec'
) "ps" ON "ps"."id" = "c"."id"
LEFT JOIN "public"."profiles" "op" ON "op"."id" = "c"."origin_bar_profile_id"
    AND "c"."bar_id" IS NULL AND NOT "c"."is_catalog" AND "c"."created_by" IS NULL
LEFT JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
-- effective_bar_role(ub.role_level), as a join (see 20261101200000).
LEFT JOIN "public"."user_prefs" "up" ON "up"."user_id" = "auth"."uid"()
CROSS JOIN LATERAL (
    SELECT LEAST(COALESCE("ub"."role_level", 10), COALESCE("up"."view_as_role_level", COALESCE("ub"."role_level", 10))) AS "role"
) "er"
-- The member's own grants and revokes, left out under View as.
CROSS JOIN LATERAL (
    SELECT "g"."granted", "g"."revoked", 'specs' = ANY ("g"."granted") AS "specs"
    FROM (SELECT
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."granted", "mlo"."granted", '{}') ELSE '{}' END AS "granted",
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."revoked", "mlo"."revoked", '{}') ELSE '{}' END AS "revoked"
    ) "g"
) "ov"
WHERE (
    "auth"."uid"() IS NOT NULL
    AND (
        (
            "c"."bar_id" IS NULL
            AND (
                "c"."created_by" IS NULL
                OR "c"."created_by" = "auth"."uid"()
                OR ("c"."item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"])
                    AND "c"."is_catalog")
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
        OR ("ub"."user_id" IS NOT NULL
            AND "private"."cap_open"('menu', "er"."role" >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level"), "ov"."granted", "ov"."revoked"))
    )
) OR "ps"."id" IS NOT NULL;
