-- Discover search says why each drink matched. Searching "martini" used to
-- list an Espresso Martini, a Gibson and a Sbagliato made with Martini Rosso
-- side by side with nothing saying why, and a tapped pin showed the bar, not
-- the drink. discover_list now returns, for each drink on the page:
--
--   match_kind: 'name', 'riff' (the classic it's a version of), 'line' (an
--     ingredient), 'description' or 'bar' (its bar's name); null with no search.
--   match_text: the classic's name for 'riff', the ingredient for 'line'.
--
-- and orders a search in three tiers: every word in the drink's name, then
-- every word in its classic's name (riffs), then the rest; within a tier as
-- before (menu, picture, name). The cursor is still (rank, name, id).
--
-- An ingredient is only named when it is already in the drink's haystack,
-- which holds the lines an ordinary reader sees (20261009700000), so a
-- locked spec never gives its lines away here. Older app builds ignore the
-- two new columns.

-- Whether folded text holds every word. False for no text.
CREATE FUNCTION "private"."discover_has_all"("p_text" "text", "p_words" "text"[])
    RETURNS boolean
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(p_text, '') <> '' AND NOT EXISTS (SELECT 1 FROM unnest(p_words) w WHERE strpos(p_text, w) = 0);
$$;

-- Why a drink matched the search words: the first of its name, its
-- classic's name, an ingredient line, its description and its bar's name
-- that holds every word, else the first that holds any. A line is a
-- haystack part that isn't the name, the classic or part of the description,
-- named in title case (the haystack is folded).
CREATE FUNCTION "private"."discover_match_why"("p_words" "text"[], "p_name" "text", "p_riff" "text", "p_description" "text", "p_haystack" "text", "p_bar" "text")
    RETURNS TABLE("kind" "text", "text" "text")
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  WITH f AS (
      SELECT private.discover_fold_ws(p_name) AS n, private.discover_fold_ws(p_riff) AS r, private.discover_fold_ws(p_description) AS t
  ), parts AS (
      SELECT 1 AS ord, 0::bigint AS sub, 'name' AS kind, NULL::text AS text, f.n AS folded FROM f
      UNION ALL SELECT 2, 0, 'riff', p_riff, f.r FROM f
      UNION ALL
      SELECT 3, x.o, 'line', initcap(x.part), x.part
      FROM f, unnest(string_to_array(p_haystack, ' | ')) WITH ORDINALITY x(part, o)
      WHERE x.part <> '' AND x.part <> f.n AND x.part <> f.r AND strpos(f.t, x.part) = 0
      UNION ALL SELECT 4, 0, 'description', NULL, f.t FROM f
      UNION ALL SELECT 5, 0, 'bar', NULL, p_bar
  )
  SELECT p.kind, p.text
  FROM parts p
  WHERE coalesce(p.folded, '') <> '' AND EXISTS (SELECT 1 FROM unnest(p_words) w WHERE strpos(p.folded, w) > 0)
  ORDER BY NOT private.discover_has_all(p.folded, p_words), p.ord, p.sub
  LIMIT 1;
$$;

DROP FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer);

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
    "p_limit" integer DEFAULT 30
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
    "match_text" "text"
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
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
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND NOT p.is_closed
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
    ), matched AS MATERIALIZED (
        SELECT f.item_id, f.name, f.bar_profile_id, f.base_rank, f.haystack, b.folded AS bar_folded
        FROM public.discover_drink_facts f
        JOIN bars b ON b.id = f.bar_profile_id
        WHERE (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(b.folded, w) = 0
          ))
    ), hits AS MATERIALIZED (
        -- With a search: the name holds every word (tier 0), else the classic's name does (12), else 24.
        SELECT m.item_id, m.name, m.bar_profile_id,
               (m.base_rank + CASE
                   WHEN v_words IS NULL OR private.discover_has_all(private.discover_fold_ws(m.name), v_words) THEN 0
                   WHEN private.discover_has_all(private.discover_fold_ws(rf.name), v_words) THEN 12
                   ELSE 24
               END)::smallint AS rank
        FROM matched m
        LEFT JOIN public.items i ON v_words IS NOT NULL AND i.id = m.item_id
        LEFT JOIN public.items rf ON rf.id = i.riff_of_id
    ), totals AS (
        SELECT count(*)::integer AS drinks, count(DISTINCT h.bar_profile_id)::integer AS bars
        FROM hits h
        WHERE p_after_id IS NULL
    ), page AS (
        SELECT h.* FROM hits h
        WHERE p_after_id IS NULL OR (h.rank, h.name, h.item_id) > (p_after_rank, p_after_name, p_after_id)
        ORDER BY h.rank, h.name, h.item_id
        LIMIT v_limit
    )
    SELECT pg.item_id, i.name, i.description, hero.url, pg.bar_profile_id,
           b.handle, b.display_name, b.avatar_url, b.locality, b.city,
           CASE WHEN run.start_year IS NOT NULL THEN
               ARRAY[run.start_year, run.start_month, run.end_year, run.end_month, run.is_current::integer::smallint]
           END,
           pg.rank,
           CASE WHEN p_after_id IS NULL THEN (SELECT t.drinks FROM totals t) END,
           CASE WHEN p_after_id IS NULL THEN (SELECT t.bars FROM totals t) END,
           why.kind,
           why.text
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
    ORDER BY pg.rank, pg.name, pg.item_id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_list"(double precision, double precision, double precision, "text", "text", "uuid", "text"[], "text"[], "text"[], "text", smallint, "text", "uuid", integer) TO "authenticated", "service_role";
