-- Bar page visibility (Kevin's decision of 2026-10-07). Local stack only
-- until Kevin's OK.
--
-- An unclaimed bar's page works like a private Instagram account: its name,
-- place, logo, links, awards, people and menu history, and its drinks' names
-- with their credits and descriptions. Not the specs of the bar's own drinks:
-- no ingredients, amounts or methods. Once a bar claims its page, its Admins
-- choose:
--
--   locked       facts and drink names only (no descriptions, pictures or
--                specs)
--   description  names and descriptions; specs stay with the bar
--   open         full specs, still subject to each drink's publish level
--                (the default, so claiming a page shows what it showed before)
--
-- An unclaimed bar counts as 'description'.
--
-- "The bar's own drinks" are:
--   * its venue drinks (items.bar_id), which non-members only ever see through
--     published_items: a 'spec' drink is capped at 'description' below
--     'open', and 'locked' also drops the description, picture and creator;
--   * the shared drinks credited to it (bar_id NULL, origin_bar_profile_id
--     set, not a catalog classic and nobody's personal drink), like the
--     seeded signatures from The World's 50 Best and the press. Signed-in
--     users read these rows directly, so app_recipe_presentation and
--     item_methods stop returning their spec unless the page is open. Catalog
--     admins (who edit them) and the claimed bar's own team still see it.
-- Classics (is_catalog), personal drinks and other bars' drinks are unaffected.
--
-- Names, descriptions and credits stay readable, so search by name, ranking,
-- collecting and credit all keep working. drink_allergens already masks
-- ingredient names through app_recipe_presentation, so it still says
-- "contains eggs" without the spec.
--
-- Not covered here: items.notes on a credited shared drink. For some seeded
-- drinks it holds a one-line method and the spec's source; the app hides it
-- for a locked drink, but a signed-in user can still read the column. Moving
-- that text into a gated place is a follow-up.

CREATE TYPE "public"."bar_page_visibility" AS ENUM ('locked', 'description', 'open');

ALTER TABLE "public"."bars"
    ADD COLUMN "page_visibility" "public"."bar_page_visibility" DEFAULT 'open' NOT NULL;

-- Same rule as the bar's default publish mode: the publish permission (Admin
-- by default). The service role and SQL skip the check.
CREATE FUNCTION "private"."guard_bar_page_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.page_visibility IS NOT DISTINCT FROM OLD.page_visibility OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Changing who sees the bar''s page needs the publish permission.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_bar_page_visibility" BEFORE UPDATE OF "page_visibility" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_page_visibility"();

-- --- Reading the setting ---

-- A copy on the bar's profile, for its public page: bars are members-only, and
-- signed-out visitors read profiles column by column. NULL for a person.
-- Always worked out from the bar (an unclaimed one is 'description'), so
-- writing it directly changes nothing.
ALTER TABLE "public"."profiles" ADD COLUMN "page_visibility" "public"."bar_page_visibility";

CREATE FUNCTION "private"."set_profile_page_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.page_visibility := CASE WHEN NEW.kind = 'bar' THEN COALESCE(
        (SELECT b.page_visibility FROM public.bars b WHERE b.id = NEW.bar_id),
        'description'::public.bar_page_visibility)
    END;
    RETURN NEW;
END;
$$;

-- Also fires when a deleted bar's ON DELETE SET NULL unclaims its profile.
CREATE TRIGGER "set_profile_page_visibility" BEFORE INSERT OR UPDATE OF "bar_id", "kind", "page_visibility" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."set_profile_page_visibility"();

CREATE FUNCTION "private"."sync_bar_page_visibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.profiles SET page_visibility = NEW.page_visibility WHERE bar_id = NEW.id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "sync_bar_page_visibility" AFTER UPDATE OF "page_visibility" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."sync_bar_page_visibility"();

-- Fill the bars' profiles (the trigger works the value out).
UPDATE "public"."profiles" SET "page_visibility" = 'description' WHERE "kind" = 'bar';

-- Whether the caller is kept from this drink's spec by its bar's page: a
-- shared drink credited to a bar whose page isn't open, read by someone who
-- isn't a catalog admin or on that bar's team. False for everything else.
CREATE FUNCTION "public"."is_spec_locked"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.items i
    JOIN public.profiles p ON p.id = i.origin_bar_profile_id
    LEFT JOIN public.bars b ON b.id = p.bar_id
    WHERE i.id = p_item_id
      AND i.bar_id IS NULL AND NOT i.is_catalog AND i.created_by IS NULL
      AND COALESCE(b.page_visibility, 'description') <> 'open'
      AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid())
      AND (b.id IS NULL OR b.id NOT IN (SELECT private.my_bar_ids(0)))
  );
$$;

-- --- Methods ---

DROP POLICY "item_methods_select" ON "public"."item_methods";
CREATE POLICY "item_methods_select" ON "public"."item_methods" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items") AND NOT "public"."is_spec_locked"("item_id"));

-- --- The public projection ---

-- Same columns and order as 20260930500400. Two changes:
--   * publish_mode is capped by the bar's page: a 'spec' drink shows as
--     'description' unless the page is open, so its rows and ingredients stay
--     out of app_recipe_presentation and the reference set;
--   * a locked page also drops the description, the picture and the creator.
-- Inline, like the rest of the view: signed-out callers can't run private
-- helpers.
CREATE OR REPLACE VIEW "public"."published_items" WITH ("security_invoker" = false) AS
WITH "blocked" AS (
    SELECT "b"."blocked_id" AS "user_id" FROM "public"."user_blocks" "b" WHERE "b"."blocker_id" = "auth"."uid"()
    UNION
    SELECT "b"."blocker_id" FROM "public"."user_blocks" "b" WHERE "b"."blocked_id" = "auth"."uid"()
), "listed" AS (
    SELECT "i".*,
        CASE WHEN "eff"."mode" = 'spec' AND "pg"."page" <> 'open' THEN 'description'::"public"."item_publish_mode" ELSE "eff"."mode" END AS "effective_mode",
        "pg"."page" = 'locked' AS "page_locked"
    FROM "public"."items" "i"
    LEFT JOIN "public"."bars" "bar" ON "bar"."id" = "i"."bar_id"
    CROSS JOIN LATERAL (
        SELECT COALESCE(
            "i"."publish_mode",
            (SELECT max("m"."publish_mode")
               FROM "public"."menu_drinks" "md" JOIN "public"."menus" "m" ON "m"."id" = "md"."menu_id"
              WHERE "md"."item_id" = "i"."id" AND "m"."bar_id" = "i"."bar_id" AND "m"."publish_mode" IS NOT NULL),
            "bar"."default_publish_mode",
            'private'::"public"."item_publish_mode"
        ) AS "mode"
    ) "eff"
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN "i"."is_catalog" THEN 'open'::"public"."bar_page_visibility"
            WHEN "i"."bar_id" IS NOT NULL THEN "bar"."page_visibility"
            WHEN "i"."origin_bar_profile_id" IS NOT NULL AND "i"."created_by" IS NULL THEN COALESCE(
                (SELECT "ob"."page_visibility" FROM "public"."profiles" "op" JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
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
            WHERE "p"."bar_id" = "i"."bar_id" AND "p"."is_public" AND "p"."moderated_at" IS NULL
        )
        WHEN "i"."created_by" IS NOT NULL THEN EXISTS (
            SELECT 1 FROM "public"."profiles" "p"
            WHERE "p"."user_id" = "i"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL
        ) AND "i"."created_by" NOT IN (SELECT "user_id" FROM "blocked")
        ELSE true
      END
), "referenced" AS (
    SELECT "x"."id"
    FROM "listed" "l"
    CROSS JOIN LATERAL (VALUES ("l"."glassware_id"), ("l"."ice_id"), ("l"."family_id")) AS "x"("id")
    WHERE "x"."id" IS NOT NULL
    UNION
    SELECT "m"."method_item_id" FROM "public"."item_methods" "m" JOIN "listed" "l" ON "l"."id" = "m"."item_id"
    UNION
    SELECT COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
    FROM "public"."recipes" "r" JOIN "listed" "l" ON "l"."id" = "r"."recipe_item_id"
    WHERE "l"."effective_mode" = 'spec' AND COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id") IS NOT NULL
), "rows" AS (
    SELECT "l"."id", "l"."name", "l"."item_type", CASE WHEN "l"."page_locked" THEN NULL ELSE "l"."description" END AS "description", "l"."bar_id",
           "l"."glassware_id", "l"."ice_id", "l"."family_id", "l"."origin", "l"."abv",
           "l"."icon_key", "l"."icon_url", "l"."effective_mode" AS "publish_mode", "l"."published_at",
           "l"."riff_of_id", CASE WHEN "l"."page_locked" THEN NULL ELSE "l"."creator_profile_id" END AS "creator_profile_id",
           "l"."origin_bar_profile_id", "l"."origin_year", "l"."credit_status",
           false AS "is_reference", "l"."page_locked"
    FROM "listed" "l"
    UNION ALL
    SELECT "i"."id", "i"."name", "i"."item_type", NULL, NULL,
           NULL, NULL, NULL, NULL, NULL,
           "i"."icon_key", "i"."icon_url", 'private'::"public"."item_publish_mode", NULL,
           NULL, NULL, NULL, NULL, NULL,
           true, false
    FROM "public"."items" "i"
    WHERE "i"."id" IN (SELECT "id" FROM "referenced")
      AND "i"."id" NOT IN (SELECT "id" FROM "listed")
)
SELECT "rows"."id", "rows"."name", "rows"."item_type", "rows"."description", "rows"."bar_id",
       "rows"."glassware_id", "rows"."ice_id", "rows"."family_id", "rows"."origin", "rows"."abv",
       "rows"."icon_key", "rows"."icon_url", "rows"."publish_mode", "rows"."published_at",
       "rows"."riff_of_id", "rows"."creator_profile_id", "rows"."origin_bar_profile_id", "rows"."origin_year", "rows"."credit_status",
       "rows"."is_reference",
       CASE WHEN "rows"."page_locked" THEN NULL ELSE "img"."url" END AS "image_url",
       CASE WHEN "rows"."page_locked" THEN NULL ELSE "img"."is_generated" END AS "image_is_generated"
FROM "rows"
LEFT JOIN LATERAL (
    SELECT "im"."url", "ii"."is_generated"
    FROM "public"."item_images" "ii" JOIN "public"."images" "im" ON "im"."id" = "ii"."image_id"
    WHERE "ii"."item_id" = "rows"."id"
    ORDER BY ("ii"."angle" = 'hero') DESC, "ii"."sort_order" NULLS LAST, "ii"."created_at"
    LIMIT 1
) "img" ON true;

-- --- Spec rows ---

-- Same columns, order and types as 20261001120000. One change: a shared
-- drink credited to a bar ("op", "ob") only returns its rows to signed-in
-- users while the bar's page is open (an unclaimed bar's never is), or to
-- catalog admins and the bar's own team. The published branch ("ps") is
-- already capped by published_items.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" AS
 SELECT "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
        CASE
            WHEN ("c"."bar_id" IS NULL) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN "r"."ingredient_item_id"
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
            WHEN ("ps"."id" IS NOT NULL) THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
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
            WHEN ("c"."bar_id" IS NULL) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level")) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ub"."user_id" IS NOT NULL AND "public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level")) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
            WHEN ("ps"."id" IS NOT NULL) THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
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
   FROM ((((((("public"."recipes" "r"
     JOIN "public"."items" "c" ON (("r"."recipe_item_id" = "c"."id")))
     LEFT JOIN "public"."items" "s" ON (("s"."id" = "r"."ingredient_item_id")))
     LEFT JOIN "public"."bars" "b" ON (("c"."bar_id" = "b"."id")))
     LEFT JOIN "public"."user_bars" "ub" ON ((("ub"."bar_id" = "c"."bar_id") AND ("ub"."user_id" = "auth"."uid"())
        AND NOT EXISTS (
            SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"()
        ))))
     LEFT JOIN (
        SELECT "pi"."id" FROM "public"."published_items" "pi" WHERE "pi"."publish_mode" = 'spec' AND NOT "pi"."is_reference"
     ) "ps" ON (("ps"."id" = "c"."id")))
     LEFT JOIN "public"."profiles" "op" ON (("op"."id" = "c"."origin_bar_profile_id")
        AND "c"."bar_id" IS NULL AND NOT "c"."is_catalog" AND "c"."created_by" IS NULL))
     LEFT JOIN "public"."bars" "ob" ON (("ob"."id" = "op"."bar_id")))
  WHERE ((("auth"."uid"() IS NOT NULL)
    AND (("c"."bar_id" IS NULL
          AND ("c"."created_by" IS NULL
            OR "c"."item_type" NOT IN ('cocktail', 'beer', 'wine')
            OR "c"."created_by" = "auth"."uid"()
            OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"()))
          AND ("op"."id" IS NULL
            OR COALESCE("ob"."page_visibility", 'description') = 'open'
            OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
            OR EXISTS (
                SELECT 1 FROM "public"."user_bars" "tb"
                WHERE "tb"."bar_id" = "ob"."id" AND "tb"."user_id" = "auth"."uid"()
                  AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "tb"."venue_role_id" AND "vr"."ends_at" <= "now"())
            )))
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))))
    OR ("ps"."id" IS NOT NULL));

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."guard_bar_page_visibility"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."set_profile_page_visibility"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."sync_bar_page_visibility"() FROM PUBLIC, "anon", "authenticated";
-- Signed-out visitors read profiles column by column (20261006120000).
GRANT SELECT ("page_visibility") ON "public"."profiles" TO "anon";
REVOKE EXECUTE ON FUNCTION "public"."is_spec_locked"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_spec_locked"("uuid") TO "anon", "authenticated", "service_role";
