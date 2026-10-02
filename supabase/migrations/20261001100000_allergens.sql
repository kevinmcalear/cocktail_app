-- DRAFT. Local stack only until Kevin's OK.
--
-- Allergens: the 14 the UK and EU require venues to declare, declared once on
-- the things a bar buys, and rolled up through every house-made recipe to
-- the drink. Nobody types "contains eggs" on a drink; the recipe says so.
--
--   item_allergens          which allergens an ingredient carries. bar_id NULL
--                           is the shared catalogue's declaration; a bar's own
--                           row set replaces it, since the bottle a bar buys
--                           may differ from the catalogue's.
--   item_allergen_checks    who checked an ingredient's allergens against its
--                           label or supplier sheet, and when, per bar or for
--                           the catalogue. A check with no allergen rows means
--                           "checked, none". No check means unknown, which is
--                           never shown as none.
--   drink_allergens(item)   the roll-up for a drink (or a prep): each allergen
--                           with the ingredient path it comes through, and how
--                           many ingredients are still unchecked. Names in the
--                           path follow the same role masking as the spec.

CREATE TYPE "public"."allergen" AS ENUM (
    'celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk',
    'molluscs', 'mustard', 'tree_nuts', 'peanuts', 'sesame', 'soya', 'sulphites'
);

CREATE TABLE "public"."item_allergens" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "allergen" "public"."allergen" NOT NULL
);
CREATE UNIQUE INDEX "item_allergens_key" ON "public"."item_allergens" ("item_id", "allergen", "bar_id") NULLS NOT DISTINCT;
CREATE INDEX "item_allergens_bar_id_idx" ON "public"."item_allergens" ("bar_id");

CREATE TABLE "public"."item_allergen_checks" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "bar_id" "uuid" REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "item_allergen_checks_key" ON "public"."item_allergen_checks" ("item_id", "bar_id") NULLS NOT DISTINCT;
CREATE INDEX "item_allergen_checks_bar_id_idx" ON "public"."item_allergen_checks" ("bar_id");

ALTER TABLE "public"."item_allergens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_allergen_checks" ENABLE ROW LEVEL SECURITY;

-- Can this person declare allergens in this scope? The catalogue's rows
-- (bar_id NULL) go with editing the item itself; a bar's rows go with editing
-- drinks at that bar, for any item the bar can use.
CREATE FUNCTION "private"."can_declare_allergens"("p_item_id" "uuid", "p_bar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_bar_id IS NULL THEN private.can_edit_item(p_item_id)
    ELSE p_bar_id IN (SELECT private.bars_with_capability('edit_drinks'))
         AND private.item_usable_at_bar(p_item_id, p_bar_id)
  END;
$$;

-- Catalogue rows read wherever the item reads (the items policies apply inside
-- the subquery); a bar's rows read for the bar's members.
CREATE POLICY "item_allergens_select" ON "public"."item_allergens" FOR SELECT TO "authenticated"
    USING (("bar_id" IS NULL AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id"))
           OR "bar_id" IN (SELECT "private"."bars_with_capability"('menu')));
CREATE POLICY "item_allergens_write" ON "public"."item_allergens" FOR ALL TO "authenticated"
    USING ("private"."can_declare_allergens"("item_id", "bar_id"))
    WITH CHECK ("private"."can_declare_allergens"("item_id", "bar_id"));

CREATE POLICY "item_allergen_checks_select" ON "public"."item_allergen_checks" FOR SELECT TO "authenticated"
    USING (("bar_id" IS NULL AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id"))
           OR "bar_id" IN (SELECT "private"."bars_with_capability"('menu')));
CREATE POLICY "item_allergen_checks_write" ON "public"."item_allergen_checks" FOR ALL TO "authenticated"
    USING ("private"."can_declare_allergens"("item_id", "bar_id"))
    WITH CHECK ("private"."can_declare_allergens"("item_id", "bar_id"));

-- Can the caller open this item at all? Mirrors app_item_presentation and the
-- personal-drink and published-drink rules of app_recipe_presentation.
CREATE FUNCTION "private"."can_view_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.items c
    LEFT JOIN public.bars b ON b.id = c.bar_id
    LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
    WHERE c.id = p_item_id
      AND (
        (c.bar_id IS NULL
         AND (c.created_by IS NULL
              OR c.item_type NOT IN ('cocktail', 'beer', 'wine')
              OR c.created_by = auth.uid()
              OR private.is_app_admin()))
        OR (ub.user_id IS NOT NULL
            AND public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level))
        OR EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = c.id)
      )
  );
$$;

-- The allergens in a drink, worked out from its recipe, every sub-recipe
-- under it (four levels), and what's declared on each bought ingredient and
-- on its generic parent: the drink's bar's own declaration where the bar has
-- checked the ingredient, else the catalogue's. Returns
--   { "allergens": [{ "allergen": "eggs", "via": [["Raspberry syrup", "Egg white"]] }],
--     "unchecked": 1, "lines": 5 }
-- or NULL when the caller can't see the drink. `via` holds the ingredient
-- names on the way down, masked exactly as the spec is for this caller: a
-- name the caller can't see is left out, so Floor still learns "contains
-- eggs" without learning the spec.
CREATE FUNCTION "public"."drink_allergens"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH RECURSIVE drink AS (
    SELECT bar_id FROM public.items WHERE id = p_item_id AND private.can_view_item(p_item_id)
  ),
  walk AS (
    SELECT r.id AS row_id, r.ingredient_item_id, r.parent_ingredient_id, 1 AS depth,
           ARRAY[r.recipe_item_id] AS seen,
           ARRAY[di.name] AS via
    FROM drink, public.recipes r
    LEFT JOIN public.app_recipe_presentation ap ON ap.id = r.id
    LEFT JOIN public.items di ON di.id = ap.display_ingredient_id
    WHERE r.recipe_item_id = p_item_id
    UNION ALL
    SELECT r.id, r.ingredient_item_id, r.parent_ingredient_id, w.depth + 1,
           w.seen || r.recipe_item_id,
           w.via || di.name
    FROM walk w
    JOIN public.recipes r ON r.recipe_item_id IN (w.ingredient_item_id, w.parent_ingredient_id)
    LEFT JOIN public.app_recipe_presentation ap ON ap.id = r.id
    LEFT JOIN public.items di ON di.id = ap.display_ingredient_id
    WHERE w.depth < 4 AND NOT (r.recipe_item_id = ANY (w.seen))
  ),
  -- Each ingredient a line points at (the brand and its generic parent), with
  -- which declaration applies: the bar's own if it has checked it, else the
  -- catalogue's.
  parts AS (
    SELECT w.row_id, w.via, p.item_id,
           (SELECT c.bar_id FROM public.item_allergen_checks c, drink d
            WHERE c.item_id = p.item_id AND (c.bar_id = d.bar_id OR c.bar_id IS NULL)
            ORDER BY c.bar_id NULLS LAST LIMIT 1) AS scope,
           EXISTS (SELECT 1 FROM public.item_allergen_checks c, drink d
                   WHERE c.item_id = p.item_id AND (c.bar_id = d.bar_id OR c.bar_id IS NULL)) AS checked
    FROM walk w
    CROSS JOIN LATERAL (VALUES (w.ingredient_item_id), (w.parent_ingredient_id)) AS p(item_id)
    WHERE p.item_id IS NOT NULL
  ),
  leaves AS (
    -- A line whose ingredient has no recipe of its own is something the bar buys.
    SELECT w.row_id, bool_or(p.checked) AS checked
    FROM walk w JOIN parts p ON p.row_id = w.row_id
    WHERE NOT EXISTS (SELECT 1 FROM public.recipes s WHERE s.recipe_item_id IN (w.ingredient_item_id, w.parent_ingredient_id))
    GROUP BY w.row_id
  ),
  found AS (
    SELECT DISTINCT ia.allergen, array_remove(p.via, NULL) AS via
    FROM parts p
    JOIN public.item_allergens ia ON ia.item_id = p.item_id AND ia.bar_id IS NOT DISTINCT FROM p.scope
  ),
  grouped AS (
    SELECT allergen, jsonb_agg(to_jsonb(via) ORDER BY via) AS via
    FROM found
    GROUP BY allergen
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM drink) THEN jsonb_build_object(
    'allergens', COALESCE((SELECT jsonb_agg(jsonb_build_object('allergen', allergen, 'via', via) ORDER BY allergen) FROM grouped), '[]'::jsonb),
    'unchecked', (SELECT count(*) FROM leaves WHERE NOT checked),
    'lines', (SELECT count(*) FROM walk WHERE depth = 1)
  ) END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_declare_allergens"("p_item_id" "uuid", "p_bar_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_declare_allergens"("p_item_id" "uuid", "p_bar_id" "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."can_view_item"("p_item_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_view_item"("p_item_id" "uuid") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."drink_allergens"("p_item_id" "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."drink_allergens"("p_item_id" "uuid") TO "authenticated", "service_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."item_allergens" TO "authenticated";
GRANT ALL ON TABLE "public"."item_allergens" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."item_allergen_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."item_allergen_checks" TO "service_role";
