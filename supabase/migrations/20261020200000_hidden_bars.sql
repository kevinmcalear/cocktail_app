-- Hide a bar from Discover (jam 13 Oct, Eddie: "are any of these your
-- favourites? Are any of these you don't want to see?"). Loving a bar puts it
-- first (loved_bars, 20261017000000); hiding one takes it out of Discover for
-- that person: the map (discover_bars), the drinks list (discover_list), Top
-- bars and the drink rankings (both through private.bar_relevance).
--
-- A search that names the bar still finds it on the map, a bar's own page
-- still lists its drinks, and its page stays open. Rows are the person's own,
-- like loved_bars: they read, add and remove only theirs. No age check:
-- hiding something is never a reason to be asked how old you are.
--
-- The three functions below are their current definitions (CREATE OR REPLACE,
-- same signatures, return types and grants) with one added filter each,
-- marked with a comment.

-- --- The table ---

CREATE TABLE "public"."hidden_bars" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "hidden_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "profile_id")
);

COMMENT ON TABLE "public"."hidden_bars" IS 'Bars a person keeps off their Discover (map, drinks list, Top bars, rankings). Own rows only.';

ALTER TABLE "public"."hidden_bars" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hidden_bars_select_own" ON "public"."hidden_bars" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "hidden_bars_delete_own" ON "public"."hidden_bars" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
-- Only a bar's page; a person's profile can't be hidden this way (Block is for people).
CREATE POLICY "hidden_bars_insert_own" ON "public"."hidden_bars" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id" AND "p"."kind" = 'bar')
    );

REVOKE ALL ON "public"."hidden_bars" FROM "anon";
REVOKE UPDATE, TRUNCATE, TRIGGER, REFERENCES ON "public"."hidden_bars" FROM "authenticated";

-- --- Top bars and the drink rankings ---

CREATE OR REPLACE FUNCTION private.bar_relevance(p_ids uuid[])
 RETURNS TABLE(id uuid, loved boolean, stale boolean, relevance integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  WHERE p.id = ANY (p_ids) AND p.kind = 'bar' AND p.is_public
    -- Bars the viewer hid (hidden_bars) drop out of Top bars and the drink rankings.
    AND NOT EXISTS (SELECT 1 FROM public.hidden_bars h WHERE h.profile_id = p.id AND h.user_id = (SELECT auth.uid()));
$function$;

-- --- The map ---

CREATE OR REPLACE FUNCTION public.discover_bars(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_west double precision DEFAULT NULL::double precision, p_south double precision DEFAULT NULL::double precision, p_east double precision DEFAULT NULL::double precision, p_north double precision DEFAULT NULL::double precision, p_styles text[] DEFAULT NULL::text[], p_spirits text[] DEFAULT NULL::text[], p_notes text[] DEFAULT NULL::text[], p_query text DEFAULT NULL::text, p_on_now boolean DEFAULT false)
 RETURNS TABLE(id uuid, handle text, display_name text, avatar_url text, locality text, city text, country_code text, latitude double precision, longitude double precision, is_closed boolean, closed_year integer, drinks integer, on_now integer, brand_accent text, brand_face text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
    v_point boolean := p_latitude IS NOT NULL;
    v_box boolean := p_west IS NOT NULL;
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
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
    IF v_box AND (p_south IS NULL OR p_east IS NULL OR p_north IS NULL OR p_south > p_north) THEN
        RAISE EXCEPTION 'A box needs west, south, east and north.' USING ERRCODE = '22023';
    END IF;
    IF v_point THEN
        v_dlat := v_radius / 111.045;
        v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));
    END IF;
    SELECT array_agg(w) INTO v_words
    FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w
    WHERE w <> '';

    RETURN QUERY
    WITH area AS (
        SELECT p.id, p.handle, p.display_name, p.avatar_url, p.bar_id, p.locality, p.city, p.country_code, p.latitude, p.longitude, p.is_closed, p.closed_year,
               CASE WHEN v_words IS NOT NULL THEN private.discover_fold_ws(p.display_name) END AS folded
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public
          -- A bar the viewer hid stays off the map; a search that names it still finds it.
          AND (NOT EXISTS (SELECT 1 FROM public.hidden_bars h WHERE h.profile_id = p.id AND h.user_id = (SELECT auth.uid()))
               OR (v_words IS NOT NULL AND NOT EXISTS (SELECT 1 FROM unnest(v_words) w WHERE strpos(private.discover_fold_ws(p.display_name), w) = 0)))
          AND (NOT v_box OR (
              p.latitude BETWEEN p_south AND p_north
              AND CASE WHEN p_west <= p_east THEN p.longitude BETWEEN p_west AND p_east
                       ELSE p.longitude >= p_west OR p.longitude <= p_east END
          ))
          AND (v_box OR p_country_code IS NULL OR v_point OR p.country_code = upper(p_country_code))
          AND (v_box OR p_city IS NULL OR v_point OR lower(p.city) = lower(p_city))
          AND (v_box OR NOT v_point OR (
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
    ),
    -- The public brand of the bars with a venue (a few): one read for them all.
    brand AS (
        SELECT * FROM public.bar_brands(ARRAY(SELECT area.id FROM area WHERE area.bar_id IS NOT NULL))
    )
    -- The bar's logo: its page's own picture, else the logo its venue's Brand page set.
    SELECT a.id, a.handle, a.display_name, coalesce(a.avatar_url, vb.logo_url), a.locality, a.city, a.country_code, a.latitude, a.longitude, a.is_closed, a.closed_year::integer,
           CASE WHEN a.is_closed THEN 0 ELSE coalesce(c.n, 0) END::integer,
           CASE WHEN NOT p_on_now THEN NULL WHEN a.is_closed THEN 0 ELSE coalesce(c.on_now, 0) END::integer,
           vb.primary_color, vb.display_face::text
    FROM area a
    LEFT JOIN brand vb ON vb.profile_id = a.id
    LEFT JOIN LATERAL (
        SELECT count(*) AS n,
               -- When asked (search; the map's tiles don't need it): how many of those are on one of the bar's menus now.
               count(*) FILTER (WHERE p_on_now AND EXISTS (
                   SELECT 1
                   FROM public.profile_menu_edition_drinks ed
                   JOIN public.profile_menu_editions e ON e.id = ed.edition_id
                   WHERE ed.item_id = f.item_id AND e.profile_id = a.id AND e.is_current
               )) AS on_now
        FROM public.discover_drink_facts f
        WHERE f.bar_profile_id = a.id
          AND (p_styles IS NULL OR f.styles && p_styles)
          AND (p_spirits IS NULL OR f.spirits && p_spirits)
          AND (p_notes IS NULL OR f.notes && p_notes)
          AND (v_words IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(v_words) w
              WHERE strpos(f.haystack, w) = 0 AND strpos(a.folded, w) = 0
          ))
    ) c ON NOT a.is_closed
    ORDER BY a.id;
END;
$function$;

-- --- The drinks list ---

CREATE OR REPLACE FUNCTION public.discover_list(p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_bar_id uuid DEFAULT NULL::uuid, p_styles text[] DEFAULT NULL::text[], p_spirits text[] DEFAULT NULL::text[], p_notes text[] DEFAULT NULL::text[], p_query text DEFAULT NULL::text, p_after_rank smallint DEFAULT NULL::smallint, p_after_name text DEFAULT NULL::text, p_after_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30, p_from_latitude double precision DEFAULT NULL::double precision, p_from_longitude double precision DEFAULT NULL::double precision, p_after_distance integer DEFAULT NULL::integer, p_on_now boolean DEFAULT false)
 RETURNS TABLE(id uuid, name text, description text, image_url text, bar_profile_id uuid, bar_handle text, bar_name text, bar_logo text, bar_locality text, bar_city text, menu_run smallint[], rank smallint, total_drinks integer, total_bars integer, match_kind text, match_text text, distance_m integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
        SELECT f.item_id, f.name, f.bar_profile_id, f.base_rank, f.haystack, b.folded AS bar_folded, b.distance_m,
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
$function$;
