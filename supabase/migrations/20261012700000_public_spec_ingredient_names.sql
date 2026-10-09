-- Ingredient names on a public spec. Local stack only until Kevin's OK.
--
-- A published spec read from outside the venue (signed out, or signed in
-- anywhere else) gets each line's ingredient from app_recipe_presentation as
-- COALESCE(parent_ingredient_id, generic_id, ingredient_item_id), and the
-- drink page names it through published_ingredient, a lookup in
-- published_items. Its reference rows disagreed with that in two ways:
--   * They listed COALESCE(parent_ingredient_id, ingredient_item_id) and never
--     the generic, so a line whose ingredient has a generic (a shared brand of
--     Rye Whiskey, or a house blend that is a kind of Sweet Vermouth) found no
--     row and showed "House ingredient".
--   * They listed a venue's own ingredient whatever its own publish mode, so a
--     private house prep was named on every published spec that used it.
--
-- The rule, the same one public_spec_changes uses for older versions of a
-- spec: a line's ingredient is named when it is in the shared catalog (no
-- venue, no creator), or published in its own right (private.published_listing,
-- which puts it in published_items as itself, not as a reference). Anything
-- else stays unnamed. Spec lines now add a reference row only for a shared
-- item: the parent, or with no parent the generic and the ingredient itself
-- (so a venue's own staff, who read the brand on the public page, still see a
-- shared brand named). Glass, ice, family and method references are unchanged.

-- --- published_items ---

-- As 20261009300000_signed_out_drink_cards.sql, with the spec-line references
-- above.
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
    CASE WHEN "rows"."page_locked" THEN NULL::boolean ELSE "img"."is_generated" END AS "image_is_generated",
    "rows"."is_shared"
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
        "l"."page_locked",
        ("l"."bar_id" IS NULL AND "l"."created_by" IS NULL) AS "is_shared"
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
        false,
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
        -- A spec line's ingredient, only from the shared catalog (see the top).
        -- A join on the referenced item d, not an OR outside this IN, so it
        -- stays one semi join.
        UNION ALL
        SELECT "d"."id" FROM "public"."recipes" "r"
        JOIN "private"."published_listing" "l" ON "l"."id" = "r"."recipe_item_id"
        JOIN "public"."items" "d" ON "d"."id" = "r"."parent_ingredient_id"
        WHERE "l"."effective_mode" = 'spec' AND "d"."bar_id" IS NULL AND "d"."created_by" IS NULL
        UNION ALL
        SELECT "d"."id" FROM "public"."recipes" "r"
        JOIN "private"."published_listing" "l" ON "l"."id" = "r"."recipe_item_id"
        JOIN "public"."items" "s" ON "s"."id" = "r"."ingredient_item_id"
        JOIN "public"."items" "d" ON "d"."id" = "s"."generic_id"
        WHERE "l"."effective_mode" = 'spec' AND "r"."parent_ingredient_id" IS NULL AND "d"."bar_id" IS NULL AND "d"."created_by" IS NULL
        UNION ALL
        SELECT "d"."id" FROM "public"."recipes" "r"
        JOIN "private"."published_listing" "l" ON "l"."id" = "r"."recipe_item_id"
        JOIN "public"."items" "d" ON "d"."id" = "r"."ingredient_item_id"
        WHERE "l"."effective_mode" = 'spec' AND "r"."parent_ingredient_id" IS NULL AND "d"."bar_id" IS NULL AND "d"."created_by" IS NULL
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
