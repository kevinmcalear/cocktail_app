-- Role-scoped reads for recipes and bar rosters.
--
--   * Recipe rows are read through app_recipe_presentation, which applies the
--     bar's per-role visibility and each drink's overrides for the caller.
--     The raw recipes table is readable only by people who may edit the drink.
--   * get_bar_members returns email addresses to bar admins only (and each
--     member's own address to themselves).

-- ---------------------------------------------------------------------------
-- app_recipe_presentation
-- ---------------------------------------------------------------------------

-- The view now runs as its owner so it can read recipes the caller cannot read
-- directly. That means it no longer inherits the items policy, so it checks
-- access itself: signed in, and for bar drinks a member of that bar whose
-- effective (view-as) role meets the drink's visibility level. The masked
-- columns are unchanged from before.
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
    "r"."parent_ingredient_id",
    "r"."ingredient_item_id",
    "r"."sort_order"
   FROM ((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"()))))
  WHERE (("auth"."uid"() IS NOT NULL)
    AND (("c"."bar_id" IS NULL)
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))));

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);

REVOKE ALL ON "public"."app_recipe_presentation" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."app_recipe_presentation" TO "authenticated";

-- ---------------------------------------------------------------------------
-- recipes: raw rows only for people who may edit the drink
-- ---------------------------------------------------------------------------

-- Editors still need the raw rows: their updates and deletes filter on them,
-- and inserts read the new row back.
DROP POLICY "recipes_select" ON "public"."recipes";
CREATE POLICY "recipes_select" ON "public"."recipes" FOR SELECT TO "authenticated"
    USING ("private"."can_edit_item"("recipe_item_id"));

-- ---------------------------------------------------------------------------
-- get_bar_members: emails for admins only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text", "role_level" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_role INT;
BEGIN
    SELECT ub.role_level INTO v_user_role
    FROM public.user_bars ub
    WHERE ub.bar_id = p_bar_id AND ub.user_id = auth.uid();

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You do not have access to view this bar members.';
    END IF;

    RETURN QUERY
    SELECT
        ub.user_id,
        CASE
            WHEN v_user_role >= 40 OR ub.user_id = auth.uid() THEN au.email::TEXT
            ELSE NULL::TEXT
        END,
        ub.role_level
    FROM public.user_bars ub
    JOIN auth.users au ON ub.user_id = au.id
    WHERE ub.bar_id = p_bar_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bar_members"("p_bar_id" "uuid") TO "authenticated", "service_role";
