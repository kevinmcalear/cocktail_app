-- Flavor profiles get twelve dimensions instead of nine (rules v2).
--
-- "herbal" used to cover gin's juniper and mint alike, so a Martini read
-- more herbal than a Mojito; "spicy" covered aromatic bitters and chili
-- alike, so an Old Fashioned read intensely spicy. Now:
--   botanical: juniper, roots, barks and peels (gin, vermouth, aquavit);
--   herbal:    green herbs and anise (mint, basil, Chartreuse, absinthe);
--   spiced:    warm baking spice (aromatic bitters, rye, cinnamon);
--   spicy:     heat (ginger, chili, pepper);
--   savory:    salt, brine, tomato.
-- The rules are in supabase/functions/_shared/flavor.ts and checked against
-- 70 classics in scripts/flavor.check.ts.
--
-- The new columns default to 0, and save_item_flavor reads a missing
-- dimension as 0, so the worker that's deployed now keeps working until the
-- v2 worker replaces it. Stored profiles are recomputed after that, by hand:
-- SELECT private.enqueue_item_flavors();

ALTER TABLE "public"."item_flavors"
    ADD COLUMN "botanical" real NOT NULL DEFAULT 0 CHECK ("botanical" BETWEEN 0 AND 1),
    ADD COLUMN "spiced" real NOT NULL DEFAULT 0 CHECK ("spiced" BETWEEN 0 AND 1),
    ADD COLUMN "savory" real NOT NULL DEFAULT 0 CHECK ("savory" BETWEEN 0 AND 1);

-- The cold-start answers may name any dimension.
CREATE OR REPLACE FUNCTION "private"."valid_taste_answers"("p" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_typeof(p) = 'object'
    AND NOT jsonb_path_exists(p, '$.* ? (@.type() != "number" || @ < 0 || @ > 1)')
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p) k
      WHERE k NOT IN ('sweet', 'sour', 'bitter', 'strong', 'botanical', 'herbal', 'fruity', 'spiced', 'spicy', 'smoky', 'savory', 'creamy')
    );
$$;

-- As 20260928300000, with the new dimensions; a dimension the worker didn't
-- send is 0.
CREATE OR REPLACE FUNCTION "public"."save_item_flavor"(
    "p_item_id" "uuid",
    "p_profile" "jsonb",
    "p_coverage" real,
    "p_source" "text",
    "p_spec_fingerprint" "text",
    "p_rules_version" integer,
    "p_ingredients" "jsonb" DEFAULT NULL,
    "p_job_revision" bigint DEFAULT NULL
) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO private.ingredient_flavors (item_id, name, flavor)
    SELECT (x ->> 'id')::uuid, x ->> 'name', x -> 'flavor'
    FROM jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) x
    WHERE EXISTS (SELECT 1 FROM public.items i WHERE i.id = (x ->> 'id')::uuid)
    ON CONFLICT (item_id) DO UPDATE SET name = excluded.name, flavor = excluded.flavor, created_at = now();

    IF EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND item_type = 'cocktail') THEN
        INSERT INTO public.item_flavors AS f (item_id, sweet, sour, bitter, strong, botanical, herbal, fruity, spiced, spicy, smoky, savory, creamy,
                                             coverage, source, spec_fingerprint, rules_version, updated_at)
        VALUES (p_item_id,
                coalesce((p_profile ->> 'sweet')::real, 0), coalesce((p_profile ->> 'sour')::real, 0), coalesce((p_profile ->> 'bitter')::real, 0),
                coalesce((p_profile ->> 'strong')::real, 0), coalesce((p_profile ->> 'botanical')::real, 0), coalesce((p_profile ->> 'herbal')::real, 0),
                coalesce((p_profile ->> 'fruity')::real, 0), coalesce((p_profile ->> 'spiced')::real, 0), coalesce((p_profile ->> 'spicy')::real, 0),
                coalesce((p_profile ->> 'smoky')::real, 0), coalesce((p_profile ->> 'savory')::real, 0), coalesce((p_profile ->> 'creamy')::real, 0),
                p_coverage, p_source, p_spec_fingerprint, p_rules_version, now())
        ON CONFLICT (item_id) DO UPDATE SET
            sweet = excluded.sweet, sour = excluded.sour, bitter = excluded.bitter, strong = excluded.strong,
            botanical = excluded.botanical, herbal = excluded.herbal, fruity = excluded.fruity, spiced = excluded.spiced,
            spicy = excluded.spicy, smoky = excluded.smoky, savory = excluded.savory, creamy = excluded.creamy,
            coverage = excluded.coverage, source = excluded.source,
            spec_fingerprint = excluded.spec_fingerprint, rules_version = excluded.rules_version, updated_at = now();
    END IF;

    IF p_job_revision IS NOT NULL THEN
        DELETE FROM private.item_flavor_jobs WHERE item_id = p_item_id AND revision = p_job_revision;
        UPDATE private.item_flavor_jobs
        SET status = 'pending', attempts = 0, lease_until = NULL, run_after = greatest(run_after, now()), updated_at = now()
        WHERE item_id = p_item_id AND status = 'running';
    END IF;
END;
$$;

-- The functions that return every dimension change shape, so they're
-- dropped and made again. Bodies as before, with the new dimensions.

DROP FUNCTION "public"."get_my_taste"();
-- As 20260928300000: your taste, weighted by (score / 10)^2.
CREATE FUNCTION "public"."get_my_taste"()
    RETURNS TABLE("sweet" real, "sour" real, "bitter" real, "strong" real, "botanical" real, "herbal" real, "fruity" real, "spiced" real, "spicy" real, "smoky" real, "savory" real, "creamy" real, "drinks" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH mine AS (
    SELECT s.item_id, max(s.score) AS score
    FROM public.rank_entry_scores s
    WHERE s.user_id = (SELECT auth.uid())
    GROUP BY s.item_id
  ), weighted AS (
    SELECT f.*, power(m.score / 10.0, 2) AS weight
    FROM mine m JOIN public.item_flavors f ON f.item_id = m.item_id
    WHERE f."coverage" >= 0.5
  )
  SELECT (sum(weight * sweet) / nullif(sum(weight), 0))::real, (sum(weight * sour) / nullif(sum(weight), 0))::real,
         (sum(weight * bitter) / nullif(sum(weight), 0))::real, (sum(weight * strong) / nullif(sum(weight), 0))::real,
         (sum(weight * botanical) / nullif(sum(weight), 0))::real, (sum(weight * herbal) / nullif(sum(weight), 0))::real,
         (sum(weight * fruity) / nullif(sum(weight), 0))::real, (sum(weight * spiced) / nullif(sum(weight), 0))::real,
         (sum(weight * spicy) / nullif(sum(weight), 0))::real, (sum(weight * smoky) / nullif(sum(weight), 0))::real,
         (sum(weight * savory) / nullif(sum(weight), 0))::real, (sum(weight * creamy) / nullif(sum(weight), 0))::real,
         count(*)::integer
  FROM weighted;
$$;
REVOKE EXECUTE ON FUNCTION "public"."get_my_taste"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_taste"() TO "authenticated";

DROP FUNCTION "public"."flavor_baseline"();
-- As 20261008330000: the average usable profile the caller can see.
CREATE FUNCTION "public"."flavor_baseline"()
    RETURNS TABLE("sweet" real, "sour" real, "bitter" real, "strong" real, "botanical" real, "herbal" real, "fruity" real, "spiced" real, "spicy" real, "smoky" real, "savory" real, "creamy" real, "drinks" integer)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  SELECT avg(f.sweet)::real, avg(f.sour)::real, avg(f.bitter)::real, avg(f.strong)::real, avg(f.botanical)::real, avg(f.herbal)::real,
         avg(f.fruity)::real, avg(f.spiced)::real, avg(f.spicy)::real, avg(f.smoky)::real, avg(f.savory)::real, avg(f.creamy)::real,
         count(*)::integer
  FROM public.item_flavors f
  WHERE f.coverage >= 0.5;
$$;
REVOKE ALL ON FUNCTION "public"."flavor_baseline"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."flavor_baseline"() TO "authenticated", "service_role";

DROP FUNCTION "public"."flavor_for_you"("jsonb", integer);
-- As 20261008330000: the usable profiles nearest a taste, leaving out what
-- the caller ranked.
CREATE FUNCTION "public"."flavor_for_you"("p_taste" "jsonb", "p_limit" integer DEFAULT 10)
    RETURNS TABLE("id" "uuid", "name" "text", "image_url" "text", "is_classic" boolean, "riff_of_id" "uuid",
                  "sweet" real, "sour" real, "bitter" real, "strong" real, "botanical" real, "herbal" real, "fruity" real, "spiced" real, "spicy" real, "smoky" real, "savory" real, "creamy" real)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  WITH taste AS (
    SELECT t.key AS dim, (t.value #>> '{}')::real AS v
    FROM jsonb_each(CASE WHEN jsonb_typeof(p_taste) = 'object' THEN p_taste ELSE '{}'::jsonb END) t
    WHERE t.key IN ('sweet', 'sour', 'bitter', 'strong', 'botanical', 'herbal', 'fruity', 'spiced', 'spicy', 'smoky', 'savory', 'creamy')
      AND jsonb_typeof(t.value) = 'number'
  ), ranked AS (
    SELECT e.item_id AS id FROM public.rank_entries e WHERE e.user_id = (SELECT auth.uid())
    UNION
    SELECT e.ranked_as_item_id FROM public.rank_entries e WHERE e.user_id = (SELECT auth.uid())
  ), scored AS (
    SELECT f.*, (
      SELECT sqrt(avg(power(t.v - CASE t.dim
          WHEN 'sweet' THEN f.sweet WHEN 'sour' THEN f.sour WHEN 'bitter' THEN f.bitter
          WHEN 'strong' THEN f.strong WHEN 'botanical' THEN f.botanical WHEN 'herbal' THEN f.herbal
          WHEN 'fruity' THEN f.fruity WHEN 'spiced' THEN f.spiced WHEN 'spicy' THEN f.spicy
          WHEN 'smoky' THEN f.smoky WHEN 'savory' THEN f.savory
          ELSE f.creamy END, 2)))
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
         n.sweet, n.sour, n.bitter, n.strong, n.botanical, n.herbal, n.fruity, n.spiced, n.spicy, n.smoky, n.savory, n.creamy
  FROM nearest n
  ORDER BY n.gap, n.name, n.item_id;
$$;
REVOKE ALL ON FUNCTION "public"."flavor_for_you"("jsonb", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."flavor_for_you"("jsonb", integer) TO "authenticated", "service_role";

-- As 20261008330000, with notes for the new dimensions.
CREATE OR REPLACE FUNCTION "public"."discover_drinks"(
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
$$;
