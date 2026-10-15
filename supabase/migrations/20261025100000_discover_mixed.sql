-- Discover's drinks list mixes bars (Kevin, 15 Oct; options canvas J4izF7VeHzssQG9VjyZs6s, A).
-- Browsing sorted by rank then name, and nearly every drink in an area ties on
-- rank, so the bar with the best standing filled the list A to Z (34 Dante
-- drinks before any of the 15 other bars within half a kilometre).
--
-- discover_list gains p_mix: one drink from every bar, then a second from
-- every bar, and so on; a bar's drinks take turns by style. Within a round,
-- nearer bars first in distance bands from the area's middle (under 1.6 km,
-- then 3.2, 6.4...), and within a band the better rank (on now, with a
-- picture, the bar's standing), then the nearer bar. The page cursor is p_after_pos, the
-- position returned as mix_pos. Not with Nearest or one bar's own list.
-- Rows also return the drink's styles (the "Zero-proof" tag).
--
-- New arguments and columns are a new signature: drop the old one and grant
-- the new. Without p_mix, as 20261019200000, so old builds are unchanged.

DROP FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer, double precision, double precision, integer, boolean);

CREATE FUNCTION "public"."discover_list"(
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
        FROM public.menu_drink_runs r
        WHERE r.item_id = pg.item_id
        ORDER BY (r.profile_id = pg.bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT * FROM private.discover_match_why(v_words, i.name, rf.name, i.description, m.haystack, m.bar_folded)
    ) why ON v_words IS NOT NULL
    ORDER BY pg.pos, pg.sort_key, pg.name, pg.item_id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer, double precision, double precision, integer, boolean, boolean, integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer, double precision, double precision, integer, boolean, boolean, integer) TO "authenticated", "service_role";
