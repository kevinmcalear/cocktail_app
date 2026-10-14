-- Discover's bar order: what a bar has going for it, not its name.
--
-- Eddie (Caretaker's Cottage, 13 Oct): "I keep seeing 1806, which is so out
-- of date, but because it's a number I assume that's why it keeps popping
-- up." Nobody has 20 rankers yet, so every bar on Top bars was unranked, and
-- unranked bars were ordered by distance, then name. A city has no distance,
-- so a city's Top bars was alphabetical and a name starting with a digit
-- came first.
--
-- Unranked bars now go in this order:
--   1. bars the viewer loves (signed in), so their own favourites lead;
--   2. bars people have started ranking, most rankers first (as before);
--   3. relevance (private.bar_relevance), from data we already keep;
--   4. distance, when there is a point;
--   5. name and id, only so the order is stable.
-- Ranked bars (20+ rankers) still come first, by score.
--
-- A bar whose newest dated data (a menu, an award, its claim) is older than
-- private.bar_stale_after() (3 years) drops off Top bars, unless the viewer
-- loves it or people have ranked drinks there. It stays on the map and in
-- search. A bar with no dates at all isn't stale, only unscored.
--
-- "Best Martini" (discover_drink_rankings) breaks ties the same way.
--
-- The drinks list (discover_list) had the same flaw: drinks that sort alike
-- (most of them: on a menu now, no photo) went by name, so 1806's "A Promise
-- to Keep" led Discover near the Melbourne CBD. Within each of its sort
-- tiers it now puts the drinks of bars the viewer loves first, then strong
-- bars (relevance 40+), then the rest, then stale bars; name only after that.
--
-- Same signatures, return types and grants: CREATE OR REPLACE keeps them.

-- --- The threshold ---

CREATE FUNCTION "private"."bar_stale_after"() RETURNS interval
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$ SELECT interval '3 years' $$;

-- --- Relevance ---

-- The drinks with a spec (a line with an amount): a small slice of recipes
-- (locally 3,765 of 49,060 lines), so relevance reads this, not the table.
CREATE INDEX "recipes_with_amount_idx" ON "public"."recipes" ("recipe_item_id") WHERE "amount" IS NOT NULL;

-- For each bar in p_ids: whether the viewer loves it, whether its data is
-- stale, and a relevance score. Points:
--   40  a venue on Cocktail (the page is claimed, or is a venue's own)
--   20  a menu on now; else 10 for a menu that ended in the last year
--   15  an award or list place in the last three years
--   up to 30  people who love it, 3 each, counted to 10
--   up to 20  drinks with a photo or a spec (amounts), 2 each, counted to 10
--   up to 10  drinks at all, 1 for every 3, counted to 30
-- Public bar pages only. Read only. SECURITY DEFINER because it counts
-- every person's loves (a count only, capped, never returned on its own;
-- loved_bars is otherwise own rows only). Signed-in people can run it
-- because discover_list runs as its caller; the API doesn't expose the
-- private schema, so it's reachable only through the readers below.
CREATE FUNCTION "private"."bar_relevance"("p_ids" "uuid"[])
RETURNS TABLE("id" "uuid", "loved" boolean, "stale" boolean, "relevance" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH menus AS (
    SELECT e.profile_id,
           bool_or(e.is_current) AS on_now,
           -- When the newest menu was last known to be on: today when it's on now, else its end, else its start.
           max(CASE WHEN e.is_current THEN current_date
                    ELSE make_date(coalesce(e.end_year, e.year), coalesce(CASE WHEN e.end_year IS NOT NULL THEN e.end_month ELSE e.month END, 12), 1)
               END) AS last_on
    FROM public.profile_menu_editions e
    WHERE e.profile_id = ANY (p_ids)
    GROUP BY e.profile_id
  ), awards AS (
    SELECT a.profile_id, max(a.year) AS last_year
    FROM public.profile_awards a
    WHERE a.profile_id = ANY (p_ids)
    GROUP BY a.profile_id
  ), drinks AS (
    -- base_rank: menu (on now 0, undated 1, past 2) x 4, + 2 with no picture, + 1 (20261009700000).
    -- A spec: a line with an amount (recipes_with_amount_idx, below).
    SELECT f.bar_profile_id, count(*) AS n,
           count(*) FILTER (WHERE f.base_rank % 4 < 2 OR EXISTS (
               SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = f.item_id AND r.amount IS NOT NULL
           )) AS shown
    FROM public.discover_drink_facts f
    WHERE f.bar_profile_id = ANY (p_ids)
    GROUP BY f.bar_profile_id
  ), loves AS (
    SELECT l.profile_id, count(*) AS n, bool_or(l.user_id = (SELECT auth.uid())) AS mine
    FROM public.loved_bars l
    WHERE l.profile_id = ANY (p_ids)
    GROUP BY l.profile_id
  )
  SELECT p.id,
         coalesce(lv.mine, false),
         coalesce(greatest(m.last_on, make_date(aw.last_year, 12, 31), p.claimed_at::date) < current_date - private.bar_stale_after(), false),
         (CASE WHEN p.bar_id IS NOT NULL OR p.claimed_at IS NOT NULL THEN 40 ELSE 0 END
          + CASE WHEN m.on_now THEN 20 WHEN m.last_on >= current_date - interval '1 year' THEN 10 ELSE 0 END
          + CASE WHEN aw.last_year >= extract(year FROM current_date) - 2 THEN 15 ELSE 0 END
          + 3 * least(coalesce(lv.n, 0), 10)
          + 2 * least(coalesce(d.shown, 0), 10)
          + least(coalesce(d.n, 0), 30) / 3)::integer
  FROM public.profiles p
  LEFT JOIN menus m ON m.profile_id = p.id
  LEFT JOIN awards aw ON aw.profile_id = p.id
  LEFT JOIN drinks d ON d.bar_profile_id = p.id
  LEFT JOIN loves lv ON lv.profile_id = p.id
  WHERE p.id = ANY (p_ids) AND p.kind = 'bar' AND p.is_public;
$$;

REVOKE ALL ON FUNCTION "private"."bar_stale_after"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."bar_relevance"("uuid"[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."bar_stale_after"() TO "service_role";
GRANT EXECUTE ON FUNCTION "private"."bar_relevance"("uuid"[]) TO "authenticated", "service_role";

-- --- Top bars ---

CREATE OR REPLACE FUNCTION "public"."discover_top_bars"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_limit" integer DEFAULT 20
) RETURNS TABLE("position" bigint, "venue_profile_id" "uuid", "handle" "text", "display_name" "text",
                "locality" "text", "city" "text", "latitude" double precision, "longitude" double precision,
                "distance_km" double precision, "score" numeric, "rankers" integer, "drinks" integer, "is_early" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH area AS MATERIALIZED (
    SELECT * FROM private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city)
  ), rows AS (
    SELECT a.id AS venue_profile_id, s.score, coalesce(s.rankers, 0) AS rankers, coalesce(s.drinks, 0) AS drinks,
           a.distance_km, coalesce(s.rankers, 0) >= private.ranking_min_rankers() AS ranked,
           r.loved, r.stale, r.relevance
    FROM area a
    JOIN private.bar_relevance(ARRAY(SELECT area.id FROM area)) r ON r.id = a.id
    LEFT JOIN private.venue_scores s ON s.venue_profile_id = a.id
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST,
               CASE WHEN NOT r.ranked THEN r.loved END DESC,
               r.rankers DESC, r.relevance DESC, r.distance_km NULLS LAST,
               lower(p.display_name), r.venue_profile_id
    ) AS n
    FROM rows r
    JOIN public.profiles p ON p.id = r.venue_profile_id
    -- Stale bars drop off, unless loved by the viewer or ranked there.
    WHERE r.ranked OR r.loved OR r.rankers > 0 OR NOT r.stale
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, x.drinks, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$$;

-- --- Best <drink> ---

CREATE OR REPLACE FUNCTION "public"."discover_drink_rankings"(
    "p_ranked_as_item_id" "uuid",
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_limit" integer DEFAULT 20
) RETURNS TABLE("position" bigint, "venue_profile_id" "uuid", "handle" "text", "display_name" "text",
                "locality" "text", "city" "text", "latitude" double precision, "longitude" double precision,
                "distance_km" double precision, "score" numeric, "rankers" integer, "is_early" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH rows AS MATERIALIZED (
    SELECT v.venue_profile_id, v.score, v.rankers, a.distance_km,
           v.rankers >= private.ranking_min_rankers() AS ranked
    FROM private.venue_drink_scores v
    JOIN private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a ON a.id = v.venue_profile_id
    WHERE v.ranked_as_item_id = p_ranked_as_item_id
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST,
               CASE WHEN NOT r.ranked THEN b.loved END DESC,
               r.rankers DESC, b.relevance DESC, r.distance_km NULLS LAST, r.venue_profile_id
    ) AS n
    FROM rows r
    JOIN private.bar_relevance(ARRAY(SELECT rows.venue_profile_id FROM rows)) b ON b.id = r.venue_profile_id
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$$;

-- --- The drinks list ---

-- As 20261010625000, with each bar's standing between a drink's tier and its name.
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
    "p_after_distance" integer DEFAULT NULL
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
    "distance_m" integer
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_from boolean := p_from_latitude IS NOT NULL;
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
               ))))::integer END AS distance_m
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
        SELECT f.item_id, f.name, f.bar_profile_id, f.base_rank, f.haystack, b.folded AS bar_folded, b.distance_m,
               coalesce(st.bucket, 2) AS bucket
        FROM public.discover_drink_facts f
        JOIN bars b ON b.id = f.bar_profile_id
        LEFT JOIN standing st ON st.id = f.bar_profile_id
        WHERE (p_styles IS NULL OR f.styles && p_styles)
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
        SELECT m.item_id, m.name, m.bar_profile_id, m.distance_m,
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
    ), keyed AS (
        -- What the page sorts on: the distance for Nearest, else the rank.
        SELECT h.*, CASE WHEN v_from THEN h.distance_m ELSE h.rank END AS sort_key FROM hits h
    ), totals AS (
        SELECT count(*)::integer AS drinks, count(DISTINCT h.bar_profile_id)::integer AS bars
        FROM hits h
        WHERE p_after_id IS NULL
    ), page AS (
        SELECT k.* FROM keyed k
        WHERE p_after_id IS NULL
           OR (k.sort_key, k.name, k.item_id) > (CASE WHEN v_from THEN p_after_distance ELSE p_after_rank END, p_after_name, p_after_id)
        ORDER BY k.sort_key, k.name, k.item_id
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
           why.text,
           pg.distance_m
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
    ORDER BY pg.sort_key, pg.name, pg.item_id;
END;
$$;
