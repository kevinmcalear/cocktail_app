-- Discover near me: rankings around a point, a score per bar, "early" lists,
-- and bars that anyone signed in can add.
--
-- 1. Near me. private.bars_in_area() finds public bar profiles around a point
--    (plain haversine distance, after a latitude/longitude box that
--    profiles_bar_location_idx serves), or in a city or country, or anywhere.
--    The point is only an argument: nothing here stores it.
--
-- 2. Bar score (private.venue_scores, refreshed hourly with the other
--    rankings). A bar's score is the average of its drinks' scores in
--    private.venue_drink_scores, weighted by how many people ranked each:
--      score = sum(drink score x drink rankers) / sum(drink rankers)
--    Each drink score is already a Bayesian average pulled towards that
--    drink's mean everywhere, so a drink three people ranked moves a bar
--    little. `rankers` is distinct people across all the bar's drinks, and
--    staff never count at their own bar (as in venue_drink_scores). A bar
--    gets a score once private.ranking_min_rankers() (20) different people
--    have ranked anything there.
--
-- 3. Early. Below that minimum, lists still show which bars people are
--    ranking and how many, but no score and no position: a score from a
--    handful of people would be close to reading their private rankings.
--    discover_drink_rankings() and discover_top_bars() return ranked rows
--    (is_early false) and early rows (is_early true, score and position
--    NULL) together; the app shows the early ones only when nothing is
--    ranked yet.
--
-- 4. Adding a bar. Until now only catalog admins could make an unclaimed
--    venue profile. add_venue() lets any signed-in person add a bar they
--    visited, public and unclaimed, so it can be ranked and claimed later.
--    Guarded: a name, street address, city, country and coordinates are
--    required; ten a day per person (moderators exempt); refused when a bar
--    with the same name is already within 150 m. The direct INSERT policy on
--    profiles is unchanged, so this function is the only way in, and the
--    person who added a bar can't edit or delete it: the bar claims it
--    (profile_claims, as before) and moderators edit, hide or remove it.

-- --- Distance ---

-- Great-circle distance in km (haversine, mean Earth radius).
CREATE FUNCTION "private"."distance_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision)
    RETURNS double precision
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT 2 * 6371.0088 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

CREATE INDEX "profiles_bar_location_idx" ON "public"."profiles" ("latitude", "longitude")
    WHERE "kind" = 'bar' AND "latitude" IS NOT NULL;

-- Public bars in an area: within p_radius_km of a point when one is given,
-- otherwise in a city and/or country, otherwise everywhere. The radius is
-- kept between 100 m and 200 km. distance_km is NULL without a point.
CREATE FUNCTION "private"."bars_in_area"(
    "p_latitude" double precision,
    "p_longitude" double precision,
    "p_radius_km" double precision,
    "p_country_code" "text",
    "p_city" "text"
) RETURNS TABLE("id" "uuid", "distance_km" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_radius double precision := least(greatest(coalesce(p_radius_km, 10), 0.1), 200);
    v_dlat double precision;
    v_dlng double precision;
BEGIN
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'A point needs both a latitude and a longitude.' USING ERRCODE = '22023';
    END IF;

    IF p_latitude IS NULL THEN
        RETURN QUERY
        SELECT p.id, NULL::double precision
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public
          AND (p_country_code IS NULL OR p.country_code = upper(p_country_code))
          AND (p_city IS NULL OR lower(p.city) = lower(p_city));
        RETURN;
    END IF;

    IF p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'That point is off the map.' USING ERRCODE = '22023';
    END IF;

    -- The box around the circle; wider in longitude away from the equator.
    v_dlat := v_radius / 111.045;
    v_dlng := v_radius / (111.045 * greatest(cos(radians(p_latitude)), 0.01));

    RETURN QUERY
    SELECT b.id, b.d
    FROM (
        SELECT p.id, private.distance_km(p_latitude, p_longitude, p.latitude, p.longitude) AS d
        FROM public.profiles p
        WHERE p.kind = 'bar' AND p.is_public AND p.latitude IS NOT NULL
          AND p.latitude BETWEEN p_latitude - v_dlat AND p_latitude + v_dlat
          AND (
              v_dlng >= 180
              OR p.longitude BETWEEN p_longitude - v_dlng AND p_longitude + v_dlng
              -- Across the antimeridian.
              OR p.longitude >= p_longitude - v_dlng + 360
              OR p.longitude <= p_longitude + v_dlng - 360
          )
    ) b
    WHERE b.d <= v_radius;
END;
$$;

-- --- Bar scores ---

CREATE MATERIALIZED VIEW "private"."venue_scores" AS
WITH "people" AS (
    SELECT "s"."venue_profile_id", count(DISTINCT "s"."user_id")::integer AS "rankers"
    FROM "public"."rank_entry_scores" "s"
    JOIN "public"."profiles" "p" ON "p"."id" = "s"."venue_profile_id"
    WHERE NOT EXISTS (
        SELECT 1 FROM "public"."user_bars" "ub" WHERE "ub"."user_id" = "s"."user_id" AND "ub"."bar_id" = "p"."bar_id"
    )
    GROUP BY 1
)
SELECT
    "v"."venue_profile_id",
    round(sum("v"."score" * "v"."rankers") / sum("v"."rankers"), 1) AS "score",
    "pe"."rankers",
    count(*)::integer AS "drinks"
FROM "private"."venue_drink_scores" "v"
JOIN "people" "pe" USING ("venue_profile_id")
GROUP BY "v"."venue_profile_id", "pe"."rankers";

CREATE UNIQUE INDEX "venue_scores_key" ON "private"."venue_scores" ("venue_profile_id");

REVOKE ALL ON "private"."venue_scores" FROM PUBLIC, "anon", "authenticated";

-- venue_scores reads venue_drink_scores, so it refreshes after it.
CREATE OR REPLACE FUNCTION "private"."refresh_rankings"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY private.venue_drink_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY private.item_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY private.venue_scores;
END;
$$;

-- --- Discover reads (anyone, signed in or not) ---

-- "Best martini near me / in New York / anywhere": bars whose version enough
-- people ranked, best first (position and score set), then early ones, most
-- rankers first (position and score NULL). Up to p_limit of each.
CREATE FUNCTION "public"."discover_drink_rankings"(
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
  WITH rows AS (
    SELECT v.venue_profile_id, v.score, v.rankers, a.distance_km,
           v.rankers >= private.ranking_min_rankers() AS ranked
    FROM private.venue_drink_scores v
    JOIN private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a ON a.id = v.venue_profile_id
    WHERE v.ranked_as_item_id = p_ranked_as_item_id
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST, r.rankers DESC, r.distance_km NULLS LAST, r.venue_profile_id
    ) AS n
    FROM rows r
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$$;

-- "Top bars near me": bars by their bar score, then early ones by rankers.
-- Same area rules and row shape as discover_drink_rankings, plus how many
-- drinks have been ranked there.
CREATE FUNCTION "public"."discover_top_bars"(
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
  WITH rows AS (
    SELECT s.venue_profile_id, s.score, s.rankers, s.drinks, a.distance_km,
           s.rankers >= private.ranking_min_rankers() AS ranked
    FROM private.venue_scores s
    JOIN private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a ON a.id = s.venue_profile_id
  ), numbered AS (
    SELECT r.*, row_number() OVER (
      PARTITION BY r.ranked
      ORDER BY CASE WHEN r.ranked THEN r.score END DESC NULLS LAST, r.rankers DESC, r.distance_km NULLS LAST, r.venue_profile_id
    ) AS n
    FROM rows r
  )
  SELECT CASE WHEN x.ranked THEN x.n END, p.id, p.handle, p.display_name, p.locality, p.city, p.latitude, p.longitude,
         x.distance_km, CASE WHEN x.ranked THEN x.score END, x.rankers, x.drinks, NOT x.ranked
  FROM numbered x
  JOIN public.profiles p ON p.id = x.venue_profile_id
  WHERE x.n <= least(greatest(coalesce(p_limit, 20), 1), 100)
  ORDER BY x.ranked DESC, x.n;
$$;

-- One public bar's score for its profile page. No row: nobody has ranked a
-- drink there yet. Score NULL (is_early): fewer than the minimum have.
CREATE FUNCTION "public"."get_venue_score"("p_venue_profile_id" "uuid")
    RETURNS TABLE("score" numeric, "rankers" integer, "drinks" integer, "is_early" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE WHEN s.rankers >= private.ranking_min_rankers() THEN s.score END,
         s.rankers, s.drinks, s.rankers < private.ranking_min_rankers()
  FROM private.venue_scores s
  JOIN public.profiles p ON p.id = s.venue_profile_id
  WHERE s.venue_profile_id = p_venue_profile_id AND p.kind = 'bar' AND p.is_public;
$$;

-- --- Adding a bar ---

-- How many bars a person may add in a day, moderators aside.
CREATE FUNCTION "private"."venue_add_daily_limit"() RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ SELECT 10 $$;

-- "The Dead Rabbit" and "dead rabbit!" are the same name.
CREATE FUNCTION "private"."venue_name_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT regexp_replace(regexp_replace(lower(btrim(p_name)), '^the\s+', ''), '[^[:alnum:]]+', '', 'g');
$$;

-- Adds a bar someone visited as a public, unclaimed venue profile and returns
-- it. Refuses (SQLSTATE 23505, the existing profile's id in DETAIL when it's
-- public) when a bar of the same name is within 150 m, and (SQLSTATE 54000)
-- past the daily limit.
CREATE FUNCTION "public"."add_venue"(
    "p_name" "text",
    "p_address_line" "text",
    "p_city" "text",
    "p_country_code" "text",
    "p_latitude" double precision,
    "p_longitude" double precision,
    "p_postcode" "text" DEFAULT NULL,
    "p_region" "text" DEFAULT NULL,
    "p_locality" "text" DEFAULT NULL
) RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
    v_address text := nullif(regexp_replace(btrim(coalesce(p_address_line, '')), '\s+', ' ', 'g'), '');
    v_city text := nullif(btrim(coalesce(p_city, '')), '');
    v_country text := upper(btrim(coalesce(p_country_code, '')));
    v_postcode text := nullif(btrim(coalesce(p_postcode, '')), '');
    v_region text := nullif(btrim(coalesce(p_region, '')), '');
    v_locality text := nullif(btrim(coalesce(p_locality, '')), '');
    v_dupe public.profiles;
    v_base text;
    v_profile public.profiles;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in to add a bar.' USING ERRCODE = '42501';
    END IF;
    IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
        RAISE EXCEPTION 'Give the bar a name (up to 80 characters).' USING ERRCODE = '22023';
    END IF;
    IF v_address IS NULL OR char_length(v_address) > 200 OR v_city IS NULL OR char_length(v_city) > 80 THEN
        RAISE EXCEPTION 'Pick the bar''s street address, with its city.' USING ERRCODE = '22023';
    END IF;
    IF v_country !~ '^[A-Z]{2}$' THEN
        RAISE EXCEPTION 'Pick an address with a country.' USING ERRCODE = '22023';
    END IF;
    IF p_latitude IS NULL OR p_longitude IS NULL
       OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Pick the address from the list so the bar lands on the map.' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_postcode) > 20 OR char_length(v_region) > 80 OR char_length(v_locality) > 80 THEN
        RAISE EXCEPTION 'That address is too long.' USING ERRCODE = '22023';
    END IF;

    -- One add at a time per person, so two quick taps can't both pass the
    -- limit or both miss the duplicate.
    PERFORM pg_advisory_xact_lock(hashtextextended('add_venue:' || v_uid::text, 0));

    IF NOT private.is_app_admin()
       AND (SELECT count(*) FROM public.profiles
            WHERE created_by = v_uid AND kind = 'bar' AND created_at > now() - interval '1 day')
           >= private.venue_add_daily_limit() THEN
        RAISE EXCEPTION 'You''ve added % bars today. Try again tomorrow.', private.venue_add_daily_limit()
            USING ERRCODE = '54000';
    END IF;

    -- Same name within 150 m, public or not. A private bar's id isn't given out.
    SELECT p.* INTO v_dupe
    FROM public.profiles p
    WHERE p.kind = 'bar' AND p.latitude IS NOT NULL
      AND p.latitude BETWEEN p_latitude - 0.002 AND p_latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v_name)
      AND private.distance_km(p_latitude, p_longitude, p.latitude, p.longitude) <= 0.15
    ORDER BY private.distance_km(p_latitude, p_longitude, p.latitude, p.longitude)
    LIMIT 1;
    IF v_dupe.id IS NOT NULL THEN
        RAISE EXCEPTION '% is already on Cocktail.', v_dupe.display_name
            USING ERRCODE = '23505', DETAIL = CASE WHEN v_dupe.is_public THEN v_dupe.id::text ELSE '' END;
    END IF;

    -- A handle from the name plus a random tail: "deadrabbit.3f9a2".
    v_base := left(regexp_replace(lower(v_name), '[^a-z0-9]+', '', 'g'), 22);
    IF char_length(v_base) < 2 THEN
        v_base := 'bar' || v_base;
    END IF;
    FOR i IN 1..5 LOOP
        BEGIN
            INSERT INTO public.profiles (kind, handle, display_name, is_public, locality, address_line, postcode, city, region,
                                         country_code, latitude, longitude, created_by)
            VALUES ('bar', v_base || '.' || substr(md5(random()::text), 1, 5), v_name, true, v_locality, v_address, v_postcode,
                    v_city, v_region, v_country, p_latitude, p_longitude, v_uid)
            RETURNING * INTO v_profile;
            RETURN v_profile;
        EXCEPTION WHEN unique_violation THEN
            IF i = 5 THEN
                RAISE;
            END IF;
        END;
    END LOOP;
    RETURN v_profile;
END;
$$;

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."distance_km"(double precision, double precision, double precision, double precision) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."bars_in_area"(double precision, double precision, double precision, "text", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."venue_add_daily_limit"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."venue_name_key"("text") FROM PUBLIC, "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."discover_drink_rankings"("uuid", double precision, double precision, double precision, "text", "text", integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."discover_top_bars"(double precision, double precision, double precision, "text", "text", integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."get_venue_score"("uuid") FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."add_venue"("text", "text", "text", "text", double precision, double precision, "text", "text", "text") FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."discover_drink_rankings"("uuid", double precision, double precision, double precision, "text", "text", integer) TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."discover_top_bars"(double precision, double precision, double precision, "text", "text", integer) TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_venue_score"("uuid") TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."add_venue"("text", "text", "text", "text", double precision, double precision, "text", "text", "text") TO "authenticated", "service_role";
