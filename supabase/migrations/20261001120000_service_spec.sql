-- DRAFT. Local stack only until Kevin's OK.
--
-- The service spec: what goes in the batch and what's added at the station,
-- decided once per spec line instead of guessed from ingredient names every
-- time Batch opens, plus how the drink is served.
--
--   recipes.at_service    true: added at the station. false: in the batch.
--                         NULL: nobody has decided, so the app keeps guessing
--                         from the ingredient's name (lib/batch.ts) until
--                         someone does.
--   items.service_style   a_la_minute, batched, bottled, carbonated or
--                         draught, for the Service section and the station
--                         sheet.
--
-- Both ride on the existing recipes and items policies: whoever can edit the
-- drink sets them. app_recipe_presentation shows at_service with the amounts
-- (below the measurement level it's NULL), so the flag never says more about
-- the spec than the amounts already do. app_item_presentation gains
-- service_style, which is as public as the method.

ALTER TABLE "public"."recipes" ADD COLUMN "at_service" boolean;

ALTER TABLE "public"."items" ADD COLUMN "service_style" "text"
    CONSTRAINT "items_service_style_check"
    CHECK ("service_style" IS NULL OR "service_style" IN ('a_la_minute', 'batched', 'bottled', 'carbonated', 'draught'));

-- Same columns, order and types as 20260930500400, plus at_service at the end.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" AS
 SELECT "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
            WHEN ("ps"."id" IS NOT NULL) THEN COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
            ELSE NULL::"uuid"
        END AS "display_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."amount"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."amount"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."amount"
            ELSE NULL::numeric
        END AS "amount",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."unit"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."unit"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."unit"
            ELSE NULL::"text"
        END AS "unit",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."preparation_notes"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_prep_level", "b"."default_prep_level")) THEN "r"."preparation_notes"
            ELSE NULL::"text"
        END AS "preparation_notes",
    "r"."is_optional",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."parent_ingredient_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."parent_ingredient_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN "r"."parent_ingredient_id"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."parent_ingredient_id"
            ELSE NULL::"uuid"
        END AS "parent_ingredient_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            ELSE NULL::"uuid"
        END AS "ingredient_item_id",
    "r"."sort_order",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."at_service"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level")) THEN "r"."at_service"
            WHEN ("ps"."id" IS NOT NULL) THEN "r"."at_service"
            ELSE NULL::boolean
        END AS "at_service"
   FROM (((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"())
        AND NOT EXISTS (
            SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"()
        ))))
     LEFT JOIN (
        SELECT "pi"."id" FROM "public"."published_items" "pi" WHERE "pi"."publish_mode" = 'spec' AND NOT "pi"."is_reference"
     ) "ps" ON (("ps"."id" = "c"."id")))
  WHERE ((("auth"."uid"() IS NOT NULL)
    AND (("c"."bar_id" IS NULL
          AND ("c"."created_by" IS NULL
            OR "c"."item_type" NOT IN ('cocktail', 'beer', 'wine')
            OR "c"."created_by" = "auth"."uid"()
            OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())))
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))))
    OR ("ps"."id" IS NOT NULL));

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);

-- Same columns as 20260929700000, plus service_style at the end.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
    c.origin,
    c.price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.service_style
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
