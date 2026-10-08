-- My Bar and an ingredient's "Used in", worked out in SQL.
--
--   my_bar_drinks        what the caller's shelf makes, and what one more
--                        bottle would unlock. The app used to download every
--                        cocktail and ingredient the person could see, with
--                        their recipe lines (about 11,000 rows and 3 MB in a
--                        dozen pages), to work this out on the phone.
--   ingredient_used_in   the cocktails that use an ingredient. The app
--                        filtered the recipe view on its computed
--                        display_ingredient_id, which no index can serve,
--                        with no limit.
--
-- Both run as the caller (SECURITY INVOKER), reading items through
-- app_item_presentation and recipe lines through the role-masked
-- app_recipe_presentation, as the app did, so neither ever uses or returns
-- a line or a drink the caller couldn't already read. Signed-in only.

-- --- My Bar ---

-- The rules the app applied on the phone until now (lib/canMake.ts), unchanged:
--   * A line is covered by something on hand that is the line's ingredient,
--     or that shares the line's generic (a shelf with Tanqueray covers "Gin",
--     and a shelf with "Gin" covers a line that calls for Tanqueray). Which
--     bottle belongs to which generic is learned from the lines themselves.
--   * A house-made ingredient (one with its own recipe) is on hand once every
--     non-optional line of its recipe is covered, worked out up to five deep.
--   * Optional lines never block a drink; a drink with no lines never matches.
--   * One away: every missing line comes down to the same thing to buy. For
--     a missing house-made ingredient that's what its own recipe is missing
--     ("olive oil", not "olive oil-washed gin").
--
-- Rows: drinks the shelf makes (missing_id NULL) and drinks one bottle away
-- (missing_id is the bottle, missing_name its name), A to Z by name then id,
-- after (p_after_name, p_after_id) when given, up to p_limit (at most 1000).
-- The lines are read once into arrays; the five rounds of house-made
-- ingredients then run over those, not the views.
CREATE FUNCTION "public"."my_bar_drinks"(
    "p_after_name" "text" DEFAULT NULL,
    "p_after_id" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 1000
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "image_url" "text",
    "glassware_id" "uuid",
    "missing_id" "uuid",
    "missing_name" "text"
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_owner uuid[];
    v_ing uuid[];
    v_gen uuid[];
    v_opt boolean[];
    v_drink boolean[];
    v_from uuid[];
    v_to uuid[];
    v_on_hand uuid[];
    v_have uuid[];
    v_added uuid[];
    v_depth integer := 0;
    v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN;
    END IF;

    -- Every recipe line the caller can read, on a cocktail or an ingredient.
    SELECT coalesce(array_agg(r.recipe_item_id), '{}'), coalesce(array_agg(r.display_ingredient_id), '{}'),
           coalesce(array_agg(r.parent_ingredient_id), '{}'), coalesce(array_agg(coalesce(r.is_optional, false)), '{}'),
           coalesce(array_agg(i.item_type = 'cocktail'), '{}')
    INTO v_owner, v_ing, v_gen, v_opt, v_drink
    FROM public.app_recipe_presentation r
    JOIN public.app_item_presentation i ON i.id = r.recipe_item_id
    WHERE r.display_ingredient_id IS NOT NULL AND i.item_type IN ('cocktail', 'ingredient');

    -- Bottle to generic, from the lines.
    SELECT coalesce(array_agg(g.ing), '{}'), coalesce(array_agg(g.gen), '{}') INTO v_from, v_to
    FROM (
        SELECT DISTINCT ON (l.ing) l.ing, l.gen
        FROM unnest(v_ing, v_gen) AS l(ing, gen)
        WHERE l.gen IS NOT NULL AND l.gen <> l.ing
        ORDER BY l.ing, l.gen
    ) g;

    -- The shelf, as far as the caller can still see it.
    SELECT coalesce(array_agg(h.item_id), '{}') INTO v_on_hand
    FROM public.home_bar_items h
    JOIN public.app_item_presentation i ON i.id = h.item_id
    WHERE h.user_id = (SELECT auth.uid());

    -- House-made ingredients whose recipe is covered count as on hand, five rounds at most.
    LOOP
        v_have := v_on_hand || ARRAY(SELECT g.gen FROM unnest(v_from, v_to) AS g(ing, gen) WHERE g.ing = ANY(v_on_hand));
        EXIT WHEN v_depth >= 5;
        SELECT coalesce(array_agg(s.owner), '{}') INTO v_added
        FROM (
            SELECT l.owner
            FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
            LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
            WHERE NOT l.drink AND NOT l.owner = ANY(v_on_hand)
            GROUP BY l.owner
            HAVING bool_and(l.opt OR l.ing = ANY(v_have) OR coalesce(coalesce(l.gen, g.gen) = ANY(v_have), false))
        ) s;
        EXIT WHEN cardinality(v_added) = 0;
        v_on_hand := v_on_hand || v_added;
        v_depth := v_depth + 1;
    END LOOP;

    RETURN QUERY
    WITH RECURSIVE lines AS MATERIALIZED (
        SELECT l.owner, l.ing, coalesce(l.gen, g.gen) AS gen, l.opt, l.drink
        FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
        LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
    ), missing AS MATERIALIZED (
        -- What to buy for a line: its generic when it has one, else the bottle itself.
        SELECT l.owner, l.ing, coalesce(l.gen, l.ing) AS buy, l.drink
        FROM lines l
        WHERE NOT l.opt AND NOT (l.ing = ANY(v_have) OR coalesce(l.gen = ANY(v_have), false))
    ), walk AS (
        SELECT m.owner AS drink, m.ing, m.buy, 0 AS depth FROM missing m WHERE m.drink
        UNION ALL
        SELECT w.drink, m.ing, m.buy, w.depth + 1
        FROM walk w
        JOIN missing m ON m.owner = w.ing AND NOT m.drink
        WHERE w.depth < 5
    ), one_away AS (
        SELECT w.drink, min(w.buy::text)::uuid AS buy
        FROM walk w
        -- A missing house-made ingredient stands for what its own recipe is missing.
        WHERE NOT (w.depth < 5 AND EXISTS (SELECT 1 FROM missing m WHERE m.owner = w.ing AND NOT m.drink))
        GROUP BY w.drink
        HAVING count(DISTINCT w.buy) = 1
    ), matches AS (
        SELECT d.owner AS drink, NULL::uuid AS buy
        FROM (SELECT DISTINCT l.owner FROM lines l WHERE l.drink) d
        WHERE NOT EXISTS (SELECT 1 FROM missing m WHERE m.owner = d.owner)
        UNION ALL
        SELECT o.drink, o.buy FROM one_away o
    ), page AS (
        SELECT i.id, i.name, i.glassware_id, m.buy, b.name AS buy_name
        FROM matches m
        JOIN public.app_item_presentation i ON i.id = m.drink
        LEFT JOIN public.app_item_presentation b ON b.id = m.buy
        WHERE (m.buy IS NULL OR b.id IS NOT NULL)
          AND (p_after_name IS NULL OR (i.name, i.id) > (p_after_name, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        ORDER BY i.name, i.id
        LIMIT v_limit
    ), heroes AS MATERIALIZED (
        -- Photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT p.id FROM page p) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    )
    SELECT p.id, p.name, h.url, p.glassware_id, p.buy, p.buy_name
    FROM page p
    LEFT JOIN heroes h ON h.item_id = p.id
    ORDER BY p.name, p.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer) TO "authenticated", "service_role";

-- --- Used in ---

-- The drinks whose lines name an ingredient, as the bottle, its generic, or
-- a bottle of that generic: the candidates for ingredient_used_in, found
-- through the recipe columns (and their indexes) rather than the view's
-- computed one. Runs as the definer to see every line; it only narrows the
-- search, and ingredient_used_in keeps what the caller can read.
CREATE FUNCTION "private"."drinks_using_ingredient"("p_ingredient_id" "uuid")
    RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT r.recipe_item_id FROM public.recipes r WHERE r.ingredient_item_id = p_ingredient_id
  UNION
  SELECT r.recipe_item_id FROM public.recipes r WHERE r.parent_ingredient_id = p_ingredient_id
  UNION
  SELECT r.recipe_item_id FROM public.recipes r JOIN public.items s ON s.id = r.ingredient_item_id WHERE s.generic_id = p_ingredient_id;
$$;

REVOKE ALL ON FUNCTION "private"."drinks_using_ingredient"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."drinks_using_ingredient"("uuid") TO "authenticated", "service_role";

-- The cocktails that use an ingredient, as the caller's recipe view shows
-- it (a line masked down to its generic counts for the generic, not the
-- bottle), A to Z, up to p_limit (at most 500). Preps it goes into are
-- listed on the prep card, not here.
CREATE FUNCTION "public"."ingredient_used_in"("p_ingredient_id" "uuid", "p_limit" integer DEFAULT 200)
    RETURNS TABLE("id" "uuid", "name" "text", "image_url" "text", "image_is_generated" boolean)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
  WITH used AS MATERIALIZED (
    SELECT i.id, i.name
    FROM public.app_item_presentation i
    WHERE i.item_type = 'cocktail'
      AND i.id IN (SELECT private.drinks_using_ingredient(p_ingredient_id))
      AND EXISTS (
        SELECT 1 FROM public.app_recipe_presentation r
        WHERE r.recipe_item_id = i.id AND r.display_ingredient_id = p_ingredient_id
      )
    ORDER BY i.name, i.id
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
  )
  SELECT u.id, u.name, h.url, h.is_generated
  FROM used u
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii
    JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = u.id AND ii.angle = 'hero'
    ORDER BY ii.is_generated, coalesce(ii.sort_order, 0)
    LIMIT 1
  ) h ON true
  ORDER BY u.name, u.id;
$$;

REVOKE ALL ON FUNCTION "public"."ingredient_used_in"("uuid", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."ingredient_used_in"("uuid", integer) TO "authenticated", "service_role";
