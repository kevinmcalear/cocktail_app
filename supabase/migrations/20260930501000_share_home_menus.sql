-- DRAFT. Local stack only. Not applied to production; needs Kevin's review
-- (the human-approved label) first.
--
-- Step 11b: share a home menu. A home menu (no bar) can be shared with a
-- link, /m/<id>. Sharing is its own flag, shared_at, not publish_mode: a bar
-- menu's publish_mode publishes the drinks on it, while sharing a home menu
-- changes no drink's visibility at all.
--
-- The public reads a shared menu only through shared_menu(), which returns
-- the menu's name, night and sections, the owner's public profile, and for
-- each entry the id of a drink the caller can already see in published_items.
-- Any other entry (a personal drink that isn't published, a bar drink that
-- stopped being published) comes back as null: no id, no name. menus,
-- menu_sections and menu_drinks keep their policies; nothing about them opens.
--
-- Like publishing, sharing needs the owner's public profile, and the menu
-- stops being readable while that profile is private or hidden by a
-- moderator, or when the owner and the reader have blocked each other.

ALTER TABLE "public"."menus"
    ADD COLUMN "shared_at" timestamp with time zone;

COMMENT ON COLUMN "public"."menus"."shared_at" IS
    'A home menu shared with a link since this time (server set). NULL: not shared. Always NULL for a bar''s menu.';

-- Only the owner turns sharing on, and only with a public profile. The time
-- is the server's. A menu that moves to a bar stops being shared.
CREATE FUNCTION "private"."guard_menu_share"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.bar_id IS NOT NULL OR NEW.shared_at IS NULL THEN
        NEW.shared_at := NULL;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.shared_at IS NOT NULL THEN
        NEW.shared_at := OLD.shared_at;
        RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL THEN
        IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Only the person who made a menu can share it.' USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = NEW.created_by AND p.is_public AND p.moderated_at IS NULL
        ) THEN
            RAISE EXCEPTION 'You need a public profile before you can share a menu.';
        END IF;
    END IF;
    NEW.shared_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_menu_share" BEFORE INSERT OR UPDATE OF "shared_at", "bar_id" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_share"();

REVOKE EXECUTE ON FUNCTION "private"."guard_menu_share"() FROM PUBLIC, "anon", "authenticated";

-- A shared home menu as anyone may see it, or NULL when it isn't shared (or
-- isn't there, or its owner isn't public, or is blocked either way). Runs as
-- its owner to read the menu; published_items still filters by the caller.
CREATE FUNCTION "public"."shared_menu"("p_menu_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH "menu" AS (
    SELECT "m"."id", "m"."name", "m"."menu_date", "m"."cover_url", "m"."shared_at",
           "p"."id" AS "profile_id", "p"."display_name", "p"."handle"
    FROM "public"."menus" "m"
    JOIN "public"."profiles" "p" ON "p"."user_id" = "m"."created_by" AND "p"."is_public" AND "p"."moderated_at" IS NULL
    WHERE "m"."id" = "p_menu_id"
      AND "m"."bar_id" IS NULL
      AND "m"."shared_at" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "public"."user_blocks" "b"
        WHERE ("b"."blocker_id" = "auth"."uid"() AND "b"."blocked_id" = "m"."created_by")
           OR ("b"."blocker_id" = "m"."created_by" AND "b"."blocked_id" = "auth"."uid"())
      )
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
