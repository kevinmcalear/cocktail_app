-- My Bar's "Make first": the house preps your shelf can make that aren't on
-- it yet, and the drinks that lean on each.
--
-- my_bar_drinks already counts a prep as on hand once its recipe is covered
-- (lime cordial from limes, sugar and acids), so those drinks show as ready.
-- This says which preps that took, so the app can say "make the lime
-- cordial first, it opens up these". The app keeps only the drinks it
-- already has as ready.
--
-- The on-hand rules below are my_bar_drinks's (20261010300000), copied word
-- for word: change them together. supabase/tests/my-bar.test.mjs checks the
-- two agree. A separate function so my_bar_drinks keeps its speed.

CREATE OR REPLACE FUNCTION "public"."my_bar_preps"()
RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "drinks" "uuid"[]
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
    v_shelf uuid[];
    v_plain uuid[];
    v_on_hand uuid[];
    v_have uuid[];
    v_kinds uuid[];
    v_added uuid[];
    v_made uuid[];
    v_depth integer := 0;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN;
    END IF;

    -- Every recipe line the caller can read, on a cocktail or an ingredient.
    -- A drink's garnish never blocks it, like an optional line: notes that
    -- say so, a peel/twist/wheel/rim unit, or a garnish by name (a twist,
    -- peel, zest or wheel, an expressed citrus oil, a cocktail cherry, an
    -- olive, a cocktail onion). Not wedges or slices (often muddled), not
    -- "Cherry" or olive oil. A prep's lines are never garnishes.
    SELECT coalesce(array_agg(r.recipe_item_id), '{}'), coalesce(array_agg(r.display_ingredient_id), '{}'),
           coalesce(array_agg(r.parent_ingredient_id), '{}'),
           coalesce(array_agg(coalesce(r.is_optional, false) OR (i.item_type = 'cocktail' AND (
               coalesce(r.preparation_notes ~* '\mgarnish', false)
               OR coalesce(lower(r.unit) IN ('peel', 'twist', 'wheel', 'rim'), false)
               OR coalesce(d.name ~* '(\m(twist|peel|zest|wheel)s?|^(lemon|lime|orange|grapefruit) oil|\m(maraschino|luxardo|brandied|amarena|cocktail) cherr(y|ies)|\molives?|^(cocktail|pickled|pearl) onions?)$', false)
           ))), '{}'),
           coalesce(array_agg(i.item_type = 'cocktail'), '{}')
    INTO v_owner, v_ing, v_gen, v_opt, v_drink
    FROM public.app_recipe_presentation r
    JOIN public.app_item_presentation i ON i.id = r.recipe_item_id
    LEFT JOIN public.app_item_presentation d ON d.id = r.display_ingredient_id
    WHERE r.display_ingredient_id IS NOT NULL AND i.item_type IN ('cocktail', 'ingredient');

    -- Ingredient to its style: the tree when it says, else what the lines say. One each.
    SELECT coalesce(array_agg(g.ing), '{}'), coalesce(array_agg(g.gen), '{}') INTO v_from, v_to
    FROM (
        SELECT DISTINCT ON (e.ing) e.ing, e.gen
        FROM (
            SELECT i.id AS ing, i.generic_id AS gen, 0 AS pick
            FROM public.app_item_presentation i
            WHERE i.item_type = 'ingredient' AND i.generic_id IS NOT NULL AND i.generic_id <> i.id
            UNION ALL
            SELECT l.ing, l.gen, 1
            FROM unnest(v_ing, v_gen) AS l(ing, gen)
            WHERE l.gen IS NOT NULL AND l.gen <> l.ing
        ) e
        ORDER BY e.ing, e.pick, e.gen
    ) g;

    -- The shelf, as far as the caller can still see it.
    SELECT coalesce(array_agg(h.item_id), '{}') INTO v_shelf
    FROM public.home_bar_items h
    JOIN public.app_item_presentation i ON i.id = h.item_id
    WHERE h.user_id = (SELECT auth.uid());
    v_on_hand := v_shelf;
    -- Plain ingredients (lemons, mint, "Gin"): they cover their own lines and the kinds below them, never their siblings.
    SELECT coalesce(array_agg(i.id), '{}') INTO v_plain
    FROM public.app_item_presentation i
    WHERE i.id = ANY(v_shelf) AND i.ingredient_role = 'generic';

    -- House-made ingredients whose recipe is covered count as on hand, five rounds at most.
    LOOP
        -- On hand and their styles cover a line's ingredient or its style; anything further up, its ingredient only.
        v_have := v_on_hand || ARRAY(SELECT g.gen FROM unnest(v_from, v_to) AS g(ing, gen) WHERE g.ing = ANY(v_on_hand) AND NOT g.ing = ANY(v_plain));
        WITH RECURSIVE up AS (
            SELECT g.gen AS kind, 1 AS depth FROM unnest(v_from, v_to) AS g(ing, gen) WHERE g.ing = ANY(v_on_hand) OR g.ing = ANY(v_have)
            UNION
            SELECT g.gen, u.depth + 1 FROM up u JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = u.kind WHERE u.depth < 8
        )
        SELECT v_have || coalesce(array_agg(DISTINCT u.kind), '{}') INTO v_kinds FROM up u;
        EXIT WHEN v_depth >= 5;
        SELECT coalesce(array_agg(s.owner), '{}') INTO v_added
        FROM (
            SELECT l.owner
            FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
            LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
            WHERE NOT l.drink AND NOT l.owner = ANY(v_on_hand)
            GROUP BY l.owner
            HAVING bool_and(l.opt OR l.ing = ANY(v_kinds) OR coalesce(coalesce(l.gen, g.gen) = ANY(v_have), false))
        ) s;
        EXIT WHEN cardinality(v_added) = 0;
        v_on_hand := v_on_hand || v_added;
        v_depth := v_depth + 1;
    END LOOP;

    -- Made, not bought: on hand only because the shelf covers the recipe.
    v_made := ARRAY(SELECT unnest(v_on_hand) EXCEPT SELECT unnest(v_shelf));
    IF cardinality(v_made) = 0 THEN
        RETURN;
    END IF;

    -- Each made prep, and the drinks whose lines use it, directly or through another made prep.
    RETURN QUERY
    WITH RECURSIVE made_lines AS MATERIALIZED (
        SELECT l.owner, l.ing, l.drink
        FROM unnest(v_owner, v_ing, v_drink) AS l(owner, ing, drink)
        JOIN unnest(v_made) AS m(id) ON m.id = l.ing
    ), relies AS (
        SELECT m.owner AS drink, m.ing AS prep, 0 AS depth FROM made_lines m WHERE m.drink
        UNION
        SELECT r.drink, m.ing, r.depth + 1
        FROM relies r
        JOIN made_lines m ON m.owner = r.prep
        WHERE r.depth < 5
    )
    SELECT i.id, i.name, array_agg(DISTINCT r.drink ORDER BY r.drink)
    FROM relies r
    JOIN public.app_item_presentation i ON i.id = r.prep
    GROUP BY i.id, i.name
    ORDER BY count(DISTINCT r.drink) DESC, i.name, i.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."my_bar_preps"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_preps"() TO "authenticated", "service_role";
