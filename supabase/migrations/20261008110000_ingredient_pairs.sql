-- What pairs with what, counted from real drinks.
--
-- For every two core ingredients (20261008100000), how many drinks use both,
-- and a score for how much more often than chance: ln(together * all /
-- (drinks with a * drinks with b)), weighted by ln(1 + together), so a
-- pairing backed by 40 drinks beats a fluke in 2. Plain popularity would put
-- lime and sugar next to everything.
--
-- A spec line counts at its core ingredient: Tanqueray is London Dry Gin,
-- "Purple Basil Simple Syrup" is Simple Syrup. Lines with no core ingredient
-- above them (families like "Syrup", one-off preps) don't count.
--
-- Only drinks whose spec anyone can already read are counted: the shared
-- catalog and seeded bar drinks (no venue, no author), and drinks published
-- with their spec. A venue's private specs never shape the numbers. A pair
-- needs at least 2 such drinks.
--
--   ingredient_pairs         both directions, per era: 'now' (drinks here)
--                            and 'books' (the old cocktail books, filled
--                            once their recipes are in, 20261008130000).
--   ingredient_pair_totals   drinks per core ingredient, per era.
--   get_pairings(ids, era)   what pairs with all of the given ingredients,
--                            each mapped to its core one first.
--   get_pair_drinks(a, b)    drinks that use both, for "the drinks behind it".
-- Refreshed nightly, and once now.

CREATE TABLE "public"."ingredient_pairs" (
    "era" "text" NOT NULL CHECK ("era" IN ('now', 'books')),
    "a_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "b_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "together" integer NOT NULL,
    "lift" real NOT NULL,
    "score" real NOT NULL,
    PRIMARY KEY ("era", "a_id", "b_id")
);

CREATE TABLE "public"."ingredient_pair_totals" (
    "era" "text" NOT NULL CHECK ("era" IN ('now', 'books')),
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "drinks" integer NOT NULL,
    PRIMARY KEY ("era", "item_id")
);

COMMENT ON TABLE "public"."ingredient_pairs" IS
    'Core ingredient pairs from drinks anyone can read, both directions. lift = ln(observed / expected); score = lift * ln(1 + together). Refreshed by private.refresh_ingredient_pairs().';

ALTER TABLE "public"."ingredient_pairs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ingredient_pair_totals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads ingredient pairs" ON "public"."ingredient_pairs" FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "Anyone reads ingredient pair totals" ON "public"."ingredient_pair_totals" FOR SELECT TO "anon", "authenticated" USING (true);
GRANT SELECT ON TABLE "public"."ingredient_pairs", "public"."ingredient_pair_totals" TO "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- Which drinks count, and at which ingredient
-- ---------------------------------------------------------------------------

-- The core ingredient an ingredient counts as: itself, or the nearest core one
-- up its "kind of" chain.
CREATE FUNCTION "private"."core_ingredient_map"() RETURNS TABLE ("id" "uuid", "core_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH RECURSIVE up (id, cur, depth) AS (
        SELECT i.id, i.id, 0 FROM public.items i WHERE i.item_type = 'ingredient'
        UNION ALL
        SELECT u.id, i.generic_id, u.depth + 1
          FROM up u JOIN public.items i ON i.id = u.cur
         WHERE NOT i.is_core AND i.generic_id IS NOT NULL AND u.depth < 6
    )
    SELECT DISTINCT ON (u.id) u.id, u.cur
      FROM up u JOIN public.items c ON c.id = u.cur AND c.is_core
     ORDER BY u.id, u.depth;
$$;
REVOKE EXECUTE ON FUNCTION "private"."core_ingredient_map"() FROM PUBLIC, "anon", "authenticated";

-- Drinks anyone can read the spec of.
CREATE FUNCTION "private"."is_open_spec"("p_item" "public"."items") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    SELECT p_item.item_type = 'cocktail'
       AND ((p_item.bar_id IS NULL AND p_item.created_by IS NULL) OR p_item.publish_mode = 'spec');
$$;
REVOKE EXECUTE ON FUNCTION "private"."is_open_spec"("public"."items") FROM PUBLIC, "anon", "authenticated";

-- Each counted drink with the core ingredients in it, once each.
CREATE FUNCTION "private"."open_drink_cores"() RETURNS TABLE ("drink_id" "uuid", "core_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    WITH m AS (SELECT * FROM private.core_ingredient_map())
    SELECT DISTINCT r.recipe_item_id, COALESCE(mi.core_id, mp.core_id)
      FROM public.recipes r
      JOIN public.items d ON d.id = r.recipe_item_id AND private.is_open_spec(d)
      LEFT JOIN m mi ON mi.id = r.ingredient_item_id
      LEFT JOIN m mp ON mp.id = r.parent_ingredient_id
     WHERE COALESCE(mi.core_id, mp.core_id) IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION "private"."open_drink_cores"() FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- The refresh
-- ---------------------------------------------------------------------------

-- Rebuilds one era from (drink, core ingredient) rows.
CREATE FUNCTION "private"."write_ingredient_pairs"("p_era" "text") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_all numeric;
BEGIN
    SELECT count(DISTINCT drink_id) INTO v_all FROM pg_temp.pair_lines;
    DELETE FROM public.ingredient_pairs WHERE era = p_era;
    DELETE FROM public.ingredient_pair_totals WHERE era = p_era;
    IF v_all = 0 THEN RETURN; END IF;

    INSERT INTO public.ingredient_pair_totals (era, item_id, drinks)
    SELECT p_era, core_id, count(*) FROM pg_temp.pair_lines GROUP BY core_id;

    INSERT INTO public.ingredient_pairs (era, a_id, b_id, together, lift, score)
    SELECT p_era, x.a, x.b, x.n,
           ln(x.n * v_all / (ta.drinks::numeric * tb.drinks)),
           ln(x.n * v_all / (ta.drinks::numeric * tb.drinks)) * ln(1 + x.n)
      FROM (
        SELECT a.core_id AS a, b.core_id AS b, count(*) AS n
          FROM pg_temp.pair_lines a JOIN pg_temp.pair_lines b ON b.drink_id = a.drink_id AND b.core_id <> a.core_id
         GROUP BY 1, 2 HAVING count(*) >= 2
      ) x
      JOIN public.ingredient_pair_totals ta ON ta.era = p_era AND ta.item_id = x.a
      JOIN public.ingredient_pair_totals tb ON tb.era = p_era AND tb.item_id = x.b;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."write_ingredient_pairs"("text") FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."refresh_ingredient_pairs"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    DROP TABLE IF EXISTS pg_temp.pair_lines;
    CREATE TEMP TABLE pair_lines AS SELECT * FROM private.open_drink_cores();
    PERFORM private.write_ingredient_pairs('now');
    DROP TABLE pg_temp.pair_lines;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."refresh_ingredient_pairs"() FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- What pairs with every one of p_ids (each read as its core ingredient), best
-- first: the sum of its scores with each, positive lift with all of them.
-- together[i] is the drinks it shares with the i-th input.
CREATE FUNCTION "public"."get_pairings"("p_ids" "uuid"[], "p_era" "text" DEFAULT 'now', "p_limit" integer DEFAULT 24)
    RETURNS TABLE ("item_id" "uuid", "name" "text", "drinks" integer, "together" integer[], "score" real)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH picked AS (
        SELECT DISTINCT ON (core) core, ord FROM (
            SELECT COALESCE(m.core_id, x.id) AS core, x.ord
              FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
              LEFT JOIN private.core_ingredient_map() m ON m.id = x.id
        ) y ORDER BY core, ord
    ), hits AS (
        SELECT p.b_id, k.ord, p.together, p.score, p.lift
          FROM picked k JOIN public.ingredient_pairs p ON p.era = p_era AND p.a_id = k.core
         WHERE p.b_id NOT IN (SELECT core FROM picked)
    )
    SELECT h.b_id, i.name, t.drinks,
           array_agg(h.together ORDER BY h.ord), sum(h.score)::real
      FROM hits h
      JOIN public.items i ON i.id = h.b_id
      LEFT JOIN public.ingredient_pair_totals t ON t.era = p_era AND t.item_id = h.b_id
     GROUP BY h.b_id, i.name, t.drinks
    HAVING count(*) = (SELECT count(*) FROM picked) AND min(h.lift) > 0
     ORDER BY sum(h.score) DESC, i.name
     LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION "public"."get_pairings"("uuid"[], "text", integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_pairings"("uuid"[], "text", integer) TO "anon", "authenticated";

-- The counted drinks that use both (at their core ingredients).
CREATE FUNCTION "public"."get_pair_drinks"("p_a" "uuid", "p_b" "uuid", "p_limit" integer DEFAULT 20)
    RETURNS TABLE ("id" "uuid", "name" "text", "is_catalog" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH m AS (SELECT * FROM private.core_ingredient_map()),
    ab AS (
        SELECT COALESCE((SELECT core_id FROM m WHERE m.id = p_a), p_a) AS a,
               COALESCE((SELECT core_id FROM m WHERE m.id = p_b), p_b) AS b
    ), dc AS (SELECT * FROM private.open_drink_cores())
    SELECT d.id, d.name, d.is_catalog
      FROM ab
      JOIN dc x ON x.core_id = ab.a
      JOIN dc y ON y.drink_id = x.drink_id AND y.core_id = ab.b
      JOIN public.items d ON d.id = x.drink_id
     ORDER BY d.is_catalog DESC, d.name
     LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION "public"."get_pair_drinks"("uuid", "uuid", integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_pair_drinks"("uuid", "uuid", integer) TO "anon", "authenticated";

SELECT private.refresh_ingredient_pairs();
SELECT cron.schedule('ingredient-pairs', '41 4 * * *', 'SELECT private.refresh_ingredient_pairs()');
