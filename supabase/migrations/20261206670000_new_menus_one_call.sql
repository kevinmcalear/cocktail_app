-- Discover's New menus read in one call.
--
-- Discover asked get_menu_editions once for each of the eight nearest bars,
-- eight round trips for a row of tiles. current_menus_of_bars answers for
-- many bars at once: each bar's menus that are on now, with only the first
-- drink (a tile draws one). It calls get_menu_editions itself as the caller,
-- so who may see a bar's menus is decided in one place, as before.
--
--   * Adds one function, current_menus_of_bars(uuid[]). Nothing is changed
--     or removed. Bars past the first 24 ids are ignored.

CREATE FUNCTION public.current_menus_of_bars(p_profile_ids uuid[])
 RETURNS TABLE(profile_id uuid, id uuid, name text, year smallint, month smallint, drinks jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
    SELECT p.id, e.id, e.name, e.year, e.month,
        CASE WHEN jsonb_array_length(e.drinks) > 0 THEN jsonb_build_array(e.drinks -> 0) ELSE '[]'::jsonb END
    FROM unnest((SELECT COALESCE(p_profile_ids[1:24], '{}'::uuid[]))) AS p(id)
    CROSS JOIN LATERAL public.get_menu_editions(p.id) e
    WHERE e.is_current;
$function$;

REVOKE ALL ON FUNCTION "public"."current_menus_of_bars"("uuid"[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."current_menus_of_bars"("uuid"[]) TO "anon", "authenticated", "service_role";
