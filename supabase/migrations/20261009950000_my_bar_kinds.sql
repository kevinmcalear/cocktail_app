-- My Bar reads the "kind of" tree, can look two bottles away, and says which
-- bottles each drink uses.
--
-- my_bar_drinks (20261008340000) learned which bottle belongs to which style
-- only from recipe lines, one step up. A bottle no line names with its style
-- (Woodford Reserve Double Oaked, with two lines) covered nothing but itself,
-- and nothing ever covered a line that just says "Whiskey": a shelf of
-- bourbon, lemons and sugar made no Whiskey Sour. Since 20261008100100 every
-- shared bottle says what it's a kind of (items.generic_id), so:
--
--   * a bottle's style comes from the tree first, the lines second. A
--     bottle covers lines for other bottles of its style (Woodford covers
--     Buffalo Trace), as before; a plain ingredient doesn't (a lime is a
--     kind of Citrus but covers no yuzu, mint is an herb but no basil);
--   * a line naming anything a bottle is a kind of, however far up, is
--     covered: Woodford covers "Bourbon", "Whiskey" and "Spirit" lines.
--     Only the line's own ingredient counts that far: a "Rye Whiskey" line
--     (a kind of Whiskey) still wants rye, not bourbon;
--   * what to buy for a missing line is the style of a bottle ("Gin" for a
--     Tanqueray line) but a plain ingredient itself: "Vodka", not "Spirit";
--   * p_two_away (default off, so apps that don't know it see the same rows):
--     drinks two things away, missing_id and missing2_id, A to Z by id;
--   * uses: the shelf rows that cover a drink's lines, for "most used" and
--     "not used yet" on the shelf. House-made ingredients count for nothing:
--     they aren't rows on the shelf.
--
-- Same rules otherwise: runs as the caller through the role-masked views,
-- signed-in only. The return type changes, so the function is dropped and
-- made again; its grants are given again below.

DROP FUNCTION "public"."my_bar_drinks"("text", "uuid", integer);

CREATE FUNCTION "public"."my_bar_drinks"(
    "p_after_name" "text" DEFAULT NULL,
    "p_after_id" "uuid" DEFAULT NULL,
    "p_limit" integer DEFAULT 1000,
    "p_two_away" boolean DEFAULT false
) RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "image_url" "text",
    "glassware_id" "uuid",
    "missing_id" "uuid",
    "missing_name" "text",
    "missing2_id" "uuid",
    "missing2_name" "text",
    "uses" "uuid"[]
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
    v_styles uuid[];
    v_on_hand uuid[];
    v_have uuid[];
    v_kinds uuid[];
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

    -- Plain ingredients and styles: what to buy for their lines is themselves.
    SELECT coalesce(array_agg(i.id), '{}') INTO v_styles
    FROM public.app_item_presentation i
    WHERE i.item_type = 'ingredient' AND i.ingredient_role = 'generic';

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

    RETURN QUERY
    WITH RECURSIVE lines AS MATERIALIZED (
        SELECT l.owner, l.ing, coalesce(l.gen, g.gen) AS gen, l.opt, l.drink
        FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
        LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
    ), missing AS MATERIALIZED (
        -- What to buy for a line: a bottle's style when it has one, else the ingredient itself.
        SELECT l.owner, l.ing, CASE WHEN l.ing = ANY(v_styles) THEN l.ing ELSE coalesce(l.gen, l.ing) END AS buy, l.drink
        FROM lines l
        WHERE NOT l.opt AND NOT (l.ing = ANY(v_kinds) OR coalesce(l.gen = ANY(v_have), false))
    ), walk AS (
        SELECT m.owner AS drink, m.ing, m.buy, 0 AS depth FROM missing m WHERE m.drink
        UNION ALL
        SELECT w.drink, m.ing, m.buy, w.depth + 1
        FROM walk w
        JOIN missing m ON m.owner = w.ing AND NOT m.drink
        WHERE w.depth < 5
    ), away AS (
        SELECT w.drink, min(w.buy::text)::uuid AS buy, max(w.buy::text)::uuid AS buy2, count(DISTINCT w.buy) AS n
        FROM walk w
        -- A missing house-made ingredient stands for what its own recipe is missing.
        WHERE NOT (w.depth < 5 AND EXISTS (SELECT 1 FROM missing m WHERE m.owner = w.ing AND NOT m.drink))
        GROUP BY w.drink
        HAVING count(DISTINCT w.buy) <= CASE WHEN p_two_away THEN 2 ELSE 1 END
    ), matches AS (
        SELECT d.owner AS drink, NULL::uuid AS buy, NULL::uuid AS buy2
        FROM (SELECT DISTINCT l.owner FROM lines l WHERE l.drink) d
        WHERE NOT EXISTS (SELECT 1 FROM missing m WHERE m.owner = d.owner)
        UNION ALL
        SELECT a.drink, a.buy, CASE WHEN a.n = 2 THEN a.buy2 END FROM away a
    ), page AS (
        SELECT i.id, i.name, i.glassware_id, m.buy, b.name AS buy_name, m.buy2, b2.name AS buy2_name
        FROM matches m
        JOIN public.app_item_presentation i ON i.id = m.drink
        LEFT JOIN public.app_item_presentation b ON b.id = m.buy
        LEFT JOIN public.app_item_presentation b2 ON b2.id = m.buy2
        WHERE (m.buy IS NULL OR b.id IS NOT NULL)
          AND (m.buy2 IS NULL OR b2.id IS NOT NULL)
          AND (p_after_name IS NULL OR (i.name, i.id) > (p_after_name, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        ORDER BY i.name, i.id
        LIMIT v_limit
    ), shelf_kinds AS MATERIALIZED (
        -- Each shelf row, its style (covers a line's ingredient or style), and the kinds further up (ingredient only).
        SELECT s.item, s.item AS kind, true AS near FROM unnest(v_shelf) AS s(item)
        UNION
        SELECT s.item, g.gen, true FROM unnest(v_shelf) AS s(item) JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = s.item WHERE NOT s.item = ANY(v_plain)
        UNION
        SELECT k.item, g.gen, false FROM shelf_kinds k JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = k.kind
    ), uses AS (
        SELECT l.owner AS drink, array_agg(DISTINCT k.item) AS items
        FROM lines l
        JOIN shelf_kinds k ON k.kind = l.ing OR (k.near AND k.kind = l.gen)
        WHERE l.owner IN (SELECT p.id FROM page p)
        GROUP BY l.owner
    ), heroes AS MATERIALIZED (
        -- Photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT p.id FROM page p) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    )
    SELECT p.id, p.name, h.url, p.glassware_id, p.buy, p.buy_name, p.buy2, p.buy2_name, coalesce(u.items, '{}')
    FROM page p
    LEFT JOIN heroes h ON h.item_id = p.id
    LEFT JOIN uses u ON u.drink = p.id
    ORDER BY p.name, p.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer, boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer, boolean) TO "authenticated", "service_role";
