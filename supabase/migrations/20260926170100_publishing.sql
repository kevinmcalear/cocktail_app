-- DRAFT (docs/publishing_moderation_proposal.md, sections 1 and 2). Local stack
-- only. Not applied to production; needs Kevin's review first.
--
-- Publishing: the level below Guest.
--
--   items.publish_mode  per drink: 'private' (default, today's behaviour),
--                       'description' (the public sees the menu card: name,
--                       description, glass, picture, credit) or 'spec' (the
--                       public also sees the spec: ingredients at the generic
--                       level, amounts and units). Changing it needs the bar's
--                       'publish' capability (Admin by default).
--   releases            a named, dated set of a bar's drinks ("Autumn
--                       release"). A draft until published_at; public once
--                       published_at has passed, so a release can be scheduled.
--   release_items       the drinks in a release. Every drink in a live release
--                       must be published.
--   published_items     the public projection of published drinks, and of the
--                       glass, ice, family, methods and spec ingredients they
--                       use (names and pictures only). Readable signed out.
--                       Never exposes bartender notes, price, status or the
--                       role overrides.
--   app_recipe_presentation
--                       also returns a 'spec' drink's rows to everyone,
--                       signed out included, at the public level. A
--                       'description' drink's rows stay members-only.
--   published_ingredient(app_recipe_presentation)
--                       the computed relationship non-members use to name a
--                       spec's ingredients (display_ingredient goes through
--                       the items policy, which they don't pass).
--
-- Nothing here changes what members see: items_select, can_view_bar_item()
-- and the role levels are untouched. Publishing adds a second, public read
-- path beside them, and it only ever adds: a Guest who can't see a drink
-- through their role can still see it once it's published, like anyone.

CREATE TYPE "public"."item_publish_mode" AS ENUM ('private', 'description', 'spec');

ALTER TABLE "public"."items"
    ADD COLUMN "publish_mode" "public"."item_publish_mode" DEFAULT 'private' NOT NULL,
    -- When it last went from private to public. NULL while private.
    ADD COLUMN "published_at" timestamp with time zone,
    -- Lets release_items require a drink from the release's own bar.
    ADD CONSTRAINT "items_id_bar_id_key" UNIQUE ("id", "bar_id");

CREATE INDEX "items_published_idx" ON "public"."items" ("publish_mode") WHERE "publish_mode" <> 'private';

-- Who may change a drink's publish mode, and what it needs first:
--   * a bar's drink: the 'publish' capability at that bar, and a public bar
--     profile to credit it to;
--   * a person's own drink (no bar): its creator, with a public profile;
--   * a shared catalogue drink (no bar, no creator): catalog admins, who are
--     already the only people items_update lets edit it.
-- The service role and SQL (no user) skip the checks. published_at follows.
CREATE FUNCTION "private"."guard_item_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.publish_mode = 'private' THEN
        NEW.published_at := NULL;
    ELSIF TG_OP = 'INSERT' OR OLD.publish_mode = 'private' THEN
        NEW.published_at := now();
    END IF;

    IF TG_OP = 'INSERT' AND NEW.publish_mode = 'private' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.publish_mode = OLD.publish_mode
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
        IF NEW.publish_mode <> 'private' AND NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.bar_id = NEW.bar_id AND p.is_public AND p.moderated_at IS NULL
        ) THEN
            RAISE EXCEPTION 'The bar needs a public profile before it can publish drinks.';
        END IF;
    ELSIF NEW.created_by IS NOT NULL THEN
        IF NEW.created_by <> auth.uid() AND NOT private.is_app_admin() THEN
            RAISE EXCEPTION 'Only the creator can publish their own drink.';
        END IF;
        IF NEW.publish_mode <> 'private' AND NOT EXISTS (
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

CREATE TRIGGER "guard_item_publish" BEFORE INSERT OR UPDATE OF "publish_mode", "bar_id" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_publish"();

-- --- Releases ---

CREATE TABLE "public"."releases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- "Autumn release"
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
    "description" "text" CHECK (char_length("description") <= 1000),
    "cover_url" "text",
    -- The date the release is known by ("Autumn release, 1 March").
    "release_date" "date" NOT NULL,
    -- NULL: a draft. Public from this moment, so a release can be scheduled.
    "published_at" timestamp with time zone,
    "moderated_at" timestamp with time zone,
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("id", "bar_id")
);

CREATE INDEX "releases_bar_id_idx" ON "public"."releases" ("bar_id", "release_date" DESC);
CREATE INDEX "releases_live_idx" ON "public"."releases" ("published_at" DESC) WHERE "published_at" IS NOT NULL;

CREATE TABLE "public"."release_items" (
    "release_id" "uuid" NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    PRIMARY KEY ("release_id", "item_id"),
    -- The release and the drink both belong to the same bar.
    FOREIGN KEY ("release_id", "bar_id") REFERENCES "public"."releases"("id", "bar_id") ON DELETE CASCADE,
    FOREIGN KEY ("item_id", "bar_id") REFERENCES "public"."items"("id", "bar_id") ON DELETE CASCADE
);

CREATE INDEX "release_items_item_id_idx" ON "public"."release_items" ("item_id");

CREATE TRIGGER "guard_moderated_at" BEFORE INSERT OR UPDATE OF "moderated_at" ON "public"."releases"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_moderated_at"();

-- Publishing a release needs a public bar profile, at least one drink, and
-- every drink in it published. Applies to everyone, service role included.
CREATE FUNCTION "private"."guard_release_publish"() RETURNS "trigger"
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
        SELECT 1 FROM public.release_items ri JOIN public.items i ON i.id = ri.item_id
        WHERE ri.release_id = NEW.id AND i.publish_mode = 'private'
    ) THEN
        RAISE EXCEPTION 'Every drink in a release must be published (menu description or full spec) first.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_release_publish" BEFORE INSERT OR UPDATE OF "published_at", "bar_id" ON "public"."releases"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_release_publish"();

-- A drink added to a release that's already published must be published too.
CREATE FUNCTION "private"."guard_release_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.releases r WHERE r.id = NEW.release_id AND r.published_at IS NOT NULL)
       AND EXISTS (SELECT 1 FROM public.items i WHERE i.id = NEW.item_id AND i.publish_mode = 'private') THEN
        RAISE EXCEPTION 'Publish the drink before adding it to a published release.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_release_item" BEFORE INSERT OR UPDATE ON "public"."release_items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_release_item"();

-- --- The public projection ---

-- Runs as its owner, like app_recipe_presentation, so it can read items the
-- caller can't and return only the public columns. Everything it needs is
-- inline (no private helpers), so signed-out callers need no extra grants.
--
-- A published drink is listed while it isn't moderated, its bar (or, for a
-- person's own drink, its creator) has a public, unmoderated profile, and, for
-- a person's own drink, the caller hasn't blocked its creator or been blocked
-- by them. Referenced rows (is_reference) carry only a name and a picture.
--
-- ponytail: the reference set is worked out per query from every published
-- drink. Fine at hundreds of drinks; at tens of thousands, keep it in a table
-- maintained by triggers (or a materialized view refreshed by pg_cron).
CREATE VIEW "public"."published_items" WITH ("security_invoker" = false) AS
WITH "blocked" AS (
    SELECT "b"."blocked_id" AS "user_id" FROM "public"."user_blocks" "b" WHERE "b"."blocker_id" = "auth"."uid"()
    UNION
    SELECT "b"."blocker_id" FROM "public"."user_blocks" "b" WHERE "b"."blocked_id" = "auth"."uid"()
), "listed" AS (
    SELECT "i".*
    FROM "public"."items" "i"
    WHERE "i"."publish_mode" <> 'private'
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
    -- The ingredient a spec shows at the public level: the generic one when
    -- the row has it (see app_recipe_presentation below).
    SELECT COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id")
    FROM "public"."recipes" "r" JOIN "listed" "l" ON "l"."id" = "r"."recipe_item_id"
    WHERE "l"."publish_mode" = 'spec' AND COALESCE("r"."parent_ingredient_id", "r"."ingredient_item_id") IS NOT NULL
), "rows" AS (
    SELECT "l"."id", "l"."name", "l"."item_type", "l"."description", "l"."bar_id",
           "l"."glassware_id", "l"."ice_id", "l"."family_id", "l"."origin", "l"."abv",
           "l"."icon_key", "l"."icon_url", "l"."publish_mode", "l"."published_at",
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

REVOKE ALL ON "public"."published_items" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."published_items" TO "anon", "authenticated", "service_role";

-- The ingredient behind a recipe row, for callers who read the spec through
-- publishing rather than membership. Runs as the caller; published_items does
-- the filtering. Embed as `ingredient:published_ingredient(id, name, ...)`.
CREATE FUNCTION "public"."published_ingredient"("public"."app_recipe_presentation") RETURNS SETOF "public"."published_items"
    LANGUAGE "sql" STABLE ROWS 1
    SET "search_path" TO ''
    AS $$
  SELECT * FROM public.published_items WHERE id = $1.display_ingredient_id;
$$;

REVOKE ALL ON FUNCTION "public"."published_ingredient"("public"."app_recipe_presentation") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."published_ingredient"("public"."app_recipe_presentation") TO "anon", "authenticated", "service_role";

-- --- app_recipe_presentation: spec rows for everyone ---

-- Same columns, order and types as the venue roles version (20260926000100).
-- Two changes:
--   * the member branches now also require a membership row (ub.user_id IS
--     NOT NULL). For rows the view returned before, that always held, so
--     members see exactly what they saw;
--   * a drink published with its full spec ("ps" below) is returned to
--     everyone, signed out included, at the public level: generic
--     ingredient, amount and unit. Preparation notes and the specific brand
--     stay at the bar's own levels. A member whose role shows more still gets
--     more, from the branches above it.
-- A 'description' drink isn't in "ps", so its rows stay members-only.
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
    AND (("c"."bar_id" IS NULL)
      OR (("ub"."user_id" IS NOT NULL)
        AND ("public"."effective_bar_role"("ub"."role_level") >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level")))))
    OR ("ps"."id" IS NOT NULL));

ALTER VIEW "public"."app_recipe_presentation" SET ("security_invoker" = false);

-- Signed-out visitors can now read it; the WHERE clause gives them only
-- published specs.
GRANT SELECT ON "public"."app_recipe_presentation" TO "anon";

-- --- Policies ---

ALTER TABLE "public"."releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."release_items" ENABLE ROW LEVEL SECURITY;

-- Live releases are public, signed in or not. Drafts, scheduled ones and
-- moderated ones are for the bar's publishers.
CREATE POLICY "releases_select_live" ON "public"."releases" FOR SELECT TO "anon", "authenticated"
    USING ("published_at" <= "now"() AND "moderated_at" IS NULL);
CREATE POLICY "releases_select_publishers" ON "public"."releases" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')));
CREATE POLICY "releases_insert" ON "public"."releases" FOR INSERT TO "authenticated"
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')));
CREATE POLICY "releases_update" ON "public"."releases" FOR UPDATE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')));
CREATE POLICY "releases_delete" ON "public"."releases" FOR DELETE TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')));

-- A live release's drink list is public. It only holds ids; what the public
-- sees of each drink comes from published_items, which leaves out any drink
-- unpublished since.
CREATE POLICY "release_items_select_live" ON "public"."release_items" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (
        SELECT 1 FROM "public"."releases" "r"
        WHERE "r"."id" = "release_id" AND "r"."published_at" <= "now"() AND "r"."moderated_at" IS NULL
    ));
CREATE POLICY "release_items_publishers" ON "public"."release_items" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('publish')));

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."guard_item_publish"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_release_publish"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."guard_release_item"() FROM PUBLIC, "anon", "authenticated";
