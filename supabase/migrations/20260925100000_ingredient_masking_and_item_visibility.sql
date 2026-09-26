-- Ingredient masking and item visibility follow the caller's role.
--
--   * app_recipe_presentation's raw ingredient columns follow the same levels
--     as display_ingredient_id. The app reaches the shown ingredient through
--     the display_ingredient computed relationship instead of embedding items
--     through the raw columns.
--   * Bar items are readable by members whose role meets the item's
--     visibility level, and by members who may edit the bar's items. Child
--     rows (item_images, item_categories, ...) already follow items.

-- ---------------------------------------------------------------------------
-- app_recipe_presentation: mask the raw ingredient columns
-- ---------------------------------------------------------------------------

-- Same columns, order and types as before. ingredient_item_id is the specific
-- ingredient, so it needs the brand level; parent_ingredient_id is the generic
-- one, so it needs the generic level (or the brand level, which reveals more).
-- Being expressions, these two columns no longer carry the foreign keys, so
-- PostgREST cannot embed items through them.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" AS
 SELECT "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
            ELSE NULL::"uuid"
        END AS "display_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."amount"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."amount"
            ELSE NULL::numeric
        END AS "amount",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."unit"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."unit"
            ELSE NULL::"text"
        END AS "unit",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."preparation_notes"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_prep_level", "b"."default_prep_level")) THEN "r"."preparation_notes"
            ELSE NULL::"text"
        END AS "preparation_notes",
    "r"."is_optional",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."parent_ingredient_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."parent_ingredient_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN "r"."parent_ingredient_id"
            ELSE NULL::"uuid"
        END AS "parent_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            ELSE NULL::"uuid"
        END AS "ingredient_item_id",
    "r"."sort_order"
   FROM ((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"()))))
  WHERE (("auth"."uid"() IS NOT NULL)
    AND (("c"."bar_id" IS NULL)
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))));

-- ---------------------------------------------------------------------------
-- display_ingredient: the ingredient a recipe row shows to the caller
-- ---------------------------------------------------------------------------

-- A PostgREST computed relationship: select
-- `ingredient:display_ingredient(id, name, ...)` on app_recipe_presentation to
-- embed the item behind display_ingredient_id, and nothing else. It runs as
-- the caller, so the items policy still applies to the embedded row.
CREATE FUNCTION "public"."display_ingredient"("public"."app_recipe_presentation") RETURNS SETOF "public"."items"
    LANGUAGE "sql" STABLE ROWS 1
    SET "search_path" TO ''
    AS $$
  SELECT * FROM public.items WHERE id = $1.display_ingredient_id;
$$;

REVOKE ALL ON FUNCTION "public"."display_ingredient"("public"."app_recipe_presentation") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."display_ingredient"("public"."app_recipe_presentation") TO "authenticated", "service_role";

-- ---------------------------------------------------------------------------
-- items: bar rows only at or above their visibility level
-- ---------------------------------------------------------------------------

-- Whether the caller may read a bar item with this visibility override. Uses
-- the caller's real role (view-as only narrows what the presentation views
-- show). Members who may edit the bar's items (role >= 35, as in
-- private.can_write) read all of them, so editors, menus and drafts keep
-- working.
CREATE FUNCTION "private"."can_view_bar_item"("p_bar_id" "uuid", "p_override_visibility_level" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_bars ub
    JOIN public.bars b ON b.id = ub.bar_id
    WHERE ub.bar_id = p_bar_id
      AND ub.user_id = auth.uid()
      AND (
        ub.role_level >= 35
        OR ub.role_level >= COALESCE(p_override_visibility_level, b.default_visibility_level)
      )
  );
$$;

REVOKE ALL ON FUNCTION "private"."can_view_bar_item"("p_bar_id" "uuid", "p_override_visibility_level" integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_view_bar_item"("p_bar_id" "uuid", "p_override_visibility_level" integer) TO "authenticated", "service_role";

DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated"
    USING ("bar_id" IS NULL OR "private"."can_view_bar_item"("bar_id", "override_visibility_level"));
