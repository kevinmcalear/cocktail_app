-- Home items stay with their creator. Local stack only until Kevin's OK.
-- Stacked on 20261008310000_presentation_rls_speed.sql and redefines its
-- items_select and app_recipe_presentation.
--
-- A home item (no venue, made by someone) that isn't a cocktail, beer or wine
-- (a prep, syrup, ingredient, glass, ice, method or family) was readable by
-- every signed-in person, along with its recipe and steps. Now it's readable
-- by its creator, moderators, and anyone who can see something that uses it:
--   * it's published itself (private.published_listing), or
--   * a drink or prep that uses it (as an ingredient or its generic, a
--     method, or a drink's glass, ice or family), up to four levels up, is
--     shared (no creator, or a catalog row), the reader's own, at one of the
--     reader's venues, or published.
-- So a published drink's sub-recipes, preps and glass still show with it, and
-- the shared catalog (created_by NULL, or is_catalog) is unchanged.
--
-- item_steps, recipes, item_images, item_categories and item_methods already
-- read through items, so they follow. app_recipe_presentation is a definer
-- view, so its home branch gets the same rule.

-- --- the rule ---

CREATE FUNCTION "private"."can_see_home_item"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH RECURSIVE "used_by" ("id", "depth") AS (
      SELECT p_id, 0
    UNION
      SELECT "u"."id", "ub"."depth" + 1
      FROM "used_by" "ub"
      CROSS JOIN LATERAL (
          SELECT "r"."recipe_item_id" AS "id" FROM public.recipes "r" WHERE "r"."ingredient_item_id" = "ub"."id"
          UNION ALL
          SELECT "r"."recipe_item_id" FROM public.recipes "r" WHERE "r"."parent_ingredient_id" = "ub"."id"
          UNION ALL
          SELECT "m"."item_id" FROM public.item_methods "m" WHERE "m"."method_item_id" = "ub"."id"
          UNION ALL
          SELECT "d"."id" FROM public.items "d" WHERE "d"."glassware_id" = "ub"."id"
          UNION ALL
          SELECT "d"."id" FROM public.items "d" WHERE "d"."ice_id" = "ub"."id"
          UNION ALL
          SELECT "d"."id" FROM public.items "d" WHERE "d"."family_id" = "ub"."id"
      ) "u"
      WHERE "ub"."depth" < 4
  )
  SELECT EXISTS (
      SELECT 1 FROM "used_by" "ub"
      JOIN public.items "i" ON "i"."id" = "ub"."id"
      WHERE ("ub"."depth" > 0 AND (
                ("i"."bar_id" IS NULL AND ("i"."created_by" IS NULL OR "i"."is_catalog" OR "i"."created_by" = auth.uid()))
                OR "i"."bar_id" IN (SELECT private.my_bar_ids(0))))
         OR EXISTS (SELECT 1 FROM private.published_listing "l" WHERE "l"."id" = "i"."id")
  );
$$;

-- anon too: app_recipe_presentation calls it for every reader (a signed-out
-- reader never reaches the home branch, but the call is still checked). anon
-- has no USAGE on private, so it can't call it by name.
REVOKE EXECUTE ON FUNCTION "private"."can_see_home_item"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."can_see_home_item"("uuid") TO "anon", "authenticated", "service_role";

-- --- items ---

-- As 20261008310000_presentation_rls_speed.sql, with the home branch above.
DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated" USING (
CASE
    WHEN "bar_id" IS NOT NULL THEN
        "bar_id" IN (SELECT "private"."my_bar_ids"(35))
        OR ("bar_id" IN (SELECT "private"."my_bar_ids"(0))
            AND "private"."can_view_bar_item"("bar_id", "override_visibility_level"))
    WHEN "created_by" IS NULL THEN true
    WHEN "item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"]) THEN
        "is_catalog"
        OR "created_by" = (SELECT "auth"."uid"())
        OR (SELECT "private"."is_app_admin"())
        OR "private"."can_see_home_item"("id")
    ELSE "created_by" = (SELECT "auth"."uid"())
        OR (SELECT "private"."is_app_admin"())
        OR ("publish_mode" = ANY (ARRAY['description'::"public"."item_publish_mode", 'spec'::"public"."item_publish_mode"])
            AND "moderated_at" IS NULL
            AND NOT ("created_by" IN (SELECT "private"."blocked_user_ids"()))
            AND EXISTS (
                SELECT 1 FROM "public"."profiles" "p"
                WHERE "p"."user_id" = "items"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL))
END);

-- --- app_recipe_presentation ---

-- As 20261008310000_presentation_rls_speed.sql; a home prep or ingredient's
-- lines follow the same rule as the item.
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
