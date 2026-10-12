-- DRAFT. Local stack only. Not applied to production; needs Kevin's review
-- (the human-approved label) first.
--
-- Menus, as the whole-app canvas draws them (decisions b23 and b15, 10 Oct):
--
-- 1. When a menu was last edited (updated_at), for the drafts' amber
--    "1 section short · edited yesterday" line. Any change to the menu's own
--    fields, its sections or its drinks moves it; the five-minute sweep that
--    flips is_active does not.
-- 2. A short description ("a control and three trials"), mostly for R&D.
-- 3. A planned run on a draft (planned_starts_at, planned_ends_at): New
--    menu's third step picks the dates, or one night ("Friday 31 October,
--    from 6 pm"), without putting the menu on. Go live starts from the plan.
--    A plan never changes what a menu is: with no starts_at it stays a draft.
-- 4. A venue's one-night menu can be shared with a link without going live.
--    Until now shared_at was always NULL for a bar's menu. Now a bar's menu
--    may be shared when it is a menu (not R&D) whose night is set, planned or
--    scheduled, and lasts a day at most, and the venue has a public page.
--    Anyone who may edit the menu (menus_update) may share it. Other venue
--    menus still only go live. shared_menu() shows a venue's menu under the
--    venue's public page; drinks the venue hasn't published stay blank, as
--    for home menus. Moving a menu to another bar still stops sharing it.

ALTER TABLE "public"."menus"
    ADD COLUMN "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    ADD COLUMN "description" "text" CHECK ("description" IS NULL OR "char_length"("description") <= 280),
    ADD COLUMN "planned_starts_at" timestamp with time zone,
    ADD COLUMN "planned_ends_at" timestamp with time zone,
    ADD CONSTRAINT "menus_planned_check" CHECK ("planned_starts_at" IS NULL OR "planned_ends_at" IS NULL OR "planned_ends_at" > "planned_starts_at");

COMMENT ON COLUMN "public"."menus"."updated_at" IS 'Last edit to the menu, its sections or its drinks (server set).';
COMMENT ON COLUMN "public"."menus"."description" IS 'A short note on the menu, like what an R&D collection is for.';
COMMENT ON COLUMN "public"."menus"."planned_starts_at" IS 'A draft''s planned start (New menu''s dates step). Not live until starts_at is set.';
COMMENT ON COLUMN "public"."menus"."planned_ends_at" IS 'A draft''s planned end; a one-night menu ends the next morning.';

-- The best date we have for menus made before this.
UPDATE "public"."menus" SET "updated_at" = "created_at";

-- --- Edited when ---

CREATE FUNCTION "private"."touch_menu"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Named to sort before menus_sync_active: BEFORE triggers fire in name order, and
-- this one must see only what the caller changed. A bare is_active flip makes
-- menus_sync_active move the dates to match; that is the sweep, not an edit.
CREATE TRIGGER "menus_edited_at" BEFORE UPDATE ON "public"."menus"
    FOR EACH ROW
    WHEN ((OLD."name", OLD."cover_url", OLD."cover_position", OLD."starts_at", OLD."ends_at", OLD."menu_date", OLD."guest_count",
           OLD."kind", OLD."description", OLD."planned_starts_at", OLD."planned_ends_at", OLD."bar_id")
          IS DISTINCT FROM
          (NEW."name", NEW."cover_url", NEW."cover_position", NEW."starts_at", NEW."ends_at", NEW."menu_date", NEW."guest_count",
           NEW."kind", NEW."description", NEW."planned_starts_at", NEW."planned_ends_at", NEW."bar_id"))
    EXECUTE FUNCTION "private"."touch_menu"();

-- A section or a drink changed: its menu was edited. Once per statement (a
-- save replaces every section), as the person editing, who may edit the menu.
CREATE FUNCTION "private"."touch_menus_of_rows"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.menus SET updated_at = now()
     WHERE id IN (SELECT DISTINCT changed.menu_id FROM changed WHERE changed.menu_id IS NOT NULL);
    RETURN NULL;
END;
$$;

CREATE TRIGGER "touch_menu_ins" AFTER INSERT ON "public"."menu_sections"
    REFERENCING NEW TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();
CREATE TRIGGER "touch_menu_upd" AFTER UPDATE ON "public"."menu_sections"
    REFERENCING NEW TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();
CREATE TRIGGER "touch_menu_del" AFTER DELETE ON "public"."menu_sections"
    REFERENCING OLD TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();
CREATE TRIGGER "touch_menu_ins" AFTER INSERT ON "public"."menu_drinks"
    REFERENCING NEW TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();
CREATE TRIGGER "touch_menu_upd" AFTER UPDATE ON "public"."menu_drinks"
    REFERENCING NEW TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();
CREATE TRIGGER "touch_menu_del" AFTER DELETE ON "public"."menu_drinks"
    REFERENCING OLD TABLE AS "changed" FOR EACH STATEMENT EXECUTE FUNCTION "private"."touch_menus_of_rows"();

REVOKE EXECUTE ON FUNCTION "private"."touch_menu"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."touch_menus_of_rows"() FROM PUBLIC, "anon", "authenticated";

-- --- Sharing a venue's one-night menu ---

-- A night: a start and an end at most a day apart.
CREATE FUNCTION "private"."is_one_night"("p_starts" timestamp with time zone, "p_ends" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_starts IS NOT NULL AND p_ends IS NOT NULL AND p_ends > p_starts AND p_ends - p_starts <= interval '1 day';
$$;

CREATE OR REPLACE FUNCTION "private"."guard_menu_share"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.shared_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.bar_id IS DISTINCT FROM NEW.bar_id) THEN
        NEW.shared_at := NULL;
        RETURN NEW;
    END IF;
    -- A bar's menu: only a one-night menu, and only while its night is set.
    IF NEW.bar_id IS NOT NULL AND NOT (
        NEW.kind = 'menu'
        AND private.is_one_night(COALESCE(NEW.starts_at, NEW.planned_starts_at), COALESCE(NEW.ends_at, NEW.planned_ends_at))
    ) THEN
        NEW.shared_at := NULL;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.shared_at IS NOT NULL THEN
        NEW.shared_at := OLD.shared_at;
        RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL THEN
        IF NEW.bar_id IS NULL THEN
            IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
                RAISE EXCEPTION 'Only the person who made a menu can share it.' USING ERRCODE = '42501';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.user_id = NEW.created_by AND p.is_public AND p.moderated_at IS NULL
            ) THEN
                RAISE EXCEPTION 'You need a public profile before you can share a menu.';
            END IF;
        ELSIF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.bar_id = NEW.bar_id AND p.is_public AND p.moderated_at IS NULL
        ) THEN
            RAISE EXCEPTION 'The venue needs a public page before it can share a menu.';
        END IF;
    END IF;
    NEW.shared_at := now();
    RETURN NEW;
END;
$$;

-- Also re-checked when the night or the kind changes: a night stretched past
-- a day, or a menu filed under R&D, stops being shared.
DROP TRIGGER "guard_menu_share" ON "public"."menus";
CREATE TRIGGER "guard_menu_share" BEFORE INSERT OR UPDATE OF "shared_at", "bar_id", "kind", "starts_at", "ends_at", "planned_starts_at", "planned_ends_at" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_share"();

REVOKE EXECUTE ON FUNCTION "private"."guard_menu_share"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."is_one_night"(timestamp with time zone, timestamp with time zone) FROM PUBLIC, "anon";

-- A shared menu as anyone may see it: a home menu under its owner's public
-- profile (not when either has blocked the other), a venue's under the
-- venue's public page. Adds the night ('night_starts_at') for a venue's.
CREATE OR REPLACE FUNCTION "public"."shared_menu"("p_menu_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH "menu" AS (
    SELECT "m"."id", "m"."name", "m"."menu_date", "m"."cover_url", "m"."shared_at",
           CASE WHEN "m"."bar_id" IS NULL THEN NULL ELSE COALESCE("m"."starts_at", "m"."planned_starts_at") END AS "night_starts_at",
           "p"."id" AS "profile_id", "p"."display_name", "p"."handle"
    FROM "public"."menus" "m"
    JOIN "public"."profiles" "p" ON "p"."is_public" AND "p"."moderated_at" IS NULL
     AND (("m"."bar_id" IS NULL AND "p"."user_id" = "m"."created_by") OR ("m"."bar_id" IS NOT NULL AND "p"."bar_id" = "m"."bar_id"))
    WHERE "m"."id" = "p_menu_id"
      AND "m"."shared_at" IS NOT NULL
      AND ("m"."bar_id" IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM "public"."user_blocks" "b"
        WHERE ("b"."blocker_id" = "auth"."uid"() AND "b"."blocked_id" = "m"."created_by")
           OR ("b"."blocker_id" = "m"."created_by" AND "b"."blocked_id" = "auth"."uid"())
      ))
  ), "public_drinks" AS (
    SELECT "pi"."id"
    FROM "public"."published_items" "pi"
    WHERE NOT "pi"."is_reference"
      AND "pi"."id" IN (SELECT "md"."item_id" FROM "public"."menu_drinks" "md" JOIN "menu" ON "menu"."id" = "md"."menu_id")
  )
  SELECT "jsonb_build_object"(
    'id', "menu"."id",
    'name', "menu"."name",
    'menu_date', "menu"."menu_date",
    'night_starts_at', "menu"."night_starts_at",
    'cover_url', "menu"."cover_url",
    'shared_at', "menu"."shared_at",
    'owner', "jsonb_build_object"('profile_id', "menu"."profile_id", 'name', "menu"."display_name", 'handle', "menu"."handle"),
    'sections', COALESCE((
      SELECT "jsonb_agg"("jsonb_build_object"(
        'id', "s"."id",
        'name', "s"."name",
        'item_ids', COALESCE((
          SELECT "jsonb_agg"("pd"."id" ORDER BY "md"."sort_order", "md"."id")
          FROM "public"."menu_drinks" "md"
          LEFT JOIN "public_drinks" "pd" ON "pd"."id" = "md"."item_id"
          WHERE "md"."menu_section_id" = "s"."id"
        ), '[]'::"jsonb")
      ) ORDER BY "s"."sort_order", "s"."id")
      FROM "public"."menu_sections" "s"
      WHERE "s"."menu_id" = "menu"."id"
    ), '[]'::"jsonb")
  )
  FROM "menu";
$$;

REVOKE ALL ON FUNCTION "public"."shared_menu"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."shared_menu"("uuid") TO "anon", "authenticated", "service_role";

COMMENT ON COLUMN "public"."menus"."shared_at" IS
    'Shared with a link since this time (server set). NULL: not shared. A bar''s menu only while it is one night (20261013300000).';
