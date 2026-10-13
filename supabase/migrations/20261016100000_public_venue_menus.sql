-- A bar's own menus on its public page.
--
-- Kevin, 12 Oct: "let's default to letting the menu show up on a public
-- page". Until now a bar page only listed researched menus
-- (profile_menu_editions); a claimed bar's own menus (public.menus) stayed
-- with its staff, so Little Rye's page said "No menus from Little Rye here
-- yet" with a menu on the floor.
--
-- get_menu_editions now also returns the venue's own menus, read-only and
-- signed out too:
--
--   on now     kind 'menu', started (starts_at <= now()) and not ended.
--   past       kind 'menu', started and ended (ends_at <= now()).
--
-- Never: drafts (no start), menus scheduled but not started, one-night menus
-- dated only by menu_date, R&D collections (kind 'rnd'), and anything at a
-- bar whose profile the viewer can't see (the same gate as before: public,
-- not moderated, owner not blocked; or the viewer's own bar).
--
-- Each drink comes with its name, its price as the venue typed it
-- (items.price) and its menu section. Only the bar's own drinks and shared
-- catalog drinks are listed (a person's private drink on a venue menu is
-- left off), and moderated drinks never show. Specs stay where they were:
-- the items themselves keep their RLS.
--
-- from_venue tells the app which rows are the venue's own menus: their id is
-- a menus.id, not a profile_menu_editions.id, so they can't be saved to a
-- Collection yet (saved_menu_editions points at editions).
-- ponytail: saving a venue menu needs saved_menu_editions to take a menu id;
-- a per-menu "keep this off my public page" switch can come with it.

DROP FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid");

CREATE FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid",
        "name" "text",
        "year" smallint,
        "month" smallint,
        "end_year" smallint,
        "end_month" smallint,
        "is_current" boolean,
        "theme" "text",
        "source_url" "text",
        "drinks" "jsonb",
        "from_venue" boolean
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH shown AS (
        SELECT p.id, p.kind, p.bar_id
        FROM public.profiles p
        WHERE p.id = p_profile_id
          AND (
              (
                  p.is_public AND p.moderated_at IS NULL
                  AND (
                      auth.uid() IS NULL
                      OR p.user_id IS NULL
                      OR p.user_id = auth.uid()
                      OR p.user_id NOT IN (SELECT private.blocked_user_ids())
                  )
              )
              OR (
                  auth.uid() IS NOT NULL
                  AND (
                      p.user_id = auth.uid()
                      OR p.bar_id IN (SELECT private.my_bar_ids(0))
                      OR private.is_app_admin()
                  )
              )
          )
    ), venue AS (
        -- A started menu's dates, in UTC. It ran up to the moment before ends_at.
        SELECT m.id, m.name, m.description, m.bar_id,
            m.ends_at IS NOT NULL AND m.ends_at <= now() AS ended,
            m.starts_at AT TIME ZONE 'UTC' AS started_on,
            (m.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' AS ended_on
        FROM public.menus m
        JOIN shown s ON s.kind = 'bar' AND s.bar_id IS NOT NULL AND m.bar_id = s.bar_id
        WHERE m.kind = 'menu'
          AND m.starts_at IS NOT NULL
          AND m.starts_at <= now()
    ), rows AS (
        SELECT e.id, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.theme, e.source_url,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY d.sort_order)
                FROM public.profile_menu_edition_drinks d
                JOIN public.items i ON i.id = d.item_id AND i.moderated_at IS NULL
                WHERE d.edition_id = e.id
            ), '[]'::jsonb) AS drinks,
            false AS from_venue
        FROM public.profile_menu_editions e
        JOIN shown s ON s.id = e.profile_id
        UNION ALL
        SELECT v.id, v.name,
            extract(year FROM v.started_on)::smallint,
            extract(month FROM v.started_on)::smallint,
            CASE WHEN v.ended THEN extract(year FROM v.ended_on)::smallint END,
            CASE WHEN v.ended THEN extract(month FROM v.ended_on)::smallint END,
            NOT v.ended,
            v.description,
            NULL::text,
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('id', i.id, 'name', i.name, 'price', NULLIF(btrim(i.price), ''), 'section', ms.name)
                    ORDER BY ms.sort_order NULLS LAST, md.sort_order, md.id
                )
                FROM public.menu_drinks md
                JOIN public.items i ON i.id = md.item_id AND i.moderated_at IS NULL
                    AND (i.bar_id = v.bar_id OR (i.bar_id IS NULL AND i.created_by IS NULL))
                LEFT JOIN public.menu_sections ms ON ms.id = md.menu_section_id
                WHERE md.menu_id = v.id
            ), '[]'::jsonb),
            true
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$$;

REVOKE ALL ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") TO "anon", "authenticated", "service_role";
