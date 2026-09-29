-- DRAFT (docs/publishing_moderation_proposal.md, section 5). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- Kevin's decisions of 2026-09-29, on top of the publishing draft:
--
-- 1. Layered publishing. A drink's publish mode is now the first of:
--      the drink's own setting (items.publish_mode; NULL means "inherit"),
--      the most open setting among its own bar's menus that set one
--        (menus.publish_mode; NULL means "inherit"),
--      the bar's default (bars.default_publish_mode, 'private' unless set),
--      'private'.
--    So a bar can be open by default, keep one menu closed, and still keep a
--    single drink private. It works "down to the ingredient" too: a bar's
--    house-made ingredient follows the same rule, and its own recipe is only
--    public when its effective mode is 'spec'. A drink's published spec still
--    names the ingredient either way.
--    A menu only publishes its own bar's drinks. A person's own drinks and the
--    shared catalogue have no bar or menus, so only their own setting counts.
--
-- 2. Memories. A collected drink keeps what the collector had: its name, the
--    bar, the picture, when they had it and their note. If the bar unpublishes
--    the drink (or deletes it), the row stays as a memory without the spec,
--    which only ever comes from the live, published drink.
--
-- 3. Personal drinks are private to their creator until published. A
--    person's own cocktail, beer or wine (no bar, created_by set) is readable
--    by its creator, catalog admins, and, once published, the public paths.
--    Ingredients people add stay shared: other people's recipes use them.

-- --- 1. Layered publishing ---

ALTER TABLE "public"."items"
    ALTER COLUMN "publish_mode" DROP NOT NULL,
    ALTER COLUMN "publish_mode" SET DEFAULT NULL;

-- 'private' was the old default; NULL now inherits, which for every drink
-- today (no bar or menu is open yet) still means private.
UPDATE "public"."items" SET "publish_mode" = NULL WHERE "publish_mode" = 'private';

ALTER TABLE "public"."bars"
    ADD COLUMN "default_publish_mode" "public"."item_publish_mode" DEFAULT 'private' NOT NULL;

ALTER TABLE "public"."menus"
    ADD COLUMN "publish_mode" "public"."item_publish_mode";

CREATE INDEX "menus_publish_mode_idx" ON "public"."menus" ("bar_id") WHERE "publish_mode" IS NOT NULL;

-- The effective mode of one drink, for triggers and policies. published_items
-- works the same thing out inline, because a view can't lean on private
-- helpers for signed-out callers.
CREATE FUNCTION "private"."effective_publish_mode"("p_item_id" "uuid") RETURNS "public"."item_publish_mode"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    i.publish_mode,
    (SELECT max(m.publish_mode)
       FROM public.menu_drinks md JOIN public.menus m ON m.id = md.menu_id
      WHERE md.item_id = i.id AND m.bar_id = i.bar_id AND m.publish_mode IS NOT NULL),
    b.default_publish_mode,
    'private'::public.item_publish_mode)
  FROM public.items i LEFT JOIN public.bars b ON b.id = i.bar_id
  WHERE i.id = p_item_id;
$$;

REVOKE EXECUTE ON FUNCTION "private"."effective_publish_mode"("uuid") FROM PUBLIC, "anon";

-- A drink's own setting: who may change it is as before. NULL (inherit) and
-- 'private' need no public profile; opening a drink up does.
CREATE OR REPLACE FUNCTION "private"."guard_item_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF COALESCE(NEW.publish_mode, 'private') = 'private' THEN
        NEW.published_at := NULL;
    ELSIF TG_OP = 'INSERT' OR COALESCE(OLD.publish_mode, 'private') = 'private' THEN
        NEW.published_at := now();
    END IF;

    IF TG_OP = 'INSERT' AND NEW.publish_mode IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.publish_mode IS NOT DISTINCT FROM OLD.publish_mode
       AND (NEW.publish_mode = 'private' OR NEW.bar_id IS NOT DISTINCT FROM OLD.bar_id) THEN
        RETURN NEW;
    END IF;
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.bar_id IS NOT NULL THEN
        IF NEW.bar_id NOT IN (SELECT private.bars_with_capability('publish')) THEN
            RAISE EXCEPTION 'Publishing a bar''s drinks needs the publish permission at that bar.';
        END IF;
        IF NEW.publish_mode IN ('description', 'spec') AND NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.bar_id = NEW.bar_id AND p.is_public AND p.moderated_at IS NULL
        ) THEN
            RAISE EXCEPTION 'The bar needs a public profile before it can publish drinks.';
        END IF;
    ELSIF NEW.created_by IS NOT NULL THEN
        IF NEW.created_by <> auth.uid() AND NOT private.is_app_admin() THEN
            RAISE EXCEPTION 'Only the creator can publish their own drink.';
        END IF;
        IF NEW.publish_mode IN ('description', 'spec') AND NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = NEW.created_by AND p.is_public AND p.moderated_at IS NULL
        ) THEN
            RAISE EXCEPTION 'You need a public profile before you can publish drinks.';
        END IF;
    ELSIF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only catalog admins publish shared catalogue drinks.';
    END IF;

    RETURN NEW;
END;
$$;

-- The bar's default and a menu's setting reach many drinks at once, so they
-- need the same publish permission, and opening up needs a public profile.
CREATE FUNCTION "private"."guard_bar_publish_default"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.default_publish_mode IS NOT DISTINCT FROM OLD.default_publish_mode OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Changing what the bar publishes needs the publish permission.';
    END IF;
    IF NEW.default_publish_mode <> 'private' AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.bar_id = NEW.id AND p.is_public AND p.moderated_at IS NULL
    ) THEN
        RAISE EXCEPTION 'The bar needs a public profile before it can publish drinks.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_bar_publish_default" BEFORE UPDATE OF "default_publish_mode" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_bar_publish_default"();

CREATE FUNCTION "private"."guard_menu_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.publish_mode IS NULL)
       OR (TG_OP = 'UPDATE' AND NEW.publish_mode IS NOT DISTINCT FROM OLD.publish_mode AND NEW.bar_id IS NOT DISTINCT FROM OLD.bar_id)
       OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.publish_mode IS NOT NULL AND NEW.bar_id IS NULL THEN
        RAISE EXCEPTION 'Only a bar''s menus can be published.';
    END IF;
    IF NEW.bar_id NOT IN (SELECT private.bars_with_capability('publish')) THEN
        RAISE EXCEPTION 'Publishing a menu needs the publish permission at its bar.';
    END IF;
    IF NEW.publish_mode IN ('description', 'spec') AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.bar_id = NEW.bar_id AND p.is_public AND p.moderated_at IS NULL
    ) THEN
        RAISE EXCEPTION 'The bar needs a public profile before it can publish a menu.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_menu_publish" BEFORE INSERT OR UPDATE OF "publish_mode", "bar_id" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_publish"();

-- Releases hold published drinks, whatever made them published.
CREATE OR REPLACE FUNCTION "private"."guard_release_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.published_at IS NULL
       OR (TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL AND NEW.bar_id = OLD.bar_id) THEN
        RETURN NEW;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.bar_id = NEW.bar_id AND p.is_public AND p.moderated_at IS NULL
    ) THEN
        RAISE EXCEPTION 'The bar needs a public profile before it can publish a release.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.release_items ri WHERE ri.release_id = NEW.id) THEN
        RAISE EXCEPTION 'Add at least one drink before publishing the release.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.release_items ri
        WHERE ri.release_id = NEW.id AND private.effective_publish_mode(ri.item_id) = 'private'
    ) THEN
        RAISE EXCEPTION 'Every drink in a release must be published (menu description or full spec) first.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "private"."guard_release_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.releases r WHERE r.id = NEW.release_id AND r.published_at IS NOT NULL)
       AND private.effective_publish_mode(NEW.item_id) = 'private' THEN
        RAISE EXCEPTION 'Publish the drink before adding it to a published release.';
    END IF;
    RETURN NEW;
END;
$$;

-- The public projection, now on the effective mode. Same columns and order as
-- 20260930500100; publish_mode is the effective one.
CREATE OR REPLACE VIEW "public"."published_items" WITH ("security_invoker" = false) AS
WITH "blocked" AS (
    SELECT "b"."blocked_id" AS "user_id" FROM "public"."user_blocks" "b" WHERE "b"."blocker_id" = "auth"."uid"()
    UNION
    SELECT "b"."blocker_id" FROM "public"."user_blocks" "b" WHERE "b"."blocked_id" = "auth"."uid"()
), "listed" AS (
    SELECT "i".*, "eff"."mode" AS "effective_mode"
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
    SELECT "l"."id", "l"."name", "l"."item_type", "l"."description", "l"."bar_id",
           "l"."glassware_id", "l"."ice_id", "l"."family_id", "l"."origin", "l"."abv",
           "l"."icon_key", "l"."icon_url", "l"."effective_mode" AS "publish_mode", "l"."published_at",
           "l"."riff_of_id", "l"."creator_profile_id", "l"."origin_bar_profile_id", "l"."origin_year", "l"."credit_status",
           false AS "is_reference"
    FROM "listed" "l"
    UNION ALL
    SELECT "i"."id", "i"."name", "i"."item_type", NULL, NULL,
           NULL, NULL, NULL, NULL, NULL,
           "i"."icon_key", "i"."icon_url", 'private'::"public"."item_publish_mode", NULL,
           NULL, NULL, NULL, NULL, NULL,
           true
    FROM "public"."items" "i"
    WHERE "i"."id" IN (SELECT "id" FROM "referenced")
      AND "i"."id" NOT IN (SELECT "id" FROM "listed")
)
SELECT "rows".*, "img"."url" AS "image_url", "img"."is_generated" AS "image_is_generated"
FROM "rows"
LEFT JOIN LATERAL (
    SELECT "im"."url", "ii"."is_generated"
    FROM "public"."item_images" "ii" JOIN "public"."images" "im" ON "im"."id" = "ii"."image_id"
    WHERE "ii"."item_id" = "rows"."id"
    ORDER BY ("ii"."angle" = 'hero') DESC, "ii"."sort_order" NULLS LAST, "ii"."created_at"
    LIMIT 1
) "img" ON true;

-- --- 3. Personal drinks are private until published ---

-- Signed in: a venue's items by role, as before; items with no bar are
-- shared, except a person's own cocktail, beer or wine, which only its
-- creator, catalog admins and (once published) everyone else can read.
DROP POLICY "items_select" ON "public"."items";
CREATE POLICY "items_select" ON "public"."items" FOR SELECT TO "authenticated"
    USING (
        CASE
            WHEN "bar_id" IS NOT NULL THEN "private"."can_view_bar_item"("bar_id", "override_visibility_level")
            WHEN "created_by" IS NULL OR "item_type" NOT IN ('cocktail', 'beer', 'wine') THEN true
            ELSE "created_by" = (SELECT "auth"."uid"())
                OR "publish_mode" IN ('description', 'spec')
                OR "private"."is_app_admin"()
        END
    );

-- The same rule for specs: the view runs as its owner, so it has to apply it
-- itself. Same columns, order and types as 20260930500100; only the WHERE
-- clause changes, for items with no bar.
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
    "r"."sort_order"
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

-- --- 2. Memories ---

-- A collected drink keeps its own copy of what the collector saw, and
-- outlives the drink going private or being deleted.
ALTER TABLE "public"."collected_items" DROP CONSTRAINT "collected_items_pkey";
ALTER TABLE "public"."collected_items" DROP CONSTRAINT "collected_items_item_id_fkey";
ALTER TABLE "public"."collected_items"
    ADD COLUMN "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    ALTER COLUMN "item_id" DROP NOT NULL,
    ADD CONSTRAINT "collected_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "collected_items_once" UNIQUE ("user_id", "item_id"),
    -- The memory: filled in when collected, from the published drink.
    ADD COLUMN "name" "text",
    ADD COLUMN "bar_name" "text",
    ADD COLUMN "image_url" "text",
    -- The collector's own: when they had it, and a note.
    ADD COLUMN "had_on" "date",
    ADD COLUMN "note" "text" CHECK (char_length("note") <= 1000);

CREATE FUNCTION "private"."fill_collected_memory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    SELECT p.name, p.image_url,
           COALESCE(bp.display_name, b.name, cp.display_name)
      INTO NEW.name, NEW.image_url, NEW.bar_name
      FROM public.published_items p
      LEFT JOIN public.items i ON i.id = p.id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.is_public
      LEFT JOIN public.profiles cp ON cp.user_id = i.created_by AND cp.is_public
     WHERE p.id = NEW.item_id AND NOT p.is_reference
     LIMIT 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "fill_collected_memory" BEFORE INSERT ON "public"."collected_items"
    FOR EACH ROW EXECUTE FUNCTION "private"."fill_collected_memory"();

REVOKE EXECUTE ON FUNCTION "private"."fill_collected_memory"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_bar_publish_default"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_menu_publish"() FROM PUBLIC, "anon", "authenticated";

-- Collectors can add when they had it and a note, and nothing else.
REVOKE UPDATE ON "public"."collected_items" FROM "authenticated";
GRANT UPDATE ("had_on", "note") ON "public"."collected_items" TO "authenticated";
CREATE POLICY "collected_items_update_own" ON "public"."collected_items" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));
