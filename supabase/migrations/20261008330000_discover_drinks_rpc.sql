-- Discover reads in SQL, so the app stops downloading whole tables.
--
--   discover_drinks   the bar drinks Discover shows, for an area (near a
--                     point, in a city, or anywhere) and optionally a typed
--                     search, a page at a time (keyset on id). One row per
--                     drink with only what the screen renders: names of its
--                     ingredients, its hero picture, its bar, its run on the
--                     bar's menus and its strong tasting notes. Before this
--                     the app paged every public bar, every menu run and all
--                     ~7,000 bar drinks with nested embeds (about 2.5 MB) on
--                     every cold start.
--   flavor_baseline   the average flavor profile of the drinks the caller
--                     can see: what "usual" means on a drink page and in
--                     For you's reasons.
--   flavor_for_you    the drinks closest to a taste, leaving out ones the
--                     caller ranked. Both used to page every item_flavors
--                     row (each checked by the items policy) to the phone.
--
-- All three run as the caller (SECURITY INVOKER), so the items, profiles,
-- images and flavor policies and the role-masked recipe view decide what
-- comes back, exactly as the app's own selects did. Signed-in only, like
-- every shared drink.

-- Lower case with the accents of Latin letters taken off, close to the app's
-- foldName (NFD, combining marks removed). Characters NFD leaves alone are
-- mapped too; folding more on both sides only widens a match, and the app
-- still applies its own search to what comes back.
-- ponytail: translate() rather than the unaccent extension, which isn't
-- installed. Upgrade path: unaccent if non-Latin search ever matters.
CREATE FUNCTION "public"."discover_fold"("p_text" "text")
    RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT lower(translate(coalesce(p_text, ''),
    'ÀÁÂÃÄÅĀĂĄàáâãäåāăąÇĆĈĊČçćĉċčĎďÈÉÊËĒĔĖĘĚèéêëēĕėęěĜĞĠĢĝğġģĤĥÌÍÎÏĨĪĬĮİìíîïĩīĭįĴĵĶķĹĻĽĺļľÑŃŅŇñńņňÒÓÔÕÖŌŎŐòóôõöōŏőŔŖŘŕŗřŚŜŞŠśŝşšŢŤţťÙÚÛÜŨŪŬŮŰŲùúûüũūŭůűųŴŵÝŸŶýÿŷŹŻŽźżž',
    'AAAAAAAAAaaaaaaaaaCCCCCcccccDdEEEEEEEEEeeeeeeeeeGGGGggggHhIIIIIIIIIiiiiiiiiJjKkLLLlllNNNNnnnnOOOOOOOOooooooooRRRrrrSSSSssssTTttUUUUUUUUUUuuuuuuuuuuWwYYYyyyZZZzzz'));
$$;

REVOKE ALL ON FUNCTION "public"."discover_fold"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_fold"("text") TO "authenticated", "service_role";

-- --- Discover's drinks ---

-- Area rules as private.bars_in_area (20260928210000), written out here
-- because callers can't execute private helpers: within p_radius_km (kept
-- between 100 m and 200 km) of a point, else in a city and/or country, else
-- anywhere. Closed bars are left out, as Discover always has.
--
-- p_query: every word must appear in the drink's name, the classic it's a
-- version of, its description, its ingredients or its bar's name (folded as
-- above). The app sends it when searching everywhere, so a search no longer
-- needs every drink on the phone; in an area it filters the area's drinks
-- itself.
--
-- Pages: ordered by id, after p_after and before p_before (both optional),
-- up to p_limit (at most 1000, PostgREST's row cap). The app splits
-- "anywhere" into id ranges and loads them side by side.
--
-- notes: the tasting notes a drink has at 0.4 or more (lib/flavor.ts
-- NOTE_MIN), from a profile covering at least half its spec (MIN_COVERAGE).
-- Strong isn't a note Discover filters by.
--
-- menu_run: the drink's run on its bar's menus (menu_drink_runs) as
-- [start year, start month, end year, end month, 1 if on now else 0], or
-- NULL when it was never on a menu. An array rather than five columns: it
-- keeps "anywhere" (every bar drink) about a fifth smaller.
CREATE FUNCTION "public"."discover_drinks"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_query" "text" DEFAULT NULL,
    "p_after" "uuid" DEFAULT NULL,
    "p_before" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 1000
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "description" "text",
    "riff_of" "text",
    "ingredients" "text"[],
    "image_url" "text",
    "bar_profile_id" "uuid",
    "menu_run" smallint[],
    "notes" "text"[]
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
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
        FROM public.menu_drink_runs r
        WHERE r.item_id = x.id
        ORDER BY (r.profile_id = x.origin_bar_profile_id) DESC, r.is_current DESC
        LIMIT 1
    ) run ON true
    LEFT JOIN LATERAL (
        SELECT array_remove(ARRAY[
            CASE WHEN f.sweet >= 0.4 THEN 'sweet' END,
            CASE WHEN f.sour >= 0.4 THEN 'sour' END,
            CASE WHEN f.bitter >= 0.4 THEN 'bitter' END,
            CASE WHEN f.herbal >= 0.4 THEN 'herbal' END,
            CASE WHEN f.fruity >= 0.4 THEN 'fruity' END,
            CASE WHEN f.smoky >= 0.4 THEN 'smoky' END,
            CASE WHEN f.spicy >= 0.4 THEN 'spicy' END,
            CASE WHEN f.creamy >= 0.4 THEN 'creamy' END
        ], NULL) AS notes
        FROM public.item_flavors f
        WHERE f.item_id = x.id AND f.coverage >= 0.5
    ) fl ON true
    ORDER BY x.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."discover_drinks"(double precision, double precision, double precision, "text", "text", "text", "uuid", "uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_drinks"(double precision, double precision, double precision, "text", "text", "text", "uuid", "uuid", integer) TO "authenticated", "service_role";

-- --- Flavor ---

-- The average profile over the usable profiles the caller can see.
CREATE FUNCTION "public"."flavor_baseline"()
    RETURNS TABLE("sweet" real, "sour" real, "bitter" real, "strong" real, "herbal" real, "fruity" real, "smoky" real, "spicy" real, "creamy" real, "drinks" integer)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  SELECT avg(f.sweet)::real, avg(f.sour)::real, avg(f.bitter)::real, avg(f.strong)::real, avg(f.herbal)::real,
         avg(f.fruity)::real, avg(f.smoky)::real, avg(f.spicy)::real, avg(f.creamy)::real, count(*)::integer
  FROM public.item_flavors f
  WHERE f.coverage >= 0.5;
$$;

REVOKE ALL ON FUNCTION "public"."flavor_baseline"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."flavor_baseline"() TO "authenticated", "service_role";

-- For you: the usable profiles nearest a taste (root-mean-square gap over
-- the dimensions the taste has, lib/flavor.ts distance), nearest first, then
-- by name; drinks the caller ranked (as the drink or the list) are left out.
-- p_taste is {"sweet": 0.6, ...}; keys that aren't dimensions, and values
-- that aren't numbers, are ignored. No dimensions: nothing.
CREATE FUNCTION "public"."flavor_for_you"("p_taste" "jsonb", "p_limit" integer DEFAULT 10)
    RETURNS TABLE("id" "uuid", "name" "text", "image_url" "text", "is_classic" boolean, "riff_of_id" "uuid",
                  "sweet" real, "sour" real, "bitter" real, "strong" real, "herbal" real, "fruity" real, "smoky" real, "spicy" real, "creamy" real)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  WITH taste AS (
    SELECT t.key AS dim, (t.value #>> '{}')::real AS v
    FROM jsonb_each(CASE WHEN jsonb_typeof(p_taste) = 'object' THEN p_taste ELSE '{}'::jsonb END) t
    WHERE t.key IN ('sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy')
      AND jsonb_typeof(t.value) = 'number'
  ), ranked AS (
    SELECT e.item_id AS id FROM public.rank_entries e WHERE e.user_id = (SELECT auth.uid())
    UNION
    SELECT e.ranked_as_item_id FROM public.rank_entries e WHERE e.user_id = (SELECT auth.uid())
  ), scored AS (
    SELECT f.*, (
      SELECT sqrt(avg(power(t.v - CASE t.dim
          WHEN 'sweet' THEN f.sweet WHEN 'sour' THEN f.sour WHEN 'bitter' THEN f.bitter
          WHEN 'strong' THEN f.strong WHEN 'herbal' THEN f.herbal WHEN 'fruity' THEN f.fruity
          WHEN 'smoky' THEN f.smoky WHEN 'spicy' THEN f.spicy ELSE f.creamy END, 2)))
      FROM taste t
    ) AS gap
    FROM public.item_flavors f
    WHERE f.coverage >= 0.5
      AND EXISTS (SELECT 1 FROM taste)
      AND NOT EXISTS (SELECT 1 FROM ranked r WHERE r.id = f.item_id)
  ), nearest AS (
    SELECT s.*, i.name, i.bar_id, i.riff_of_id
    FROM scored s
    JOIN public.items i ON i.id = s.item_id
    ORDER BY s.gap, i.name, i.id
    LIMIT least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  SELECT n.item_id, n.name,
         (SELECT im.url FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
          WHERE ii.item_id = n.item_id AND ii.angle = 'hero'
          ORDER BY ii.is_generated, coalesce(ii.sort_order, 0) LIMIT 1),
         n.bar_id IS NULL AND n.riff_of_id IS NULL, n.riff_of_id,
         n.sweet, n.sour, n.bitter, n.strong, n.herbal, n.fruity, n.smoky, n.spicy, n.creamy
  FROM nearest n
  ORDER BY n.gap, n.name, n.item_id;
$$;

REVOKE ALL ON FUNCTION "public"."flavor_for_you"("jsonb", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."flavor_for_you"("jsonb", integer) TO "authenticated", "service_role";
