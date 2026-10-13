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
-- Read only, not callable by app roles: it reads every person's loves (a
-- count only, capped) so it runs inside the SECURITY DEFINER readers below.
CREATE FUNCTION "private"."bar_relevance"("p_ids" "uuid"[])
RETURNS TABLE("id" "uuid", "loved" boolean, "stale" boolean, "relevance" integer)
    LANGUAGE "sql" STABLE
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
  WHERE p.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION "private"."bar_stale_after"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "private"."bar_relevance"("uuid"[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."bar_stale_after"() TO "service_role";
GRANT EXECUTE ON FUNCTION "private"."bar_relevance"("uuid"[]) TO "service_role";

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
