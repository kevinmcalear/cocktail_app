-- Signed-out visitors see a drink's card. Local stack only until Kevin's OK.
--
-- Signed out, a bar page said "0 originals" and Top drinks drew every drink as
-- a glass icon. anon reads drinks only through published_items, and a shared
-- drink (no venue, no creator: the catalog and every drink our seeds credit to
-- a bar or a person) had no publish mode, so it was never listed. anon had no
-- grant or policy on item_sketches, so no drawing either.
--
-- What changes:
--   * private.published_listing lists a shared cocktail, beer or wine with no
--     publish mode of its own at 'description': name, picture, description
--     and credits, never the spec. A Locked bar page still drops the
--     description, picture and creator (published_items, unchanged).
--   * published_listing gains created_by (last column), and published_items
--     gains is_shared (last column), so "New from bars" can leave the shared
--     drinks out.
--   * anon may read item_sketches (item_id and inputs only) for a listed drink
--     whose page isn't locked (public.is_card_public), so its drawing shows,
--     on bar pages, drink cards and releases alike.
-- Signed-in readers gain nothing: every policy and function that reads
-- published_items also accepts what the reader can see in items, and every
-- signed-in reader can already see the shared drinks there.

-- --- the listed rule ---

-- As 20261008810000_presentation_rls_speed.sql, with the shared-drink default
-- and created_by.
CREATE OR REPLACE VIEW "private"."published_listing" WITH ("security_invoker" = false) AS
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
    ("pg"."page" = 'locked') AS "page_locked",
    "i"."created_by"
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
        -- A shared drink (the catalog, or one credited to a bar or a person
        -- by our seeds) shows its card to everyone, never its spec.
        CASE WHEN "i"."bar_id" IS NULL AND "i"."created_by" IS NULL AND "i"."item_type" IN ('cocktail', 'beer', 'wine')
             THEN 'description'::"public"."item_publish_mode" END,
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

-- --- published_items ---

-- As 20261008810000_presentation_rls_speed.sql, plus is_shared.
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

-- --- drawings ---

-- Whether a drink's card shows to the public with its picture: listed, and not
-- on a Locked bar page. For item_sketches' anon policy (anon has no USAGE on
-- private).
CREATE FUNCTION "public"."is_card_public"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM private.published_listing l WHERE l.id = p_item_id AND NOT l.page_locked);
$$;

REVOKE EXECUTE ON FUNCTION "public"."is_card_public"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_card_public"("uuid") TO "anon", "authenticated", "service_role";

-- Only what the drawing needs; source, fingerprint and dates stay signed-in.
GRANT SELECT ("item_id", "inputs") ON "public"."item_sketches" TO "anon";
CREATE POLICY "item_sketches_select_public" ON "public"."item_sketches" FOR SELECT TO "anon"
    USING ("public"."is_card_public"("item_id"));
