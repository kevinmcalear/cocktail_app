-- Tonight, the bar's daily list, as guests read it, and its days in the
-- bar's own time zone.
--
--   * private.bar_time_zone(bar): the bar's time zone, bars.timezone, else
--     the time zone on its page (as the app reads a bar's clock, useBarClock),
--     else UTC. list_on_day dated a bar with no bars.timezone in UTC, so a New
--     York bar's day turned at 8pm.
--   * list_on_day reads the day with it.
--   * get_menu_editions (as 20261205910000) also returns each venue menu's
--     list_type, and for a daily list when today's list was first written
--     (written_at, from menu_days) and 'new_today' on a drink on tonight for
--     the first time (guests read "New", Menu-l-tonight). Who wrote it isn't
--     returned.

CREATE FUNCTION "private"."bar_time_zone"("p_bar_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT coalesce(
        (SELECT b.timezone FROM public.bars b WHERE b.id = p_bar_id),
        (SELECT p.timezone FROM public.profiles p
         WHERE p.bar_id = p_bar_id AND p.kind = 'bar' AND p.timezone IS NOT NULL AND private.is_time_zone(p.timezone)
         ORDER BY p.created_at LIMIT 1),
        'UTC'
    );
$$;

REVOKE ALL ON FUNCTION "private"."bar_time_zone"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."bar_time_zone"("uuid") TO "authenticated", "service_role";

-- As 20261203100000, with the bar's time zone from bar_time_zone.
CREATE OR REPLACE FUNCTION "public"."list_on_day"("p_menu_id" "uuid", "p_day" "date")
    RETURNS TABLE(
        "item_id" "uuid",
        "section_name" "text",
        "slot_name" "text",
        "price" "text",
        "went_on" timestamp with time zone,
        "came_off" timestamp with time zone,
        "added_by" "uuid",
        "replaces_item_id" "uuid"
    )
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH m AS (
        SELECT m.id, m.starts_at, m.ends_at,
               (p_day::timestamp AT TIME ZONE private.bar_time_zone(m.bar_id)) AS day_start,
               ((p_day + 1)::timestamp AT TIME ZONE private.bar_time_zone(m.bar_id)) AS day_end
        FROM public.menus m
        WHERE m.id = p_menu_id AND m.starts_at IS NOT NULL
    ), rows AS (
        SELECT md.item_id, s.name AS section_name, md.slot_name, coalesce(md.price, nullif(btrim(i.price), '')) AS price,
               greatest(coalesce(md.on_from, m.starts_at), m.starts_at) AS went_on,
               least(md.off_at, m.ends_at) AS came_off,
               md.added_by, md.replaces_item_id, s.sort_order AS s_order, md.sort_order AS d_order
        FROM m
        JOIN public.menu_drinks md ON md.menu_id = m.id AND md.waiting IS DISTINCT FROM 'on'
        JOIN public.items i ON i.id = md.item_id
        LEFT JOIN public.menu_sections s ON s.id = md.menu_section_id
        UNION ALL
        SELECT r.item_id, r.section_name, r.slot_name, r.price, r.went_on, r.came_off, r.added_by, r.replaces_item_id, NULL, NULL
        FROM m
        JOIN public.menu_drinks_removed r ON r.menu_id = m.id
    )
    SELECT r.item_id, r.section_name, r.slot_name, r.price, r.went_on, r.came_off, r.added_by, r.replaces_item_id
    FROM rows r, m
    WHERE r.went_on < m.day_end AND (r.came_off IS NULL OR r.came_off > m.day_start)
    ORDER BY r.s_order NULLS LAST, r.d_order NULLS LAST, r.went_on;
$$;

-- As 20261205910000, plus list_type, written_at and 'new_today'. The return
-- type changes, so it's dropped and made again with the same grants.
DROP FUNCTION "public"."get_menu_editions"("uuid");
CREATE FUNCTION public.get_menu_editions(p_profile_id uuid)
 RETURNS TABLE(id uuid, name text, year smallint, month smallint, end_year smallint, end_month smallint, is_current boolean, theme text, source_url text, drinks jsonb, from_venue boolean, cover_url text, list_type text, written_at timestamp with time zone)
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
        SELECT m.id, m.name, m.description, m.bar_id, m.cover_url, m.list_type, m.starts_at,
            m.ends_at IS NOT NULL AND m.ends_at <= now() AS ended,
            m.starts_at AT TIME ZONE 'UTC' AS started_on,
            (m.ends_at - interval '1 microsecond') AT TIME ZONE 'UTC' AS ended_on,
            -- The start of the bar's day, for a daily list.
            (date_trunc('day', now() AT TIME ZONE private.bar_time_zone(m.bar_id)) AT TIME ZONE private.bar_time_zone(m.bar_id)) AS today_from,
            (now() AT TIME ZONE private.bar_time_zone(m.bar_id))::date AS today
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
            NULL::text AS cover_url,
            NULL::text AS list_type,
            NULL::timestamp with time zone AS written_at
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
                    -- On a daily list for the first time today: it went on today and never ran on it before.
                    || CASE WHEN v.list_type = 'daily' AND NOT v.ended
                        AND greatest(coalesce(md.on_from, v.starts_at), v.starts_at) >= v.today_from
                        AND NOT EXISTS (
                            SELECT 1 FROM public.menu_drinks_removed r
                            WHERE r.menu_id = v.id AND r.item_id = i.id AND r.went_on < v.today_from AND r.came_off > r.went_on
                        ) THEN jsonb_build_object('new_today', true) ELSE '{}'::jsonb END
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
            v.cover_url,
            v.list_type,
            CASE WHEN v.list_type = 'daily' AND NOT v.ended THEN (
                SELECT d.created_at FROM public.menu_days d WHERE d.menu_id = v.id AND d.day = v.today
            ) END
        FROM venue v
    )
    SELECT * FROM rows
    ORDER BY year DESC, month DESC NULLS LAST, name
    LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_menu_editions"("p_profile_id" "uuid") TO "anon", "authenticated", "service_role";
