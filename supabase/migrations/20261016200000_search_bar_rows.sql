-- A bar's public brand, and search's bar rows as the search boards draw them
-- (nav-search-home): the bar's logo and how many of its matching drinks are
-- on now ("Fitzroy · 14 drinks on now").
--
-- Kevin, 12 Oct: a venue's logo and colours show to everyone, because they
-- are its public branding (get_venue_branding already gives them to
-- signed-out visitors by slug). bars stays members only under bars_select;
-- bar_brands reads just the public fields, for a public bar page's venue:
-- the logo, the accent (primary_color, and its readable shade on the light
-- ground, accent_light_color), the display face and the short name. Nothing
-- else about a venue (its other colours, icon, prices, settings) is exposed.
--
-- discover_bars gains `on_now`, counted only when asked (p_on_now: search
-- asks, the map's tiles don't, so they cost what they did), and a bar whose
-- page has no picture falls back to its venue's Brand logo, for everyone.
-- It also says the venue's accent and face (`brand_accent`, `brand_face`),
-- so a bar with no logo draws its monogram in its own colours. The
-- arguments and the return type change, so the function is dropped and made
-- again with its grants.

-- The public brand of each public bar page in p_profile_ids whose venue is
-- on the app; pages with no venue (or not public, or moderated) are left
-- out. Read only. SECURITY DEFINER because bars_select is members only.
CREATE FUNCTION "public"."bar_brands"("p_profile_ids" "uuid"[])
RETURNS TABLE(
    "profile_id" "uuid",
    "logo_url" "text",
    "primary_color" "text",
    "accent_light_color" "text",
    "display_face" "public"."venue_display_face",
    "short_name" "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.id, b.logo_url, b.primary_color, b.accent_light_color, b.display_face, b.short_name
  FROM public.profiles p
  JOIN public.bars b ON b.id = p.bar_id
  WHERE p.id = ANY (p_profile_ids)
    AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL;
$$;

REVOKE ALL ON FUNCTION "public"."bar_brands"("uuid"[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."bar_brands"("uuid"[]) TO "anon", "authenticated", "service_role";

DROP FUNCTION "public"."discover_bars"(double precision, double precision, double precision, "text", "text", double precision, double precision, double precision, double precision, "text"[], "text"[], "text"[], "text");

-- The bars in an area, as discover_drinks (a point within p_radius_km, a
-- city and/or country, or anywhere), or in a box (p_west..p_north, as a map
-- tile; west > east crosses the antimeridian). Closed bars too, flagged, with
-- no drinks. `drinks`: how many of the bar's drinks match the filters:
-- p_styles, p_spirits and p_notes each any-of (lib/discoverDrinks.ts
-- matchesKinds), and every word of p_query in the drink's haystack or the
-- bar's name. `on_now`, with p_on_now: of those, how many are on one of
-- the bar's menus now (else NULL). `avatar_url`: the page's own picture,
-- else its venue's Brand logo; `brand_accent` and `brand_face`: the venue's
-- (bar_brands), else NULL.
CREATE FUNCTION "public"."discover_bars"(
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_west" double precision DEFAULT NULL,
    "p_south" double precision DEFAULT NULL,
    "p_east" double precision DEFAULT NULL,
    "p_north" double precision DEFAULT NULL,
    "p_styles" "text"[] DEFAULT NULL,
    "p_spirits" "text"[] DEFAULT NULL,
    "p_notes" "text"[] DEFAULT NULL,
    "p_query" "text" DEFAULT NULL,
    "p_on_now" boolean DEFAULT false
) RETURNS TABLE(
    "id" "uuid",
    "handle" "text",
    "display_name" "text",
    "avatar_url" "text",
    "locality" "text",
    "city" "text",
    "country_code" "text",
    "latitude" double precision,
    "longitude" double precision,
    "is_closed" boolean,
    "closed_year" integer,
    "drinks" integer,
    "on_now" integer,
    "brand_accent" "text",
    "brand_face" "text"
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
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
$$;

REVOKE ALL ON FUNCTION "public"."discover_bars"(double precision, double precision, double precision, "text", "text", double precision, double precision, double precision, double precision, "text"[], "text"[], "text"[], "text", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."discover_bars"(double precision, double precision, double precision, "text", "text", double precision, double precision, double precision, double precision, "text"[], "text"[], "text"[], "text", boolean) TO "authenticated", "service_role";
