-- A venue owns its menu history.
--
-- Kevin, 13 Oct: "Shouldn't a bar be in control of these menus?" Researched
-- menus (profile_menu_editions) are read-only to everyone but app admins, and
-- the venue's Menus list only reads public.menus, so a staffed bar could see
-- its history on its public page but never fix it. Caretaker's Cottage had 12
-- researched menus and 1 of its own in Menus.
--
-- Rule from here on: once a bar has staff, every menu on its page is one of
-- its own menus. private.move_menu_history_to_venue(bar) turns each edition
-- into a public.menus row the venue's staff can edit or delete:
--
--   dates      starts the 1st of its month; is_current: on now; an end
--              month: ends the last day of that month; otherwise it ran
--              for its own month (its year, when the month isn't known).
--              Months the research didn't record stay unrecorded. Both at
--              noon UTC: the Menus list shows the same day from UTC-11 to
--              UTC+11, and get_menu_editions (which reads months in UTC)
--              keeps the research's months.
--              ponytail: bars have no timezone yet (profiles.timezone is
--              empty for all of them); use local midnight once it's set.
--   theme      becomes the menu's description. source_url is dropped: the
--              bar's word replaces the research.
--   drinks     the same items in the same order, in one "Drinks" section.
--
-- The edition is then deleted (its drinks and saves cascade), so the public
-- page, which lists both kinds since 20261016100000, shows each menu once.
--
-- It runs now for every staffed bar, and again when a bar gets staff
-- (user_bars insert) or a staffed bar's page is linked (profiles.bar_id set,
-- which hand_over_claim does after adding the claimant). Bars with no staff
-- keep their editions as research history.
-- ponytail: a seed that adds editions to an already staffed bar should call
-- private.move_menu_history_to_venue itself (AGENTS.md says so); a trigger on
-- the editions can't see their drinks, which are inserted after them.

CREATE FUNCTION "private"."move_menu_history_to_venue"("p_bar_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    e record;
    v_menu uuid;
    v_section uuid;
    v_start timestamptz;
    v_last_month timestamptz;
    v_end timestamptz;
    v_moved integer := 0;
BEGIN
    IF p_bar_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.bar_id = p_bar_id) THEN
        RETURN 0;
    END IF;
    FOR e IN
        SELECT pe.*
        FROM public.profile_menu_editions pe
        JOIN public.profiles p ON p.id = pe.profile_id
        WHERE p.bar_id = p_bar_id AND p.kind = 'bar'
        ORDER BY pe.year, pe.month NULLS FIRST, pe.created_at
    LOOP
        v_start := make_timestamptz(e.year, COALESCE(e.month, 1), 1, 12, 0, 0, 'UTC');
        v_last_month := CASE
            WHEN e.end_year IS NOT NULL THEN make_timestamptz(e.end_year, COALESCE(e.end_month, 12), 1, 12, 0, 0, 'UTC')
            WHEN e.month IS NULL THEN v_start + interval '11 months'
            ELSE v_start
        END;
        IF v_last_month < v_start THEN
            v_last_month := v_start;
        END IF;
        -- The last day of the last month.
        v_end := CASE WHEN e.is_current THEN NULL ELSE v_last_month + interval '1 month' - interval '1 day' END;

        INSERT INTO public.menus (bar_id, name, kind, description, starts_at, ends_at, created_by)
        VALUES (p_bar_id, e.name, 'menu', e.theme, v_start, v_end, NULL)
        RETURNING id INTO v_menu;
        INSERT INTO public.menu_sections (menu_id, name, sort_order, min_items)
        VALUES (v_menu, 'Drinks', 0, 0)
        RETURNING id INTO v_section;
        INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order)
        SELECT v_menu, v_section, d.item_id, d.sort_order
        FROM public.profile_menu_edition_drinks d
        WHERE d.edition_id = e.id;

        DELETE FROM public.profile_menu_editions WHERE id = e.id;
        v_moved := v_moved + 1;
    END LOOP;
    RETURN v_moved;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."move_menu_history_to_venue"("uuid") FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."venue_takes_menu_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.move_menu_history_to_venue(NEW.bar_id);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."venue_takes_menu_history"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "venue_takes_menu_history" AFTER INSERT ON "public"."user_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."venue_takes_menu_history"();

CREATE TRIGGER "venue_takes_menu_history" AFTER INSERT OR UPDATE OF "bar_id" ON "public"."profiles"
    FOR EACH ROW WHEN (NEW.bar_id IS NOT NULL AND NEW.kind = 'bar')
    EXECUTE FUNCTION "private"."venue_takes_menu_history"();

-- Every bar with staff today: Caretaker's Cottage, A Bar with Shapes for a
-- Name and Bar Bellamy in production.
SELECT private.move_menu_history_to_venue(b.bar_id)
FROM (SELECT DISTINCT ub.bar_id FROM public.user_bars ub) b;
