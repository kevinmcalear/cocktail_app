-- My Bar: one row per recipe, with the bars that serve it.
--
-- A classic used to come back once, then again for every bar that pours its
-- own copy (production has 14 Boulevardiers). Now, with the spec match from
-- 20261010900000 and Kevin's rules (2026-10-09):
--   * a bar's version that is the classic as the caller sees it (the same
--     spec, or none to tell) folds into the classic's row and no longer has
--     its own;
--   * the classic's row says where it's served: served_count bars, and the
--     first three (name and logo) in served_at, its origin bar first, then
--     the bars ranked most for it. Bars whose version has no spec count too:
--     they pour the classic;
--   * a variation keeps its own row, with spec_match 'variation' and
--     spec_note saying what it changes ({"swaps": [{"to": "Rye", "from":
--     "Bourbon", "base": true}], "adds": [...], "drops": [...], "measures":
--     true}); a riff (another name) says 'riff'.
-- Folded rows drop out before the page is cut, so paging by name and id
-- holds. The bars come through spec_matches_seen, so a Locked bar page or
-- masked spec says no more here than on the drink page.
--
-- New columns need DROP and CREATE (as 20261010500000); same signature, so the
-- app reads them only when they're there. Same rules otherwise as
-- 20261010510000.

-- The bars pouring each classic as it is, one row per bar, from bar versions
-- the caller has already read through items' row level security (only
-- my_bar_drinks calls it, as the caller).
CREATE FUNCTION "private"."served_at"("p_version_ids" "uuid"[])
RETURNS TABLE("classic_id" "uuid", "bar_key" "uuid", "name" "text", "logo" "text", "origin" boolean, "ranks" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH folded AS (
    SELECT s.item_id, s.classic_id
      FROM private.spec_verdicts_seen(p_version_ids, false, true) s
     WHERE s.spec_match IN ('same', 'unlisted')
  ), bars AS (
    SELECT f.classic_id,
           coalesce(i.origin_bar_profile_id, vp.id, i.bar_id) AS bar_key,
           coalesce(o.display_name, vb.name) AS name,
           CASE WHEN o.id IS NOT NULL THEN o.avatar_url ELSE vb.logo_url END AS logo,
           coalesce(i.origin_bar_profile_id = c.origin_bar_profile_id, false) AS origin,
           coalesce(i.origin_bar_profile_id, vp.id) AS profile_id
      FROM folded f
      JOIN public.items i ON i.id = f.item_id
      JOIN public.items c ON c.id = f.classic_id
      -- A credited bar's name only from its public page, as the drink card shows it.
      LEFT JOIN public.profiles o ON o.id = i.origin_bar_profile_id AND o.is_public
      LEFT JOIN public.bars vb ON vb.id = i.bar_id
      LEFT JOIN public.profiles vp ON vp.bar_id = i.bar_id AND i.origin_bar_profile_id IS NULL
  )
  SELECT DISTINCT ON (b.classic_id, b.bar_key)
         b.classic_id, b.bar_key, b.name, b.logo, b.origin,
         (SELECT count(*) FROM public.rank_entries re WHERE re.ranked_as_item_id = b.classic_id AND re.venue_profile_id = b.profile_id)
    FROM bars b
   WHERE b.name IS NOT NULL
   ORDER BY b.classic_id, b.bar_key, b.origin DESC;
$$;

REVOKE ALL ON FUNCTION "private"."served_at"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."served_at"("uuid"[]) TO "authenticated", "service_role";

DROP FUNCTION "public"."my_bar_drinks"("text", "uuid", integer, boolean);

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
    "uses" "uuid"[],
    "from_name" "text",
    "from_logo" "text",
    "served_count" integer,
    "served_at" "jsonb",
    "spec_match" "text",
    "spec_note" "jsonb"
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
    v_m_drink uuid[];
    v_m_buy uuid[];
    v_m_buy2 uuid[];
    v_specced uuid[];
    v_folded uuid[];
    -- Where the page after p_after_id starts among drinks of its name: 0 catalog, 1 the rest, -1 all of them.
    v_after_rank integer := coalesce((SELECT CASE WHEN it.is_catalog THEN 0 ELSE 1 END FROM public.items it WHERE it.id = p_after_id), -1);
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
           coalesce(array_agg(i.item_type = 'cocktail'), '{}'),
           -- Drinks with a spec to follow: at least one amount the caller can see.
           coalesce(array_agg(DISTINCT r.recipe_item_id) FILTER (WHERE i.item_type = 'cocktail' AND r.amount IS NOT NULL), '{}')
    INTO v_owner, v_ing, v_gen, v_opt, v_drink, v_specced
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

    -- What the shelf makes and what it's short of, before any names: arrays the page can look up by id.
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
    ), short AS MATERIALIZED (
        -- House-made ingredients missing something, as a small list to join (not a scan per walked line).
        SELECT DISTINCT m.owner FROM missing m WHERE NOT m.drink
    ), away AS (
        SELECT w.drink, min(w.buy::text)::uuid AS buy, max(w.buy::text)::uuid AS buy2, count(DISTINCT w.buy) AS n
        FROM walk w
        LEFT JOIN short s ON s.owner = w.ing
        -- A missing house-made ingredient stands for what its own recipe is missing.
        WHERE NOT (w.depth < 5 AND s.owner IS NOT NULL)
        GROUP BY w.drink
        HAVING count(DISTINCT w.buy) <= CASE WHEN p_two_away THEN 2 ELSE 1 END
    ), matches AS (
        SELECT d.owner AS drink, NULL::uuid AS buy, NULL::uuid AS buy2
        FROM (SELECT DISTINCT l.owner FROM lines l WHERE l.drink) d
        WHERE NOT EXISTS (SELECT 1 FROM missing m WHERE m.owner = d.owner)
        UNION ALL
        SELECT a.drink, a.buy, CASE WHEN a.n = 2 THEN a.buy2 END FROM away a
    )
    SELECT coalesce(array_agg(m.drink), '{}'), coalesce(array_agg(m.buy), '{}'), coalesce(array_agg(m.buy2), '{}')
    INTO v_m_drink, v_m_buy, v_m_buy2
    FROM matches m;

    -- A bar's version that is the classic, as the caller sees it (same spec, or
    -- none to tell), folds into the classic's row (20261010900000).
    SELECT coalesce(array_agg(s.item_id), '{}') INTO v_folded
    FROM private.spec_verdicts_seen(ARRAY(
        SELECT m.drink FROM unnest(v_m_drink) AS m(drink)
        JOIN public.items it ON it.id = m.drink
        WHERE NOT it.is_catalog AND it.riff_of_id IS NOT NULL), false, true) s
    WHERE s.spec_match IN ('same', 'unlisted');

    RETURN QUERY
    WITH RECURSIVE page AS (
        SELECT i.id, i.name, i.glassware_id, i.bar_id, i.origin_bar_profile_id, coalesce(it.is_catalog, false) AS is_catalog,
               CASE WHEN coalesce(it.is_catalog, false) THEN 0 ELSE 1 END AS rank,
               m.buy, b.name AS buy_name, m.buy2, b2.name AS buy2_name
        FROM unnest(v_m_drink, v_m_buy, v_m_buy2) AS m(drink, buy, buy2)
        JOIN unnest(v_specced) AS s(drink) ON s.drink = m.drink
        JOIN public.app_item_presentation i ON i.id = m.drink
        LEFT JOIN public.items it ON it.id = m.drink
        LEFT JOIN public.app_item_presentation b ON b.id = m.buy
        LEFT JOIN public.app_item_presentation b2 ON b2.id = m.buy2
        WHERE NOT m.drink = ANY(v_folded)
          AND (m.buy IS NULL OR b.id IS NOT NULL)
          AND (m.buy2 IS NULL OR b2.id IS NOT NULL)
          AND (p_after_name IS NULL OR (i.name, CASE WHEN coalesce(it.is_catalog, false) THEN 0 ELSE 1 END, i.id)
               > (p_after_name, v_after_rank, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        -- A classic before the bars' versions of it.
        ORDER BY i.name, rank, i.id
        LIMIT v_limit
    ), shelf_kinds AS MATERIALIZED (
        -- Each shelf row, its style (covers a line's ingredient or style), and the kinds further up (ingredient only).
        SELECT s.item, s.item AS kind, true AS near FROM unnest(v_shelf) AS s(item)
        UNION
        SELECT s.item, g.gen, true FROM unnest(v_shelf) AS s(item) JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = s.item WHERE NOT s.item = ANY(v_plain)
        UNION
        SELECT k.item, g.gen, false FROM shelf_kinds k JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = k.kind
    ), lines AS (
        -- The page's own lines, for which shelf rows each drink uses.
        SELECT l.owner, l.ing, coalesce(l.gen, g.gen) AS gen
        FROM unnest(v_owner, v_ing, v_gen) AS l(owner, ing, gen)
        LEFT JOIN unnest(v_from, v_to) AS g(ing, gen) ON g.ing = l.ing
        WHERE l.owner IN (SELECT p.id FROM page p)
    ), uses AS (
        SELECT l.owner AS drink, array_agg(DISTINCT k.item) AS items
        FROM lines l
        JOIN shelf_kinds k ON k.kind = l.ing OR (k.near AND k.kind = l.gen)
        GROUP BY l.owner
    ), heroes AS MATERIALIZED (
        -- Photos before sketches, then their saved order (lib/itemImages.ts orderedPictures).
        SELECT DISTINCT ON (ii.item_id) ii.item_id, im.url
        FROM public.item_images ii
        JOIN public.images im ON im.id = ii.image_id
        WHERE ii.item_id IN (SELECT p.id FROM page p) AND ii.angle = 'hero'
        ORDER BY ii.item_id, ii.is_generated, coalesce(ii.sort_order, 0)
    ), spec AS MATERIALIZED (
        -- A bar's own row: a variation and what it changes, or a riff.
        SELECT s.item_id, s.spec_match, s.notes
        FROM private.spec_matches_seen(ARRAY(SELECT p.id FROM page p WHERE NOT p.is_catalog)) s
    ), served AS MATERIALIZED (
        -- A classic's row: the bars that pour it as it is.
        SELECT sv.*, row_number() OVER (PARTITION BY sv.classic_id ORDER BY sv.origin DESC, sv.ranks DESC, sv.name, sv.bar_key) AS ord
        -- The classics' bar versions the caller can read (row level security, as the caller).
        FROM private.served_at(ARRAY(
            SELECT v.id FROM public.items v
            WHERE v.riff_of_id IN (SELECT p.id FROM page p WHERE p.is_catalog) AND NOT v.is_catalog)) sv
    )
    SELECT p.id, p.name, h.url, p.glassware_id, p.buy, p.buy_name, p.buy2, p.buy2_name, coalesce(u.items, '{}'),
           -- Where it's from: the bar credited with it, else the venue that owns it. Not for catalog drinks.
           CASE WHEN NOT p.is_catalog THEN coalesce(o.display_name, v.name) END,
           CASE WHEN NOT p.is_catalog THEN CASE WHEN o.id IS NOT NULL THEN o.avatar_url ELSE v.logo_url END END,
           -- Served at: how many bars, and the first three (its origin bar, then the most ranked).
           coalesce((SELECT count(*)::integer FROM served sv WHERE sv.classic_id = p.id), 0),
           (SELECT jsonb_agg(jsonb_build_object('name', sv.name, 'logo', sv.logo) ORDER BY sv.ord)
              FROM served sv WHERE sv.classic_id = p.id AND sv.ord <= 3),
           sp.spec_match, sp.notes
    FROM page p
    LEFT JOIN heroes h ON h.item_id = p.id
    LEFT JOIN uses u ON u.drink = p.id
    LEFT JOIN spec sp ON sp.item_id = p.id
    LEFT JOIN public.profiles o ON o.id = p.origin_bar_profile_id
    LEFT JOIN public.bars v ON v.id = p.bar_id
    ORDER BY p.name, p.rank, p.id;
END;
$$;

REVOKE ALL ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer, boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."my_bar_drinks"("text", "uuid", integer, boolean) TO "authenticated", "service_role";
