-- My Bar, two things the canvas draws that the database couldn't say yet.
--
-- 1. "One thing short" under Make first (board home-mybar-make-first): the
--    house preps one ingredient away from your shelf, and what that one
--    ingredient is ("Orgeat, needs almonds"). my_bar_preps lists only the
--    preps the shelf fully covers, and my_bar_drinks walks a missing prep
--    down to what its recipe is missing, so neither says which prep it was.
--    my_bar_preps_short says it, with the drinks whose lines use the prep;
--    the app keeps the ones my_bar_drinks has one away for that ingredient.
--    The on-hand rules are my_bar_preps's (20261010400000), copied word for
--    word: change them together. supabase/tests/my-bar.test.mjs checks they
--    agree.
--
-- 2. Finished bottles (board home-mybar-bottle, decision b51): "Finished
--    it, take it off my shelf" keeps a row in home_bar_finished (when you
--    bought it, when you finished it), so the bottle sheet can say "You've
--    finished this before" and list Your old bottles. finish_bar_item does
--    the move in one call. Rows are the owner's alone.

CREATE OR REPLACE FUNCTION "public"."my_bar_preps_short"()
RETURNS TABLE(
    "id" "uuid",
    "name" "text",
    "missing_id" "uuid",
    "missing_name" "text",
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
    v_styles uuid[];
    v_shelf uuid[];
    v_plain uuid[];
    v_on_hand uuid[];
    v_have uuid[];
    v_kinds uuid[];
    v_added uuid[];
    v_depth integer := 0;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN;
    END IF;

    -- Every recipe line the caller can read (my_bar_preps).
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

    -- Plain ingredients and styles: what to buy for their lines is themselves (my_bar_drinks).
    SELECT coalesce(array_agg(i.id), '{}') INTO v_styles
    FROM public.app_item_presentation i
    WHERE i.item_type = 'ingredient' AND i.ingredient_role = 'generic';

    -- The shelf, as far as the caller can still see it.
    SELECT coalesce(array_agg(h.item_id), '{}') INTO v_shelf
    FROM public.home_bar_items h
    JOIN public.app_item_presentation i ON i.id = h.item_id
    WHERE h.user_id = (SELECT auth.uid());
    IF cardinality(v_shelf) = 0 THEN
        RETURN;
    END IF;
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

    -- Each prep that isn't on hand and is short of exactly one line, what to
    -- buy for that line (my_bar_drinks's rule: a bottle's style when it has
    -- one), and the drinks whose lines use the prep. A prep only drinks use.
    RETURN QUERY
    WITH lines AS MATERIALIZED (
        SELECT l.owner, l.ing, coalesce(l.gen, g.gen) AS gen,
               l.opt OR l.ing = ANY(v_kinds) OR coalesce(coalesce(l.gen, g.gen) = ANY(v_have), false) AS covered
        FROM unnest(v_owner, v_ing, v_gen, v_opt, v_drink) AS l(owner, ing, gen, opt, drink)
        LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
        WHERE NOT l.drink AND NOT l.owner = ANY(v_on_hand)
    ), short AS (
        SELECT l.owner,
               min(CASE WHEN l.ing = ANY(v_styles) THEN l.ing ELSE coalesce(l.gen, l.ing) END::text) FILTER (WHERE NOT l.covered)::uuid AS buy
        FROM lines l
        GROUP BY l.owner
        HAVING count(*) FILTER (WHERE NOT l.covered) = 1 AND count(*) > 1
    ), used AS (
        SELECT s.owner, s.buy, array_agg(DISTINCT l.owner ORDER BY l.owner) AS drinks
        FROM short s
        JOIN unnest(v_owner, v_ing, v_drink) AS l(owner, ing, drink) ON l.ing = s.owner AND l.drink
        GROUP BY s.owner, s.buy
    )
    SELECT p.id, p.name, b.id, b.name, u.drinks
    FROM used u
    JOIN public.app_item_presentation p ON p.id = u.owner
    JOIN public.app_item_presentation b ON b.id = u.buy
    ORDER BY cardinality(u.drinks) DESC, p.name, p.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."my_bar_preps_short"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_preps_short"() TO "authenticated", "service_role";

-- Bottles you finished: one row each time, so a bottle bought three times has three.
CREATE TABLE "public"."home_bar_finished" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- When it went on the shelf (home_bar_items.added_at), if it was there.
    "bought_at" timestamp with time zone,
    "finished_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "home_bar_finished_order" CHECK ("bought_at" IS NULL OR "bought_at" <= "finished_at")
);

CREATE INDEX "home_bar_finished_user_idx" ON "public"."home_bar_finished" ("user_id", "finished_at" DESC);
CREATE INDEX "home_bar_finished_item_idx" ON "public"."home_bar_finished" ("item_id");

ALTER TABLE "public"."home_bar_finished" ENABLE ROW LEVEL SECURITY;

-- Your own rows only. No updates: a mistake is deleted, not edited.
CREATE POLICY "home_bar_finished_select" ON "public"."home_bar_finished"
    FOR SELECT TO "authenticated" USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "home_bar_finished_insert" ON "public"."home_bar_finished"
    FOR INSERT TO "authenticated" WITH CHECK ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "home_bar_finished_delete" ON "public"."home_bar_finished"
    FOR DELETE TO "authenticated" USING ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON TABLE "public"."home_bar_finished" FROM "anon";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."home_bar_finished" TO "authenticated";
GRANT ALL ON TABLE "public"."home_bar_finished" TO "service_role";

-- "Finished it": off the shelf and into your old bottles, in one go. As the
-- caller, so both tables' row rules apply. Not on the shelf: nothing happens.
CREATE OR REPLACE FUNCTION "public"."finish_bar_item"("p_item_id" "uuid")
RETURNS "void"
    LANGUAGE "plpgsql" VOLATILE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bought timestamp with time zone;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Sign in to change your bar' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.home_bar_items h
    WHERE h.user_id = (SELECT auth.uid()) AND h.item_id = p_item_id
    RETURNING h.added_at INTO v_bought;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    INSERT INTO public.home_bar_finished (user_id, item_id, bought_at)
    VALUES ((SELECT auth.uid()), p_item_id, least(v_bought, now()));
END;
$$;

REVOKE ALL ON FUNCTION "public"."finish_bar_item"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."finish_bar_item"("uuid") TO "authenticated", "service_role";
