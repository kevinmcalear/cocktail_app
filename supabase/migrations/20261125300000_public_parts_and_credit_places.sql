-- Made in parts on the public drink page, and where each credit to check is from.
--
--   published_items.parts   A published drink's parts (items.parts: each
--                           part's name and how it joins), last column. Only
--                           when its spec is shared (effective mode 'spec');
--                           null for a drink in one part, a drink sharing only
--                           its description, and reference rows. Signed-out
--                           readers can't read items, so the public page
--                           (app/d/[id].tsx) reads the parts here, and each
--                           spec line's part from app_recipe_presentation,
--                           which has had it since 20261123100000_drink_parts.
--   credits_to_check()      Gains bar_place, the suburb or city of the bar
--                           the drink comes from (its page's locality, else
--                           its city), so "Little Rye · Fitzroy · 2025" tells
--                           two drinks or two people apart. A page that hides
--                           its city has none (profiles.shows_city).

-- --- published_items ---

-- As 20261012700000_public_spec_ingredient_names.sql, with parts.
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
    "rows"."is_shared",
    "rows"."parts"
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
        ("l"."bar_id" IS NULL AND "l"."created_by" IS NULL) AS "is_shared",
        -- Only with the spec: how a drink is made in parts is part of it.
        CASE WHEN "l"."effective_mode" = 'spec' THEN (SELECT "pi"."parts" FROM "public"."items" "pi" WHERE "pi"."id" = "l"."id") END AS "parts"
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
        false,
        NULL::"jsonb"
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

-- --- credits to check ---

-- As 20261121200000_co_credits_wait_for_yes.sql, with bar_place. It names
-- the bar the way bar_name does: the bar page the drink is credited to, else
-- the page of the venue it's poured at.
DROP FUNCTION "public"."credits_to_check"();

CREATE FUNCTION "public"."credits_to_check"() RETURNS TABLE (
    "item_id" "uuid",
    "name" "text",
    "item_type" "public"."entity_type",
    "creator_name" "text",
    "bar_name" "text",
    "named_at" timestamp with time zone,
    "bar_place" "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.name, i.item_type, cp.display_name, COALESCE(bp.display_name, b.name), c.created_at,
           CASE WHEN bp.id IS NOT NULL THEN COALESCE(bp.locality, bp.city) ELSE COALESCE(vp.locality, vp.city) END
      FROM public.item_co_creators c
      JOIN public.profiles me ON me.id = c.profile_id AND me.user_id = auth.uid() AND me.kind = 'person'
      JOIN public.items i ON i.id = c.item_id
      LEFT JOIN public.profiles cp ON cp.id = i.creator_profile_id
      LEFT JOIN public.profiles bp ON bp.id = i.origin_bar_profile_id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN LATERAL (
          SELECT p.locality, p.city FROM public.profiles p WHERE p.bar_id = b.id AND p.kind = 'bar' ORDER BY p.created_at LIMIT 1
      ) vp ON true
     WHERE c.status = 'pending'
     ORDER BY c.created_at DESC
     LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."credits_to_check"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."credits_to_check"() TO "authenticated";
