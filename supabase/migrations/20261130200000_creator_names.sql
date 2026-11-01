-- A drink can credit the people who made it by name when they have no page.
--
-- items.creator_names: the makers typed as plain names ("Harry Craddock"),
-- for people who don't use the app and have no profile, classics above all
-- (Eddie, tf-063). Shown in the drink's credit after the makers with a page
-- (creator_profile_id, item_co_creators), with no link and no claim. A
-- person with a page is credited through it, never by name too: the app
-- only saves names nobody picked from the search.
--
-- published_items gains creator_names as its last column, so the signed-out
-- drink page (app/d/[id].tsx) credits them too; null on a locked page, as
-- creator_profile_id is. Otherwise the view is 20261125300000's, unchanged.
--
-- set_drink_credits(item, creator, names, add, remove) makes one change to a
-- saved drink's credit from the drink editor, all or nothing: the creator
-- and the names on the drink, then the made-with rows to take off and add.
-- SECURITY INVOKER, so the items and item_co_creators policies and the
-- guard triggers apply as if each were written directly: an added person is
-- asked first (guard_item_co_creator), a declined row can't be taken off by
-- an editor, and the credit's status is checked (guard_item_credit). A new
-- creator starts as suggested: the old status (claimed, verified) belonged
-- to the old creator, so it's never carried over.
--
-- Up to five names, each 1 to 80 characters. Null when there are none. The
-- items RLS policies cover the column like every other: whoever can write
-- the drink can write its names, and whoever can read the drink can read them.
ALTER TABLE public.items ADD COLUMN creator_names text[];

-- Each name trimmed, 1 to 80 characters (a CHECK can't hold a subquery).
CREATE FUNCTION private.names_fit(p_names text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  SELECT coalesce(bool_and(n = btrim(n) AND char_length(n) BETWEEN 1 AND 80), true)
    FROM unnest(p_names) n;
$$;
REVOKE EXECUTE ON FUNCTION private.names_fit(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.names_fit(text[]) TO authenticated, service_role;

ALTER TABLE public.items ADD CONSTRAINT items_creator_names_check CHECK (
  creator_names IS NULL
  OR (cardinality(creator_names) BETWEEN 1 AND 5
      AND array_position(creator_names, NULL) IS NULL
      AND private.names_fit(creator_names))
);

-- --- One change to a drink's credit ---

CREATE FUNCTION public.set_drink_credits(p_item_id uuid, p_creator_profile_id uuid, p_creator_names text[], p_add uuid[], p_remove uuid[])
RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.items
     SET creator_profile_id = p_creator_profile_id,
         creator_names = nullif(p_creator_names, '{}'),
         credit_status = CASE WHEN creator_profile_id IS DISTINCT FROM p_creator_profile_id THEN NULL ELSE credit_status END
   WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can''t change who made this drink.' USING ERRCODE = '42501';
  END IF;
  IF cardinality(p_remove) > 0 THEN
    DELETE FROM public.item_co_creators WHERE item_id = p_item_id AND profile_id = ANY (p_remove);
  END IF;
  IF cardinality(p_add) > 0 THEN
    INSERT INTO public.item_co_creators (item_id, profile_id) SELECT p_item_id, unnest(p_add);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_drink_credits(uuid, uuid, text[], uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_drink_credits(uuid, uuid, text[], uuid[], uuid[]) TO authenticated, service_role;

-- --- published_items ---

-- As 20261125300000_public_parts_and_credit_places.sql, with creator_names.
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
    "rows"."parts",
    "rows"."creator_names"
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
        CASE WHEN "l"."effective_mode" = 'spec' THEN (SELECT "pi"."parts" FROM "public"."items" "pi" WHERE "pi"."id" = "l"."id") END AS "parts",
        -- Makers with no page, by name: hidden with the rest of the credit on a locked page.
        CASE WHEN "l"."page_locked" THEN NULL::"text"[] ELSE (SELECT "pc"."creator_names" FROM "public"."items" "pc" WHERE "pc"."id" = "l"."id") END AS "creator_names"
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
        NULL::"jsonb",
        NULL::"text"[]
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
