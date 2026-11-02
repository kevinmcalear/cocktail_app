-- Anyone on shift, and what guests read of a menu tonight.
--
--   * Anyone on shift (Kevin's pick on "off-tonight" and the daily list):
--     someone with a shift at the bar that has started, or starts within two
--     hours, may take a drink off for tonight on any of the bar's lists, and
--     writes the bar's daily list (list_type 'daily') without approval: its
--     drinks (menu_drinks, swap_menu_drink), its day (menu_days) and its
--     sections. private.can_edit_menu and private.may_change_list let them
--     in, as they let a takeover's guest bartenders in (20261204400000). Other
--     lists are as before.
--   * get_menu_editions, the bar page's menus for anyone, also returns a
--     venue menu's cover photo (cover_url, so guests see the photo the board
--     draws), and marks each drink off for tonight ('off_tonight' in drinks:
--     the guest page's "Not tonight"). Who is behind it isn't returned.

-- --- Anyone on shift ---

-- A shift at this bar that's on now, or starts within two hours (people
-- write tonight's list before doors). Only for people still on the team.
CREATE FUNCTION "private"."on_shift_at"("p_bar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.shifts s
        JOIN public.user_bars ub ON ub.bar_id = s.bar_id AND ub.user_id = s.user_id
        WHERE s.bar_id = p_bar_id
          AND s.user_id = auth.uid()
          AND s.starts_at - interval '2 hours' <= now()
          AND s.ends_at > now()
    );
$$;

REVOKE ALL ON FUNCTION "private"."on_shift_at"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."on_shift_at"("uuid") TO "authenticated", "service_role";

-- A bar's daily list, and the caller is on shift there.
CREATE FUNCTION "private"."on_shift_daily"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.menus m
        WHERE m.id = p_menu_id
          AND m.list_type = 'daily'
          AND m.bar_id IS NOT NULL
          AND private.on_shift_at(m.bar_id)
    );
$$;

REVOKE ALL ON FUNCTION "private"."on_shift_daily"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."on_shift_daily"("uuid") TO "authenticated", "service_role";

-- As 20261204400000, and whoever is on shift edits the bar's daily list.
CREATE OR REPLACE FUNCTION "private"."can_edit_menu"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (SELECT private.can_build_menu(bar_id, created_by) FROM public.menus WHERE id = p_menu_id),
    false
  ) OR private.is_takeover_guest(p_menu_id) OR private.on_shift_daily(p_menu_id);
$$;

-- As 20261204400000, and whoever is on shift changes the daily list without
-- approval.
CREATE OR REPLACE FUNCTION "private"."may_change_list"("p_menu_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT auth.uid() IS NULL OR private.is_takeover_guest(p_menu_id) OR private.on_shift_daily(p_menu_id) OR coalesce((
        SELECT private.can_build_menu(m.bar_id, m.created_by)
           AND (
               m.bar_id IS NULL
               OR (
                   m.bar_id NOT IN (SELECT d.bar_id FROM private.my_departments() d)
                   AND (
                       (m.change_level IS NULL AND m.change_role_id IS NULL)
                       OR EXISTS (
                           SELECT 1 FROM public.user_bars ub
                           WHERE ub.bar_id = m.bar_id AND ub.user_id = auth.uid()
                             AND (
                                 ub.role_level >= 40
                                 OR (m.change_role_id IS NOT NULL AND ub.venue_role_id = m.change_role_id)
                                 OR (m.change_level IS NOT NULL AND ub.role_level >= m.change_level)
                             )
                       )
                   )
               )
           )
        FROM public.menus m
        WHERE m.id = p_menu_id
    ), false);
$$;

-- Off tonight: the menu team, or anyone on shift at the list's bar.
DROP POLICY "menu_off_tonight_insert" ON "public"."menu_off_tonight";
CREATE POLICY "menu_off_tonight_insert" ON "public"."menu_off_tonight" FOR INSERT TO "authenticated"
    WITH CHECK (
      "set_by" = (SELECT "auth"."uid"())
      AND (
        "private"."can_edit_menu"("menu_id")
        OR "private"."on_shift_at"((SELECT "m"."bar_id" FROM "public"."menus" "m" WHERE "m"."id" = "menu_id"))
      )
      AND "until" > "now"()
      AND "until" <= "now"() + interval '36 hours'
    );
DROP POLICY "menu_off_tonight_delete" ON "public"."menu_off_tonight";
CREATE POLICY "menu_off_tonight_delete" ON "public"."menu_off_tonight" FOR DELETE TO "authenticated"
    USING (
      "private"."can_edit_menu"("menu_id")
      OR "private"."on_shift_at"((SELECT "m"."bar_id" FROM "public"."menus" "m" WHERE "m"."id" = "menu_id"))
    );

-- --- What guests read ---

-- As 20261203100000, plus cover_url (the venue menu's cover photo) and
-- 'off_tonight' on a drink taken off for tonight. The return type changes,
-- so it's dropped and made again with the same grants.
DROP FUNCTION "public"."get_menu_editions"("uuid");
CREATE FUNCTION public.get_menu_editions(p_profile_id uuid)
 RETURNS TABLE(id uuid, name text, year smallint, month smallint, end_year smallint, end_month smallint, is_current boolean, theme text, source_url text, drinks jsonb, from_venue boolean, cover_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    WITH shown AS (
        SELECT p.id, p.kind, p.bar_id
        FROM public.profiles p
        WHERE p.id = p_profile_id
          AND private.menu_page_shown(p.id)
    ), venue AS (
        -- A started menu's dates, in UTC. It ran up to the moment before ends_at.
        SELECT m.id, m.name, m.description, m.bar_id, m.cover_url,
            m.ends_at IS NOT NULL AND m.ends_at <= now() AS ended,
            m.starts_at AT TIME ZONE 'UTC' AS started_on,
            (m.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' AS ended_on
        FROM public.menus m
        JOIN shown s ON s.kind = 'bar' AND s.bar_id IS NOT NULL AND m.bar_id = s.bar_id
        WHERE m.kind = 'menu'
          AND m.starts_at IS NOT NULL
          AND m.starts_at <= now()
          AND m.hidden_at IS NULL
    ), rows AS (
        SELECT e.id, e.name, e.year, e.month, e.end_year, e.end_month, e.is_current, e.theme, e.source_url,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY d.sort_order)
                FROM public.profile_menu_edition_drinks d
                JOIN public.items i ON i.id = d.item_id AND i.moderated_at IS NULL
                WHERE d.edition_id = e.id
            ), '[]'::jsonb) AS drinks,
            false AS from_venue,
            NULL::text AS cover_url
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
                    jsonb_build_object('id', i.id, 'name', i.name, 'price', COALESCE(md.price, NULLIF(btrim(i.price), '')), 'section', ms.name)
                    || CASE WHEN NOT v.ended AND EXISTS (
                        SELECT 1 FROM public.menu_off_tonight o
                        WHERE o.menu_id = v.id AND o.item_id = i.id AND o.until > now()
                    ) THEN jsonb_build_object('off_tonight', true) ELSE '{}'::jsonb END
                    ORDER BY ms.sort_order NULLS LAST, md.sort_order, md.id
                )
                FROM public.menu_drinks md
                JOIN public.items i ON i.id = md.item_id AND i.moderated_at IS NULL
                    AND (i.bar_id = v.bar_id OR (i.bar_id IS NULL AND i.created_by IS NULL))
                LEFT JOIN public.menu_sections ms ON ms.id = md.menu_section_id
                WHERE md.menu_id = v.id
                  AND md.waiting IS DISTINCT FROM 'on'
                  AND (md.on_from IS NULL OR md.on_from <= now())
            ), '[]'::jsonb),
            true,
            v.cover_url
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") TO "anon", "authenticated", "service_role";
