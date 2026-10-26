-- Can the bar make it? At a venue, search's Everywhere results say so for each
-- drink: "Can make", or "Missing 1: Cynar" (QA Q37, 25 Oct 2026). At home the
-- shelf is the caller's own (my_bar_drinks); a venue's back bar lives on the
-- server, so this checks a page of drinks against it.
--
--   private.venue_back_bar(bar)       what the venue has: its stock list
--                                     (back_bar_items), what has a spot on its
--                                     map (item_locations), its own
--                                     ingredients, what its own drinks and
--                                     house-made recipes pour (the Back Bar
--                                     screen's list, hooks/useBackBar.ts
--                                     useBackBarParts), and the pantry staples.
--   public.venue_can_make(bar, ids)   for each drink with a spec the caller can
--                                     read: can make, how many things are
--                                     missing, and the first three by name.
--
-- The matching is my_bar_drinks' (20261016700000), rule for rule: a specific
-- bottle covers its own line and lines naming its style or a sibling bottle
-- of that style; a plain ingredient ("Gin") covers its own lines and the
-- kinds above it, never its siblings; a house-made ingredient whose recipe is
-- covered counts as on hand (five rounds); a missing house-made ingredient
-- stands for what its own recipe is missing; optional lines and a drink's
-- garnishes never block it. Checked against my_bar_drinks on the local stack
-- with the same shelf at home: 500 random catalog drinks, five random shelves,
-- the same verdict and the same missing bottles for every one.
--
-- my_bar_drinks reads every line; this reads a page's worth, so it differs
-- where a far-off line would have mattered:
--   1. House-made recipes: the ones a line names (five levels down) and
--      house-made kinds of a line's ingredient or style (one level), not
--      every recipe. A house-made kind two levels below a line is missed.
--   2. An ingredient with no style of its own takes one from the lines read
--      here, not from every line.
--   3. The style tree is read from items, not app_item_presentation: a
--      hidden style above a shelf bottle still counts as a kind of it.
-- And one on purpose: the pantry staples (lib/pantry.ts) always count at a
-- venue. At home you tick them (they are shelf rows); a bar keeps lemons and
-- sugar whether or not anyone wrote them down.
--
-- Only the venue's staff can ask (any role, as back_bar_items reads). It runs
-- as the definer, so the map's spots count for every member, not only those
-- who may see the map. Specs come through app_recipe_presentation, which
-- shows each caller what their role may see: another bar's hidden spec gets
-- no answer. The venue's own specs pour what they pour for every member, but
-- a brand the caller may not see pours as its style, so asking can't reveal
-- which bottle a hidden spec names. At most 100 drinks a call: a page of
-- search results is 30. Indexes: the ones it needs already exist (recipes by
-- drink, items by kind, the stock list and spots by bar).

CREATE FUNCTION "private"."venue_back_bar"("p_bar_id" "uuid")
RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH own AS (
    SELECT i.id, i.item_type FROM public.items i
     WHERE i.bar_id = p_bar_id AND i.item_type IN ('cocktail', 'ingredient')
  ), shelf AS (
    SELECT b.item_id AS id FROM public.back_bar_items b WHERE b.bar_id = p_bar_id
    UNION
    SELECT l.item_id FROM public.item_locations l WHERE l.bar_id = p_bar_id
    UNION
    SELECT o.id FROM own o WHERE o.item_type = 'ingredient'
    UNION
    -- As the caller's role shows the specs: a brand they may not see pours as its style.
    SELECT coalesce(v.display_ingredient_id, r.parent_ingredient_id, s.generic_id, r.ingredient_item_id)
    FROM public.recipes r
    JOIN own o ON o.id = r.recipe_item_id
    LEFT JOIN public.items s ON s.id = r.ingredient_item_id
    LEFT JOIN public.app_recipe_presentation v ON v.id = r.id
    WHERE r.ingredient_item_id IS NOT NULL
    UNION
    -- The pantry staples, as lib/pantry.ts names them (PANTRY and PANTRY_WATER).
    SELECT s.id FROM public.items s
     WHERE s.item_type = 'ingredient' AND s.bar_id IS NULL
       AND public.ingredient_key(s.name) = ANY(ARRAY(SELECT public.ingredient_key(n)
             FROM unnest(ARRAY['Lemon', 'Lime', 'Orange', 'Grapefruit', 'Sugar', 'Honey', 'Egg', 'Soda Water', 'Mint', 'Water']) AS n))
  )
  SELECT s.id FROM shelf s
$$;

-- Only venue_can_make reads it, once it has checked the caller is staff.
REVOKE ALL ON FUNCTION "private"."venue_back_bar"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."venue_back_bar"("uuid") TO "service_role";

CREATE FUNCTION "public"."venue_can_make"("p_bar_id" "uuid", "p_drink_ids" "uuid"[])
RETURNS TABLE(
    "drink_id" "uuid",
    "can_make" boolean,
    "missing_count" integer,
    "missing" "jsonb"
)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_drinks uuid[] := ARRAY(SELECT DISTINCT d.id FROM unnest(p_drink_ids) AS d(id) WHERE d.id IS NOT NULL);
    v_owner uuid[] := '{}';
    v_ing uuid[] := '{}';
    v_gen uuid[] := '{}';
    v_opt boolean[] := '{}';
    v_drink boolean[] := '{}';
    v_specced uuid[] := '{}';
    v_l_owner uuid[];
    v_l_ing uuid[];
    v_l_gen uuid[];
    v_l_opt boolean[];
    v_l_drink boolean[];
    v_l_specced uuid[];
    v_next uuid[];
    v_seen uuid[] := '{}';
    v_searched uuid[] := '{}';
    v_kinds_next uuid[];
    v_level integer := 0;
    v_b_drink uuid[];
    v_b_buy uuid[];
    v_from uuid[];
    v_to uuid[];
    v_styles uuid[];
    v_shelf uuid[];
    v_plain uuid[];
    v_on_hand uuid[];
    v_have uuid[];
    v_kinds uuid[];
    v_added uuid[];
    v_depth integer := 0;
BEGIN
    IF p_bar_id IS NULL OR NOT p_bar_id IN (SELECT private.my_bar_ids(0)) THEN
        RAISE EXCEPTION 'Only the venue''s staff can check its back bar' USING ERRCODE = '42501';
    END IF;
    IF cardinality(v_drinks) > 100 THEN
        RAISE EXCEPTION 'At most 100 drinks at a time' USING ERRCODE = '22023';
    END IF;
    IF cardinality(v_drinks) = 0 THEN
        RETURN;
    END IF;

    -- The page's drinks' lines, then the house-made recipes they need, five
    -- levels down: the ones a line names, and house-made kinds of what a line
    -- names or of its style (a bottle's lines are none). Garnishes and optional lines
    -- never block a drink (my_bar_drinks' rule, word for word).
    v_next := v_drinks;
    LOOP
        -- Planned for these ids each time: a cached plan reads the views far slower.
        EXECUTE '
        SELECT coalesce(array_agg(r.recipe_item_id), ''{}''), coalesce(array_agg(r.display_ingredient_id), ''{}''),
               coalesce(array_agg(r.parent_ingredient_id), ''{}''),
               coalesce(array_agg(coalesce(r.is_optional, false) OR (i.item_type = ''cocktail'' AND (
                   coalesce(r.preparation_notes ~* ''\mgarnish'', false)
                   OR coalesce(lower(r.unit) IN (''peel'', ''twist'', ''wheel'', ''rim''), false)
               ))), ''{}''),
               coalesce(array_agg(i.item_type = ''cocktail''), ''{}''),
               coalesce(array_agg(DISTINCT r.recipe_item_id) FILTER (WHERE i.item_type = ''cocktail'' AND r.amount IS NOT NULL), ''{}'')
        FROM public.app_recipe_presentation r
        JOIN public.items i ON i.id = r.recipe_item_id
        WHERE r.recipe_item_id = ANY($1) AND r.display_ingredient_id IS NOT NULL
          AND i.item_type = $2'
        INTO v_l_owner, v_l_ing, v_l_gen, v_l_opt, v_l_drink, v_l_specced
        USING v_next, (CASE WHEN v_level = 0 THEN 'cocktail' ELSE 'ingredient' END)::public.entity_type;
        v_owner := v_owner || v_l_owner;
        v_ing := v_ing || v_l_ing;
        v_gen := v_gen || v_l_gen;
        v_opt := v_opt || v_l_opt;
        v_drink := v_drink || v_l_drink;
        v_specced := v_specced || v_l_specced;
        v_seen := v_seen || v_next;
        EXIT WHEN v_level >= 5 OR cardinality(v_l_owner) = 0;
        -- Each kind searched for house-made ingredients once.
        v_kinds_next := ARRAY(
            SELECT DISTINCT k.id FROM unnest(v_l_ing || v_l_gen) AS k(id)
            WHERE k.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM unnest(v_searched) AS x(id) WHERE x.id = k.id));
        v_searched := v_searched || v_kinds_next;
        v_next := ARRAY(
            SELECT DISTINCT n.id FROM (
                SELECT unnest(v_l_ing) AS id
                UNION ALL
                SELECT c.id FROM public.items c
                 WHERE c.generic_id = ANY(v_kinds_next) AND c.item_type = 'ingredient'
                   AND EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = c.id)
            ) n
            WHERE n.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM unnest(v_seen) AS x(id) WHERE x.id = n.id));
        EXIT WHEN cardinality(v_next) = 0;
        v_level := v_level + 1;
    END LOOP;

    -- A garnish by name, looked up once for every line.
    SELECT coalesce(array_agg(l.opt OR (l.drink AND coalesce(n.name ~* '(\m(twist|peel|zest|wheel)s?|^(lemon|lime|orange|grapefruit) oil|\m(maraschino|luxardo|brandied|amarena|cocktail) cherr(y|ies)|\molives?|^(cocktail|pickled|pearl) onions?)$', false)) ORDER BY l.ord), '{}')
    INTO v_opt
    FROM unnest(v_ing, v_opt, v_drink) WITH ORDINALITY AS l(ing, opt, drink, ord)
    LEFT JOIN (SELECT d.id, d.name FROM public.app_item_presentation d WHERE d.id = ANY(v_ing)) n ON n.id = l.ing;

    IF cardinality(v_specced) = 0 THEN
        RETURN;
    END IF;

    -- The back bar, as far as the caller can see each item.
    SELECT coalesce(array_agg(i.id), '{}'),
           coalesce(array_agg(i.id) FILTER (WHERE i.ingredient_role = 'generic'), '{}')
    INTO v_shelf, v_plain
    FROM private.venue_back_bar(p_bar_id) AS s(id)
    JOIN public.app_item_presentation i ON i.id = s.id
    WHERE i.item_type = 'ingredient';
    v_on_hand := v_shelf;

    -- Ingredient to its style: the tree when it says, else what the lines say.
    -- Only from the shelf and the lines up, which is all the checks below walk.
    WITH RECURSIVE said AS MATERIALIZED (
        SELECT DISTINCT ON (l.ing) l.ing, l.gen
        FROM unnest(v_ing, v_gen) AS l(ing, gen)
        WHERE l.gen IS NOT NULL AND l.gen <> l.ing
        ORDER BY l.ing, l.gen
    ), up(ing, gen, depth) AS (
        SELECT s.id, coalesce(t.generic_id, sd.gen), 0
        FROM (SELECT DISTINCT x.id FROM unnest(v_shelf || v_ing || v_gen || v_owner) AS x(id) WHERE x.id IS NOT NULL) s
        LEFT JOIN public.items t ON t.id = s.id AND t.item_type = 'ingredient' AND t.generic_id <> t.id
        LEFT JOIN said sd ON sd.ing = s.id
        UNION
        SELECT u.gen, coalesce(t.generic_id, sd.gen), u.depth + 1
        FROM up u
        LEFT JOIN public.items t ON t.id = u.gen AND t.item_type = 'ingredient' AND t.generic_id <> t.id
        LEFT JOIN said sd ON sd.ing = u.gen
        WHERE u.gen IS NOT NULL AND u.depth < 8
    )
    SELECT coalesce(array_agg(p.ing), '{}'), coalesce(array_agg(p.gen), '{}') INTO v_from, v_to
    FROM (SELECT DISTINCT u.ing, u.gen FROM up u WHERE u.gen IS NOT NULL) p;

    -- Plain ingredients and styles: what to buy for their lines is themselves.
    SELECT coalesce(array_agg(i.id), '{}') INTO v_styles
    FROM public.app_item_presentation i
    WHERE i.id = ANY(v_ing) AND i.ingredient_role = 'generic';

    -- House-made ingredients whose recipe is covered count as on hand, five rounds at most.
    LOOP
        -- On hand and their styles cover a line's ingredient or its style; anything further up, its ingredient only.
        v_have := v_on_hand || ARRAY(
            SELECT g.gen FROM unnest(v_from, v_to) AS g(ing, gen)
            JOIN (SELECT DISTINCT o.id FROM unnest(v_on_hand) AS o(id)) o ON o.id = g.ing
            WHERE NOT EXISTS (SELECT 1 FROM unnest(v_plain) AS pl(id) WHERE pl.id = g.ing));
        WITH RECURSIVE pairs AS MATERIALIZED (
            SELECT g.ing, g.gen FROM unnest(v_from, v_to) AS g(ing, gen)
        ), up AS (
            SELECT g.gen AS kind, 1 AS depth FROM pairs g JOIN (SELECT DISTINCT h.id FROM unnest(v_have) AS h(id)) h ON h.id = g.ing
            UNION
            SELECT g.gen, u.depth + 1 FROM up u JOIN pairs g ON g.ing = u.kind WHERE u.depth < 8
        )
        SELECT v_have || coalesce(array_agg(DISTINCT u.kind), '{}') INTO v_kinds FROM up u;
        EXIT WHEN v_depth >= 5;
        WITH kinds AS MATERIALIZED (
            SELECT DISTINCT k.id FROM unnest(v_kinds) AS k(id)
        ), have AS MATERIALIZED (
            SELECT DISTINCT h.id FROM unnest(v_have) AS h(id)
        ), on_hand AS MATERIALIZED (
            SELECT DISTINCT o.id FROM unnest(v_on_hand) AS o(id)
        )
        SELECT coalesce(array_agg(s.owner), '{}') INTO v_added
        FROM (
            SELECT l.owner
            FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
            LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
            LEFT JOIN kinds k ON k.id = l.ing
            LEFT JOIN have h ON h.id = coalesce(l.gen, g.gen)
            WHERE NOT l.drink AND NOT EXISTS (SELECT 1 FROM on_hand o WHERE o.id = l.owner)
            GROUP BY l.owner
            HAVING bool_and(l.opt OR k.id IS NOT NULL OR h.id IS NOT NULL)
        ) s;
        EXIT WHEN cardinality(v_added) = 0;
        v_on_hand := v_on_hand || v_added;
        v_depth := v_depth + 1;
    END LOOP;

    -- What each drink is short of: my_bar_drinks' walk, with its sets as
    -- tables to join (an ANY over an array variable is read end to end).
    WITH RECURSIVE kinds AS MATERIALIZED (
        SELECT DISTINCT k.id FROM unnest(v_kinds) AS k(id)
    ), have AS MATERIALIZED (
        SELECT DISTINCT h.id FROM unnest(v_have) AS h(id)
    ), styles AS MATERIALIZED (
        SELECT DISTINCT st.id FROM unnest(v_styles) AS st(id)
    ), lines AS MATERIALIZED (
        SELECT l.owner, l.ing, coalesce(l.gen, g.gen) AS gen, l.opt, l.drink
        FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
        LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
    ), missing AS MATERIALIZED (
        -- What to buy for a line: a bottle's style when it has one, else the ingredient itself.
        SELECT l.owner, l.ing, CASE WHEN st.id IS NOT NULL THEN l.ing ELSE coalesce(l.gen, l.ing) END AS buy, l.drink
        FROM lines l
        LEFT JOIN kinds k ON k.id = l.ing
        LEFT JOIN have h ON h.id = l.gen
        LEFT JOIN styles st ON st.id = l.ing
        WHERE NOT l.opt AND k.id IS NULL AND h.id IS NULL
    ), walk AS (
        SELECT m.owner AS drink, m.ing, m.buy, 0 AS depth FROM missing m WHERE m.drink
        UNION ALL
        SELECT w.drink, m.ing, m.buy, w.depth + 1
        FROM walk w
        JOIN missing m ON m.owner = w.ing AND NOT m.drink
        WHERE w.depth < 5
    ), short AS MATERIALIZED (
        SELECT DISTINCT m.owner FROM missing m WHERE NOT m.drink
    )
    -- A missing house-made ingredient stands for what its own recipe is missing.
    SELECT coalesce(array_agg(b.drink), '{}'), coalesce(array_agg(b.buy), '{}') INTO v_b_drink, v_b_buy
    FROM (
        SELECT DISTINCT w.drink, w.buy
        FROM walk w
        LEFT JOIN short s ON s.owner = w.ing
        WHERE NOT (w.depth < 5 AND s.owner IS NOT NULL)
    ) b;

    RETURN QUERY
    WITH named AS (
        SELECT b.drink, b.buy, n.name, row_number() OVER (PARTITION BY b.drink ORDER BY n.name, b.buy) AS ord
        FROM unnest(v_b_drink, v_b_buy) AS b(drink, buy)
        LEFT JOIN (SELECT p.id, p.name FROM public.app_item_presentation p WHERE p.id = ANY(v_b_buy)) n ON n.id = b.buy
    )
    SELECT s.drink, count(n.buy) = 0, count(n.buy)::integer,
           coalesce(jsonb_agg(jsonb_build_object('id', n.buy, 'name', n.name) ORDER BY n.ord) FILTER (WHERE n.ord <= 3 AND n.name IS NOT NULL), '[]'::jsonb)
    FROM unnest(v_specced) AS s(drink)
    LEFT JOIN named n ON n.drink = s.drink
    GROUP BY s.drink;
END;
$$;

REVOKE ALL ON FUNCTION "public"."venue_can_make"("uuid", "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."venue_can_make"("uuid", "uuid"[]) TO "authenticated", "service_role";
