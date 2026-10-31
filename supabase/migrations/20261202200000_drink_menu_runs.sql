-- A drink's runs on bar menus, staffed bars' own menus included.
--
-- menu_drink_runs (a view, 20261007153000_menu_edition_dates.sql) read only
-- researched editions (profile_menu_editions). Once a bar has staff,
-- private.move_menu_history_to_venue (20261017600000) moves its history into
-- public.menus and deletes the editions, so a staffed bar's own menus never
-- reached a drink's runs (its page, a person's Made by) or Discover's "on
-- now". Its security_invoker reads would have shown guests nothing of venue
-- menus anyway (members only under RLS).
--
--   * drink_menu_runs(item ids): one SECURITY DEFINER read of each drink's
--     runs at each bar. It unions researched editions (to the month), a
--     venue's own started menus (to the day, UTC) and drinks taken off a
--     live menu (menu_drinks_removed, 20261202100000). A bar's stints that
--     overlap or touch (the next starts the day after, or a researched
--     month runs into the next) make one run; a gap starts another, so a
--     drink taken off and put back a month later has two. Each run says
--     where it started and ended (year and month always, the day when
--     known), whether it's on now, and the menu to open (on now, else the
--     latest). A venue drink added while its menu was on starts then
--     (greatest(menu_drinks.created_at, menus.starts_at)); one added after
--     the menu ended is a fix, so it ran the whole menu.
--   * It follows the bar page: the drinks and menus get_menu_editions
--     lists, on the pages the caller may see. That rule now lives in
--     private.menu_page_shown, which get_menu_editions uses too.
--     ponytail: the past-menus Admin switch (2027 canvas) isn't built; when
--     it is, it hides ended runs here and on the bar page together.
--   * Discover reads it: private.refresh_discover_facts (menu tier of
--     base_rank, so p_on_now), discover_list, and the older discover_drinks
--     and search_bar_drinks (no screen calls them since 8 Oct; kept working
--     for old builds). Venue menu changes now mark their drinks, and the
--     drinks on venue menus today are marked once below.
--   * The app's drink page (useDrinkMenuRuns) and Made by (useMenuRuns)
--     switch to it in this PR. menu_drink_runs stays until that OTA has
--     spread, then a follow-up drops it; nothing in the database reads it.

-- --- Whose menus the caller sees ---

-- A bar page whose menus the caller can see: as get_menu_editions has
-- decided since 20261024200000_page_visibility_ladder.sql (not Private
-- unless it's their team's; public, not moderated and its owner not
-- blocked, or theirs, their bar's or an app admin's). Signed out, or from a
-- job with no caller, that's the public pages.
CREATE FUNCTION "private"."menu_page_shown"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_profile_id
          -- A Private page's menus are its team's.
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
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
    );
$$;

REVOKE EXECUTE ON FUNCTION "private"."menu_page_shown"("p_profile_id" "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- A drink's runs ---

CREATE FUNCTION "public"."drink_menu_runs"("p_item_ids" "uuid"[])
    RETURNS TABLE(
        "item_id" "uuid",
        "profile_id" "uuid",
        "edition_id" "uuid",
        "edition_name" "text",
        "start_year" smallint,
        "start_month" smallint,
        "starts_on" "date",
        "end_year" smallint,
        "end_month" smallint,
        "ends_on" "date",
        "is_current" boolean
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH asked AS (
        SELECT i.id, i.bar_id, i.created_by
        FROM public.items i
        WHERE i.id = ANY (p_item_ids) AND i.moderated_at IS NULL
    ), venue AS (
        -- On a venue's menu now or before, from when it went on: added while
        -- the menu was on, from then; added before it started, or to fix it
        -- after it ended, its whole run.
        SELECT md.item_id, md.menu_id,
               CASE WHEN m.ends_at IS NOT NULL AND md.created_at >= m.ends_at THEN m.starts_at
                    ELSE greatest(md.created_at, m.starts_at) END AS went_on,
               CASE WHEN m.ends_at <= now() THEN m.ends_at END AS came_off
        FROM asked a
        JOIN public.menu_drinks md ON md.item_id = a.id
        JOIN public.menus m ON m.id = md.menu_id
        UNION ALL
        -- Taken off one while it was on (20261202100000).
        SELECT r.item_id, r.menu_id, r.went_on, r.came_off
        FROM asked a
        JOIN public.menu_drinks_removed r ON r.item_id = a.id
    ), stints AS MATERIALIZED (
        -- s: the first day on; e: the day after the last (null while on, or
        -- when nobody knows). Researched menus (bars with no staff yet) are
        -- known to the month; a venue's own, to the day (UTC, as
        -- get_menu_editions dates them).
        SELECT d.item_id, e.profile_id, e.id AS menu_id, e.name AS menu_name, e.is_current AS on_now,
               make_date(e.year, coalesce(e.month, 1), 1) AS s,
               CASE WHEN e.end_year IS NOT NULL THEN (make_date(e.end_year, coalesce(e.end_month, 12), 1) + interval '1 month')::date END AS e,
               e.year AS s_year, e.month AS s_month, NULL::date AS s_day,
               e.end_year AS e_year, e.end_month AS e_month, NULL::date AS e_day
        FROM asked a
        JOIN public.profile_menu_edition_drinks d ON d.item_id = a.id
        JOIN public.profile_menu_editions e ON e.id = d.edition_id
        UNION ALL
        SELECT x.item_id, x.profile_id, x.menu_id, x.menu_name, x.e IS NULL, x.s, x.e,
               extract(year FROM x.s)::smallint, extract(month FROM x.s)::smallint, x.s,
               extract(year FROM x.e - 1)::smallint, extract(month FROM x.e - 1)::smallint, x.e - 1
        FROM (
            SELECT v.item_id, p.id AS profile_id, m.id AS menu_id, m.name AS menu_name,
                   (v.went_on AT TIME ZONE 'UTC')::date AS s,
                   ((v.came_off - interval '1 microsecond') AT TIME ZONE 'UTC')::date + 1 AS e
            FROM venue v
            -- A menu the bar page lists: started, not R&D, and the drink one it shows.
            JOIN public.menus m ON m.id = v.menu_id AND m.kind = 'menu' AND m.starts_at <= now()
            JOIN public.profiles p ON p.bar_id = m.bar_id AND p.kind = 'bar'
            JOIN asked a ON a.id = v.item_id AND (a.bar_id = m.bar_id OR (a.bar_id IS NULL AND a.created_by IS NULL))
        ) x
    ), shown AS MATERIALIZED (
        SELECT DISTINCT st.profile_id FROM stints st
    ), reached AS (
        -- How far the bar's earlier stints with the drink reach: one that
        -- starts by then (the same day, or the day after) carries on their run.
        SELECT st.*,
               max(coalesce(st.e, 'infinity')) OVER (
                   PARTITION BY st.item_id, st.profile_id ORDER BY st.s, st.e NULLS LAST, st.menu_id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
               ) AS reach
        FROM stints st
        WHERE st.profile_id IN (SELECT sh.profile_id FROM shown sh WHERE private.menu_page_shown(sh.profile_id))
    ), numbered AS (
        SELECT r.*,
               count(*) FILTER (WHERE r.reach IS NULL OR r.s > r.reach) OVER (
                   PARTITION BY r.item_id, r.profile_id ORDER BY r.s, r.e NULLS LAST, r.menu_id
                   ROWS UNBOUNDED PRECEDING
               ) AS run
        FROM reached r
    )
    SELECT n.item_id, n.profile_id,
           -- The menu to open: the one on now, else the run's latest.
           (array_agg(n.menu_id ORDER BY n.on_now DESC, n.s DESC, n.menu_name, n.menu_id))[1],
           (array_agg(n.menu_name ORDER BY n.on_now DESC, n.s DESC, n.menu_name, n.menu_id))[1],
           -- From its first menu: to the day when that's known; a year-only start
           -- tied with a month in it stays year-only, as before.
           (array_agg(n.s_year ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           (array_agg(n.s_month ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           (array_agg(n.s_day ORDER BY n.s, n.s_day NULLS LAST, n.s_month NULLS FIRST))[1],
           -- ... to its last, unless one is on now or has no known end.
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_year ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_month ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           CASE WHEN bool_and(n.e IS NOT NULL) THEN (array_agg(n.e_day ORDER BY n.e DESC, n.e_day NULLS LAST))[1] END,
           bool_or(n.on_now)
    FROM numbered n
    GROUP BY n.item_id, n.profile_id, n.run
    ORDER BY n.item_id, bool_or(n.on_now) DESC, min(n.s) DESC;
$$;

REVOKE ALL ON FUNCTION "public"."drink_menu_runs"("p_item_ids" "uuid"[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."drink_menu_runs"("p_item_ids" "uuid"[]) TO "anon", "authenticated", "service_role";

-- --- The bar page: its rule now has one home ---

-- As 20261103530000_menu_drink_price.sql; who sees the page is private.menu_page_shown.
CREATE OR REPLACE FUNCTION public.get_menu_editions(p_profile_id uuid)
 RETURNS TABLE(id uuid, name text, year smallint, month smallint, end_year smallint, end_month smallint, is_current boolean, theme text, source_url text, drinks jsonb, from_venue boolean)
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
                    jsonb_build_object('id', i.id, 'name', i.name, 'price', COALESCE(md.price, NULLIF(btrim(i.price), '')), 'section', ms.name)
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
$function$;

-- --- Discover: venue menus count, read through drink_menu_runs ---

-- As 20261024200000_page_visibility_ladder.sql; the menu tier comes from drink_menu_runs.
CREATE OR REPLACE FUNCTION private.refresh_discover_facts(p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.discover_drink_facts f
    WHERE (p_ids IS NULL OR f.item_id = ANY (p_ids))
      AND NOT EXISTS (
          SELECT 1 FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
          LEFT JOIN public.bars ob ON ob.id = p.bar_id
          WHERE i.id = f.item_id AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            AND coalesce(ob.page_visibility, 'description') <> 'private'
      );

    -- Set-wise, one rule at a time over every drink (the LATERALs keep each
    -- rule's patterns hot): Postgres caches 32 compiled patterns, and drink by
    -- drink the 45 rules would recompile every pattern on every row.
    INSERT INTO public.discover_drink_facts AS t ("item_id", "bar_profile_id", "name", "styles", "spirits", "notes", "haystack", "base_rank", "refreshed_at")
    WITH src AS MATERIALIZED (
        SELECT i.id, i.name, i.description, i.origin_bar_profile_id, rf.name AS riff_name,
               CASE WHEN (i.created_by IS NULL AND coalesce(ob.page_visibility, 'description') = 'open') OR ps.id IS NOT NULL THEN (
                   SELECT array_agg(n.name ORDER BY r.sort_order)
                   FROM public.recipes r JOIN public.items n ON n.id = r.ingredient_item_id
                   WHERE r.recipe_item_id = i.id
               ) END AS lines
        FROM public.items i
        JOIN public.profiles p ON p.id = i.origin_bar_profile_id AND p.kind = 'bar'
        LEFT JOIN public.bars ob ON ob.id = p.bar_id
        LEFT JOIN public.items rf ON rf.id = i.riff_of_id
        LEFT JOIN private.published_listing ps ON ps.id = i.id AND ps.effective_mode = 'spec'
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND coalesce(ob.page_visibility, 'description') <> 'private'
          AND (p_ids IS NULL OR i.id = ANY (p_ids))
    ), folded AS MATERIALIZED (
        -- As lib/drinkStyles.ts: the folded name, description, classic, and lines joined by " | ".
        SELECT src.*,
               private.discover_fold_ws(src.name) AS n,
               private.discover_fold_ws(src.description) AS t,
               private.discover_fold_ws(src.riff_name) AS r,
               coalesce((SELECT string_agg(private.discover_fold_ws(x), ' | ' ORDER BY o) FROM unnest(src.lines) WITH ORDINALITY u(x, o)), '') AS i,
               coalesce(cardinality(src.lines), 0) > 0 AS has_lines
        FROM src
    ), d AS MATERIALIZED (
        -- The builds' ingredient tests (stylesOf's CITRUS, SWEET, LONG, BUBBLES, APERITIVO).
        SELECT f.*,
               f.i ~ '\y(lemon|lime|grapefruit|yuzu|citrus|sudachi|calamansi|verjus)\y(?! (twist|peel|zest|wheel|wedge|coin|leaf|oil))|\yacid\y' AS citrus,
               f.i ~ 'syrup|sugar|honey|agave nectar|orgeat|grenadine|cordial|liqueur|triple sec|cointreau|cura[cç]ao|maraschino|falernum|oleo' AS sweet,
               f.i ~ 'soda|\ytonic\y|ginger beer|ginger ale|\ycola\y|seltzer|sparkling water|lemonade|kombucha' AS long,
               f.i ~ 'champagne|prosecco|cava|cremant|sparkling wine|\ysekt\y|lambrusco|franciacorta|pet[- ]nat' AS bubbles,
               f.i ~ 'aperol|campari|aperitiv|select aperitivo|bitter|vermouth|lillet|cocchi|amaro|suze' AS aperitivo,
               f.i ~ 'espresso|coffee|cold brew' AS coffee,
               f.i ~ 'cream|milk' AS cream,
               f.i ~ 'soda' AS soda
        FROM folded f
    ), styled AS (
        -- stylesOf: by the classic it's a version of, its name, its description, or its build (only with lines).
        SELECT x.id, array_agg(s.id ORDER BY s.ord) AS styles
        FROM private.discover_style_rules s
        CROSS JOIN LATERAL (
            SELECT d.id FROM d
            WHERE (d.r <> '' AND d.r = ANY (s.classics))
               OR (s.name_re IS NOT NULL AND d.n ~ s.name_re)
               OR (s.text_re IS NOT NULL AND d.t ~ s.text_re)
               OR (s.riff_re IS NOT NULL AND d.t ~ s.riff_re)
               OR (d.has_lines AND CASE s.id
                      WHEN 'espresso-martini' THEN d.coffee
                      WHEN 'sour' THEN d.citrus AND d.sweet AND NOT d.long AND NOT d.bubbles AND NOT d.cream
                      WHEN 'highball' THEN d.long AND NOT d.bubbles
                      WHEN 'spritz' THEN d.bubbles OR (d.aperitivo AND d.soda)
                      ELSE false
                   END)
        ) x
        GROUP BY x.id
    ), spirited AS (
        -- spiritsOf: from the lines when any match, else the name and description.
        SELECT x.id,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_lines) AS from_lines,
               array_agg(s.id ORDER BY s.ord) FILTER (WHERE x.from_words) AS from_words
        FROM private.discover_spirit_rules s
        CROSS JOIN LATERAL (
            SELECT d.id, d.i ~ s.match_re AS from_lines, (d.n || ' | ' || d.t) ~ s.match_re AS from_words FROM d
        ) x
        GROUP BY x.id
    ), run AS (
        -- Its run on its own bar's menus first, as the public sees them (the
        -- 30-second job has no caller): the one on now, else the latest.
        SELECT DISTINCT ON (r.item_id) r.item_id, r.end_year, r.is_current
        FROM public.drink_menu_runs(ARRAY(SELECT d.id FROM d)) r
        JOIN d ON d.id = r.item_id
        ORDER BY r.item_id, (r.profile_id = d.origin_bar_profile_id) DESC, r.is_current DESC,
                 r.start_year DESC, r.start_month DESC NULLS LAST
    )
    SELECT d.id, d.origin_bar_profile_id, d.name,
           coalesce(st.styles, '{}'),
           coalesce(sp.from_lines, sp.from_words, '{}'),
           coalesce(fl.notes, '{}'),
           private.discover_fold_ws(concat_ws(' | ', d.name, d.riff_name, d.description, array_to_string(d.lines, ' | '))),
           (CASE WHEN run.is_current THEN 0 WHEN run.end_year IS NOT NULL THEN 2 ELSE 1 END) * 4
             + CASE WHEN hero.has THEN 0 ELSE 2 END
             + CASE WHEN d.name ~ '^[[:alpha:]]' THEN 0 ELSE 1 END,
           now()
    FROM d
    LEFT JOIN styled st ON st.id = d.id
    LEFT JOIN spirited sp ON sp.id = d.id
    LEFT JOIN LATERAL (
        SELECT true AS has FROM public.item_images ii WHERE ii.item_id = d.id AND ii.angle = 'hero' LIMIT 1
    ) hero ON true
    LEFT JOIN run ON run.item_id = d.id
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = d.id AND f.coverage >= 0.5
    ) fl ON true
    ON CONFLICT ("item_id") DO UPDATE SET
        "bar_profile_id" = EXCLUDED."bar_profile_id",
        "name" = EXCLUDED."name",
        "styles" = EXCLUDED."styles",
        "spirits" = EXCLUDED."spirits",
        "notes" = EXCLUDED."notes",
        "haystack" = EXCLUDED."haystack",
        "base_rank" = EXCLUDED."base_rank",
        "refreshed_at" = EXCLUDED."refreshed_at";
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$;

-- As 20261028100000_discover_mixed.sql; menu_run comes from drink_menu_runs.
CREATE OR REPLACE FUNCTION "public"."discover_list"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_bar_id" "uuid" DEFAULT NULL,
    "p_styles" "text"[] DEFAULT NULL,
    "p_spirits" "text"[] DEFAULT NULL,
    "p_notes" "text"[] DEFAULT NULL,
    "p_query" "text" DEFAULT NULL,
    "p_after_rank" smallint DEFAULT NULL,
    "p_after_name" "text" DEFAULT NULL,
    "p_after_id" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 30,
    "p_from_latitude" double precision DEFAULT NULL,
    "p_from_longitude" double precision DEFAULT NULL,
    "p_after_distance" integer DEFAULT NULL,
    "p_on_now" boolean DEFAULT false,
    "p_mix" boolean DEFAULT false,
    "p_after_pos" integer DEFAULT NULL
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "description" "text",
    "image_url" "text",
    "bar_profile_id" "uuid",
    "bar_handle" "text",
    "bar_name" "text",
    "bar_logo" "text",
    "bar_locality" "text",
    "bar_city" "text",
    "menu_run" smallint[],
    "rank" smallint,
    "total_drinks" integer,
    "total_bars" integer,
    "match_kind" "text",
    "match_text" "text",
    "distance_m" integer,
    "styles" "text"[],
    "mix_pos" integer
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_from boolean := p_from_latitude IS NOT NULL;
    -- Mixed: a bar at a time (not for Nearest, or one bar's own list).
    v_mix boolean := coalesce(p_mix, false) AND p_from_latitude IS NULL AND p_bar_id IS NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 500);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF (p_after_id IS NULL) <> (p_after_rank IS NULL) OR (p_after_id IS NULL) <> (p_after_name IS NULL) THEN
        RAISE EXCEPTION 'A cursor needs its rank, name and id.' USING ERRCODE = '22023';
    END IF;
    IF (p_from_latitude IS NULL) <> (p_from_longitude IS NULL)
       OR (v_from AND (p_from_latitude NOT BETWEEN -90 AND 90 OR p_from_longitude NOT BETWEEN -180 AND 180)) THEN
        RAISE EXCEPTION 'Nearest needs a point on the map.' USING ERRCODE = '22023';
    END IF;
    IF v_from AND p_after_id IS NOT NULL AND p_after_distance IS NULL THEN
        RAISE EXCEPTION 'A nearest cursor needs its distance.' USING ERRCODE = '22023';
    END IF;
    IF p_after_pos IS NOT NULL AND NOT v_mix THEN
        RAISE EXCEPTION 'A mixed cursor needs the mixed list.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.handle, p.display_name, p.avatar_url, p.locality, p.city,
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded,
               CASE WHEN v_from THEN round(1000 * 2 * 6371.0088 * asin(least(1, sqrt(
                   power(sin(radians(p.latitude - p_from_latitude) / 2), 2)
                   + cos(radians(p_from_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_from_longitude) / 2), 2)
               ))))::integer END AS distance_m,
               -- Mixed: how far from the area's middle, so the nearer of two equal bars goes first.
               CASE WHEN v_mix AND v_point AND p.latitude IS NOT NULL THEN round(1000 * 2 * 6371.0088 * asin(least(1, sqrt(
                   power(sin(radians(p.latitude - p_latitude) / 2), 2)
                   + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
               ))))::integer END AS mix_m
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          -- A bar the viewer hid keeps its drinks off the list, except on its own page.
          AND (p_bar_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.hidden_bars h WHERE h.profile_id = p.id AND h.user_id = (SELECT auth.uid())))
          AND (NOT v_from OR (p.latitude IS NOT NULL AND p.longitude IS NOT NULL))
          AND (p_bar_id IS NULL OR p.id = p_bar_id)
          AND (p_bar_id IS NOT NULL OR p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_bar_id IS NOT NULL OR p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (p_bar_id IS NOT NULL OR NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), standing AS MATERIALIZED (
        -- Each bar's standing for the drinks' ties (not needed for Nearest): 0 the viewer loves it,
        -- 1 relevance 40 or more, 3 stale, else 2.
        SELECT r.id, CASE WHEN r.loved THEN 0 WHEN r.relevance >= 40 THEN 1 WHEN r.stale THEN 3 ELSE 2 END AS bucket
        FROM private.bar_relevance(ARRAY(SELECT bars.id FROM bars WHERE NOT v_from)) r
    ), matched AS MATERIALIZED (
        SELECT f.item_id, f.name, f.bar_profile_id, f.base_rank, f.haystack, f.styles, b.folded AS bar_folded, b.distance_m, b.mix_m,
               coalesce(st.bucket, 2) AS bucket
        FROM public.discover_drink_facts f
        JOIN bars b ON b.id = f.bar_profile_id
        LEFT JOIN standing st ON st.id = f.bar_profile_id
        WHERE (NOT coalesce(p_on_now, false) OR f.base_rank < 4)
          AND (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(b.folded, w) = 0
          ))
    ), hits AS MATERIALIZED (
        -- With a search: the name holds every word (tier 0), else the classic's name does (12), else 24.
        -- Then, within that, its bar's standing: rank = (base_rank + tier) x 4 + bucket. The app
        -- only hands rank back as the cursor, so old builds page through this order unchanged.
        SELECT m.item_id, m.name, m.bar_profile_id, m.distance_m, m.styles, m.mix_m,
               ((m.base_rank + CASE
                   WHEN v_words IS NULL OR private.discover_has_all(private.discover_fold_ws(m.name), v_words) THEN 0
                   -- Looked up only for drinks whose own name missed.
                   WHEN coalesce((
                       SELECT private.discover_has_all(private.discover_fold_ws(rf.name), v_words)
                       FROM public.items i JOIN public.items rf ON rf.id = i.riff_of_id
                       WHERE i.id = m.item_id
                   ), false) THEN 12
                   ELSE 24
               END) * 4 + m.bucket)::smallint AS rank
        FROM matched m
    ), spread AS (
        -- Mixed: each bar's drinks take turns by style (its first Martini, its first Sour, then its second Martini),
        -- best tier first, and a fixed shuffle rather than A to Z among equals.
        SELECT h.item_id, h.bar_profile_id, h.rank, h.mix_m,
               row_number() OVER (PARTITION BY h.bar_profile_id, coalesce(h.styles[1], '') ORDER BY h.rank, md5(h.item_id::text)) AS style_turn
        FROM hits h
        WHERE v_mix
    ), rounds AS (
        SELECT s.*, row_number() OVER (PARTITION BY s.bar_profile_id ORDER BY s.rank, s.style_turn, md5(s.item_id::text)) AS round
        FROM spread s
    ), mixed AS (
        -- Round 1 is one drink from every bar, round 2 the next, and so on. Within a round, nearer bars
        -- first in bands that double (under 1.6 km, then 3.2, 6.4...), so a famous bar across town
        -- doesn't come before the one on the corner; within a band the better rank (tier and the
        -- bar's standing), then the nearer bar.
        -- ponytail: the cursor is a position in this order, so a drink added between two pages can shift
        -- the second page by a row. Fine for a browse list; a keyset on (round, rank, mix_m, bar) if it isn't.
        SELECT r.item_id, row_number() OVER (
                   ORDER BY r.round,
                            CASE WHEN r.mix_m IS NULL THEN 99 ELSE floor(log(2, greatest(r.mix_m, 800) / 800.0))::integer END,
                            r.rank, r.mix_m NULLS LAST, md5(r.bar_profile_id::text), r.item_id
               )::integer AS pos
        FROM rounds r
    ), keyed AS (
        -- What the page sorts on: the position when mixed, the distance for Nearest, else the rank.
        SELECT h.*, CASE WHEN v_from THEN h.distance_m ELSE h.rank END AS sort_key, x.pos
        FROM hits h LEFT JOIN mixed x ON x.item_id = h.item_id
    ), totals AS (
        SELECT count(*)::integer AS drinks, count(DISTINCT h.bar_profile_id)::integer AS bars
        FROM hits h
        WHERE p_after_id IS NULL AND p_after_pos IS NULL
    ), page AS (
        SELECT k.* FROM keyed k
        WHERE CASE WHEN v_mix THEN p_after_pos IS NULL OR k.pos > p_after_pos
                   ELSE p_after_id IS NULL
                     OR (k.sort_key, k.name, k.item_id) > (CASE WHEN v_from THEN p_after_distance ELSE p_after_rank END, p_after_name, p_after_id)
              END
        ORDER BY k.pos, k.sort_key, k.name, k.item_id
        LIMIT v_limit
    )
    SELECT pg.item_id, i.name, i.description, hero.url, pg.bar_profile_id,
           b.handle, b.display_name, b.avatar_url, b.locality, b.city,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           pg.rank,
           CASE WHEN p_after_id IS NULL AND p_after_pos IS NULL THEN (SELECT t.drinks FROM totals t) END,
           CASE WHEN p_after_id IS NULL AND p_after_pos IS NULL THEN (SELECT t.bars FROM totals t) END,
           why.kind,
           why.text,
           pg.distance_m,
           pg.styles,
           pg.pos
    FROM page pg
    JOIN public.items i ON i.id = pg.item_id
    JOIN bars b ON b.id = pg.bar_profile_id
    JOIN matched m ON m.item_id = pg.item_id
    LEFT JOIN public.items rf ON rf.id = i.riff_of_id
    -- The hero: photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
    LEFT JOIN LATERAL (
        SELECT im.url
        FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id = pg.item_id AND ii.angle = 'hero'
        ORDER BY ii.is_generated, coalesce(ii.sort_order, 0)
        LIMIT 1
    ) hero ON true
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.drink_menu_runs(ARRAY[pg.item_id]) r
        ORDER BY (r.profile_id = pg.bar_profile_id) DESC, r.is_current DESC, r.start_year DESC, r.start_month DESC NULLS LAST
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT * FROM private.discover_match_why(v_words, i.name, rf.name, i.description, m.haystack, m.bar_folded)
    ) why ON v_words IS NOT NULL
    ORDER BY pg.pos, pg.sort_key, pg.name, pg.item_id;
END;
$$;


-- As 20261024200000_page_visibility_ladder.sql; menu_run comes from drink_menu_runs.
CREATE OR REPLACE FUNCTION public.discover_drinks(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_after uuid DEFAULT NULL::uuid, p_before uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, name text, description text, riff_of text, ingredients text[], image_url text, bar_profile_id uuid, menu_run smallint[], notes text[])
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
    v_words text[];
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;
    IF v_point AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(public.discover_fold(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH bars AS (
        SELECT p.id, p.display_name
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
          AND p.id NOT IN (SELECT private.private_page_profile_ids())
          AND (p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (NOT v_point OR (
              p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
              AND (
                  v_dlng >= 180
                  OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
                  -- Across the antimeridian.
                  OR p.longitude >= p_longitude - v_dlng + 360
                  OR p.longitude <= p_longitude + v_dlng - 360
              )
              -- Haversine, as private.distance_km.
              AND 2 * 6371.0088 * asin(least(1, sqrt(
                  power(sin(radians(p.latitude - p_latitude) / 2), 2)
                  + cos(radians(p_latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - p_longitude) / 2), 2)
              ))) <= v_radius
          ))
    ), drinks AS (
        SELECT i.id, i.name, i.description, i.riff_of_id, i.origin_bar_profile_id, b.display_name AS bar_name
        FROM public.items i
        JOIN bars b ON b.id = i.origin_bar_profile_id
        WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL
          AND (p_after IS NULL OR i.id > p_after)
          AND (p_before IS NULL OR i.id < p_before)
    ), described AS (
        SELECT d.*, rf.name AS riff_name, ing.names
        FROM drinks d
        LEFT JOIN public.items rf ON rf.id = d.riff_of_id
        -- Ingredients through the role-masked recipe view, as the app read
        -- them. Ids first, then names by id: joining items inside the view's
        -- lateral planned a scan of every item per drink.
        LEFT JOIN LATERAL (
            SELECT array_agg(r.display_ingredient_id ORDER BY r.sort_order) AS ids
            FROM public.app_recipe_presentation r
            WHERE r.recipe_item_id = d.id AND r.display_ingredient_id IS NOT NULL
        ) rec ON true
        LEFT JOIN LATERAL (
            SELECT array_agg(n.name ORDER BY u.ord) AS names
            FROM unnest(rec.ids) WITH ORDINALITY u(id, ord)
            JOIN public.items n ON n.id = u.id
        ) ing ON true
        WHERE v_words IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(v_words) w
            WHERE strpos(
                public.discover_fold(concat_ws(' | ', d.name, rf.name, d.description, array_to_string(ing.names, ' | '), d.bar_name)),
                w
            ) = 0
        )
        ORDER BY d.id
        LIMIT v_limit
    ), heroes AS MATERIALIZED (
        -- The hero: photos before sketches, then their saved order
        -- (lib/itemImages.ts orderedPictures). One read for the page: a
        -- lateral per drink scanned item_images each time.
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT x.id FROM described x) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    )
    SELECT x.id, x.name, x.description, x.riff_name, coalesce(x.names, '{}'), img.url, x.origin_bar_profile_id,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           coalesce(fl.notes, '{}')
    FROM described x
    LEFT JOIN heroes img ON img.item_id = x.id
    -- Its run on its own bar's menus first.
    LEFT JOIN LATERAL (
        SELECT r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
        FROM public.drink_menu_runs(ARRAY[x.id]) r
        ORDER BY (r.profile_id = x.origin_bar_profile_id) DESC, r.is_current DESC, r.start_year DESC, r.start_month DESC NULLS LAST
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.botanical >= 0.4 THEN 'botanical' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.spiced >= 0.4 THEN 'spiced' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.savory >= 0.4 THEN 'savory' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = x.id AND f.coverage >= 0.5
    ) fl ON true
    ORDER BY x.id;
END;
$function$;

-- --- Search over bars' drinks (no screen calls it since 8 Oct; kept for old builds) ---

-- As 20261008800000_db_indexes.sql, with the matches' runs read once.
CREATE OR REPLACE FUNCTION "public"."search_bar_drinks"("p_query" "text", "p_limit" integer DEFAULT 48)
RETURNS TABLE("item_id" "uuid", "credit" "text", "edition_id" "uuid", "edition_name" "text", "start_year" smallint, "start_month" smallint, "end_year" smallint, "end_month" smallint, "is_current" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH q AS (
        SELECT lower(btrim(p_query)) AS text,
               replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') AS pat
    ), matched AS MATERIALIZED (
        SELECT i.id, i.name, coalesce(b.display_name, c.display_name) AS credit, lower(i.name) LIKE q.pat || '%' AS starts
        FROM public.items i
        CROSS JOIN q
        LEFT JOIN public.profiles b ON b.id = i.origin_bar_profile_id
        LEFT JOIN public.profiles c ON c.id = i.creator_profile_id
        WHERE i.item_type = 'cocktail'
          AND i.bar_id IS NULL
          AND i.moderated_at IS NULL
          -- Credited to a bar or bartender the reader can see (a hidden profile's
          -- drinks stay out, as on Discover).
          AND (b.id IS NOT NULL OR c.id IS NOT NULL)
          AND q.text <> ''
          AND (
              lower(i.name) LIKE '%' || q.pat || '%'
              OR lower(i.description) LIKE '%' || q.pat || '%'
              OR lower(b.display_name) LIKE '%' || q.pat || '%'
              OR lower(c.display_name) LIKE '%' || q.pat || '%'
              OR (
                  -- Only the drink's editors can read its lines.
                  (coalesce(i.created_by = auth.uid(), false) OR (SELECT private.is_app_admin()))
                  AND EXISTS (
                      SELECT 1 FROM public.recipes rc
                      JOIN public.items ing ON ing.id = rc.ingredient_item_id
                      WHERE rc.recipe_item_id = i.id AND lower(ing.name) LIKE '%' || q.pat || '%'
                  )
              )
          )
    )
    SELECT m.id, m.credit, r.edition_id, r.edition_name, r.start_year, r.start_month, r.end_year, r.end_month, r.is_current
    FROM matched m
    LEFT JOIN (
        -- One row a bar, as before: its run on now, else its latest.
        SELECT DISTINCT ON (x.item_id, x.profile_id) x.*
        FROM public.drink_menu_runs(ARRAY(SELECT y.id FROM matched y)) x
        ORDER BY x.item_id, x.profile_id, x.is_current DESC, x.start_year DESC, x.start_month DESC NULLS LAST
    ) r ON r.item_id = m.id
    ORDER BY
        CASE WHEN r.is_current THEN 0 WHEN r.item_id IS NULL THEN 1 WHEN r.end_year IS NULL THEN 2 ELSE 3 END,
        m.starts DESC,
        m.name, m.id
    LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;


-- --- Discover hears about venue menus ---

-- As 20261009700000_discover_index.sql, plus a venue's menus: a drink put
-- on or taken off one, and a menu going on, coming off or moving, marks
-- its drinks for the 30-second job.
CREATE OR REPLACE FUNCTION "private"."discover_mark_trigger"()
    RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        -- Only bar drinks, before or after; a drink edit that changes nothing Discover reads is still cheap to redo.
        IF (v_new IS NOT NULL AND v_new->>'item_type' = 'cocktail' AND v_new->>'bar_id' IS NULL AND v_new->>'origin_bar_profile_id' IS NOT NULL)
           OR (v_old IS NOT NULL AND v_old->>'item_type' = 'cocktail' AND v_old->>'bar_id' IS NULL AND v_old->>'origin_bar_profile_id' IS NOT NULL) THEN
            PERFORM private.discover_mark(ARRAY[(coalesce(v_new, v_old)->>'id')::uuid]);
        END IF;
    ELSIF TG_TABLE_NAME = 'recipes' THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'recipe_item_id')::uuid, (v_old->>'recipe_item_id')::uuid]);
    ELSIF TG_TABLE_NAME IN ('item_flavors', 'item_images', 'profile_menu_edition_drinks', 'menu_drinks', 'menu_drinks_removed') THEN
        PERFORM private.discover_mark(ARRAY[(v_new->>'item_id')::uuid, (v_old->>'item_id')::uuid]);
    ELSIF TG_TABLE_NAME = 'profile_menu_editions' THEN
        PERFORM private.discover_mark(ARRAY(
            SELECT d.item_id FROM public.profile_menu_edition_drinks d
            WHERE d.edition_id IN ((v_new->>'id')::uuid, (v_old->>'id')::uuid)
        ));
    ELSIF TG_TABLE_NAME = 'menus' THEN
        PERFORM private.discover_mark(ARRAY(
            SELECT md.item_id FROM public.menu_drinks md WHERE md.menu_id = (v_new->>'id')::uuid
            UNION
            SELECT r.item_id FROM public.menu_drinks_removed r WHERE r.menu_id = (v_new->>'id')::uuid
        ));
    ELSIF TG_TABLE_NAME = 'bars' THEN
        IF v_new->>'page_visibility' IS DISTINCT FROM v_old->>'page_visibility' THEN
            PERFORM private.discover_mark(ARRAY(
                SELECT i.id FROM public.items i JOIN public.profiles p ON p.id = i.origin_bar_profile_id
                WHERE p.bar_id = (v_new->>'id')::uuid AND i.item_type = 'cocktail' AND i.bar_id IS NULL
            ));
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- save_menu rewrites the order of the drinks that stay: only a drink moving
-- to another menu, or swapped for another, counts. A deleted menu's drinks
-- go by cascade, which the delete triggers see.
CREATE TRIGGER "discover_mark" AFTER INSERT OR DELETE OR UPDATE OF "item_id", "menu_id" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
CREATE TRIGGER "discover_mark" AFTER DELETE ON "public"."menu_drinks_removed"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();
-- Going on, coming off (the five-minute sweep flips is_active), going back
-- to a draft or R&D, or moving to another venue.
CREATE TRIGGER "discover_mark" AFTER UPDATE OF "starts_at", "ends_at", "is_active", "kind", "bar_id" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."discover_mark_trigger"();

-- The drinks on venue menus today, so a staffed bar's menu on now counts
-- without waiting for its next change.
SELECT private.discover_mark(ARRAY(
    SELECT DISTINCT md.item_id
    FROM public.menu_drinks md
    JOIN public.menus m ON m.id = md.menu_id
    JOIN public.items i ON i.id = md.item_id
    WHERE m.bar_id IS NOT NULL AND m.kind = 'menu' AND m.starts_at IS NOT NULL
      AND i.item_type = 'cocktail' AND i.bar_id IS NULL
));
