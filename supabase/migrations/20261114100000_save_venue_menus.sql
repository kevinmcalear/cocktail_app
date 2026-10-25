-- Save a staffed bar's own menu to your Collection (p07, decided 24 Oct 2026).
--
-- A bar page lists two kinds of menus (get_menu_editions): researched ones
-- (profile_menu_editions, for bars with no staff yet) and, since
-- 20261016100000, the venue's own started menus (public.menus, from_venue).
-- Only the first could be saved: saved_menu_editions pointed at editions.
--
-- saved_menu_editions now holds either kind, one per row:
--   edition_id  a researched menu, as before;
--   menu_id     a venue's own menu.
-- Old app builds keep saving editions as they do.
--
-- Saving a venue menu needs what seeing it needs: get_menu_editions lists it
-- for that bar's page (public, not moderated or Private, owner not blocked,
-- started, kind 'menu'), checked by private.venue_menu_shown(). A visitor
-- can't read public.menus, so my_saved_venue_menus() lists the caller's saved
-- venue menus through get_menu_editions too: one that stops showing (the page
-- goes Private, the menu goes back to a draft) drops out of Collection until
-- it shows again.

ALTER TABLE "public"."saved_menu_editions" DROP CONSTRAINT "saved_menu_editions_pkey";

ALTER TABLE "public"."saved_menu_editions"
    ADD COLUMN "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    ADD COLUMN "menu_id" "uuid" REFERENCES "public"."menus"("id") ON DELETE CASCADE,
    ALTER COLUMN "edition_id" DROP NOT NULL,
    ADD CONSTRAINT "saved_menu_editions_pkey" PRIMARY KEY ("id"),
    ADD CONSTRAINT "saved_menu_editions_one_menu" CHECK (num_nonnulls("edition_id", "menu_id") = 1),
    -- What upsert's on_conflict names: one save per person per menu.
    ADD CONSTRAINT "saved_menu_editions_user_id_edition_id_key" UNIQUE ("user_id", "edition_id"),
    ADD CONSTRAINT "saved_menu_editions_user_id_menu_id_key" UNIQUE ("user_id", "menu_id");

CREATE INDEX "saved_menu_editions_menu_id_idx" ON "public"."saved_menu_editions" ("menu_id") WHERE "menu_id" IS NOT NULL;

-- A venue menu the caller can see on its bar's page.
CREATE FUNCTION "private"."venue_menu_shown"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.menus m
        JOIN public.profiles p ON p.bar_id = m.bar_id AND p.kind = 'bar'
        CROSS JOIN LATERAL public.get_menu_editions(p.id) e
        WHERE m.id = p_menu_id AND e.id = m.id AND e.from_venue
    );
$$;

REVOKE ALL ON FUNCTION "private"."venue_menu_shown"("p_menu_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."venue_menu_shown"("p_menu_id" "uuid") TO "authenticated", "service_role";

DROP POLICY "saved_menu_editions_insert_own" ON "public"."saved_menu_editions";

CREATE POLICY "saved_menu_editions_insert_own" ON "public"."saved_menu_editions"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND (
            ("edition_id" IS NOT NULL AND EXISTS (SELECT 1 FROM "public"."profile_menu_editions" "e" WHERE "e"."id" = "saved_menu_editions"."edition_id"))
            OR ("menu_id" IS NOT NULL AND "private"."venue_menu_shown"("menu_id"))
        )
    );

-- The caller's saved venue menus, newest first, as their bar pages show them.
CREATE FUNCTION "public"."my_saved_venue_menus"()
    RETURNS TABLE(
        "menu_id" "uuid",
        "saved_at" timestamp with time zone,
        "name" "text",
        "year" smallint,
        "month" smallint,
        "end_year" smallint,
        "end_month" smallint,
        "is_current" boolean,
        "drinks" "jsonb",
        "profile_id" "uuid",
        "handle" "text",
        "display_name" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT s.menu_id, s.saved_at, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.drinks, p.id, p.handle, p.display_name
    FROM public.saved_menu_editions s
    JOIN public.menus m ON m.id = s.menu_id
    JOIN public.profiles p ON p.bar_id = m.bar_id AND p.kind = 'bar'
    CROSS JOIN LATERAL public.get_menu_editions(p.id) e
    WHERE s.user_id = auth.uid() AND e.id = s.menu_id AND e.from_venue
    ORDER BY s.saved_at DESC
    LIMIT 200;
$$;

REVOKE ALL ON FUNCTION "public"."my_saved_venue_menus"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_saved_venue_menus"() TO "authenticated", "service_role";
