-- DRAFT. Local stack only until Kevin's OK.
--
-- Drink maths on the server: a drink's strength, worked out from its spec
-- whenever the spec, an ingredient's ABV or density, its method, its own
-- dilution or the venue's dilution defaults change, and stored on the item
-- so roles that can't see the amounts still see how strong the drink is.
--
--   items.density_g_ml    per ingredient; NULL means "guess from the name and
--                         ABV", the same guess as lib/drinkMath.ts.
--   items.dilution_pct    per drink: a measured dilution that overrides the
--                         method's default.
--   items.serve_ml        the serve after dilution, calculated.
--   items.serve_abv       ABV in the glass, calculated.
--   items.abv_source      'manual' keeps a typed ABV; 'calculated' means the
--                         spec sets items.abv (and does so once abv is NULL).
--   bars.dilution_defaults  {"stirred": 20, "shaken": 25, "built": 10}, the
--                         house dilution by method. Missing keys use these.
--
-- The rules mirror lib/drinkMath.ts line for line; drinkMath.check.ts and
-- supabase/tests/drink-math.test.mjs pin both to the same worked example.

ALTER TABLE "public"."items"
    ADD COLUMN "density_g_ml" numeric CHECK ("density_g_ml" IS NULL OR ("density_g_ml" > 0.3 AND "density_g_ml" < 3)),
    ADD COLUMN "dilution_pct" numeric CHECK ("dilution_pct" IS NULL OR ("dilution_pct" >= 0 AND "dilution_pct" <= 100)),
    ADD COLUMN "serve_ml" numeric,
    ADD COLUMN "serve_abv" numeric,
    ADD COLUMN "abv_source" "text" DEFAULT 'manual' NOT NULL CHECK ("abv_source" IN ('manual', 'calculated'));

ALTER TABLE "public"."bars" ADD COLUMN "dilution_defaults" "jsonb";

-- Grams per ml for an ingredient: its own density, else a guess from the
-- name (syrups, honey, juice) and the ABV (a 40% spirit is about 0.95).
CREATE FUNCTION "private"."density_g_ml"("p_name" "text", "p_abv" numeric, "p_density" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_density IS NOT NULL THEN p_density
    WHEN p_name ~* 'honey' THEN 1.42
    WHEN p_name ~* 'syrup|cordial|agave|oleo|sherbet|grenadine|orgeat' THEN 1.23
    WHEN p_name ~* 'juice' THEN 1.04
    WHEN p_abv IS NULL OR p_abv <= 0 THEN 1.0
    WHEN p_abv <= 40 THEN 1 - 0.0013 * p_abv
    ELSE 0.948 - 0.0025 * (p_abv - 40)
  END;
$$;

-- A spec line in ml: bar volumes straight, weights through the density,
-- counts (twists, dashes are volumes) NULL.
CREATE FUNCTION "private"."line_ml"("p_amount" numeric, "p_unit" "text", "p_density" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE lower(trim(coalesce(p_unit, '')))
    WHEN 'ml' THEN p_amount
    WHEN 'cl' THEN p_amount * 10
    WHEN 'dl' THEN p_amount * 100
    WHEN 'l' THEN p_amount * 1000
    WHEN 'oz' THEN p_amount * 29.57
    WHEN 'fl oz' THEN p_amount * 29.57
    WHEN 'dash' THEN p_amount * 0.8
    WHEN 'dashes' THEN p_amount * 0.8
    WHEN 'drop' THEN p_amount * 0.05
    WHEN 'drops' THEN p_amount * 0.05
    WHEN 'bsp' THEN p_amount * 5
    WHEN 'barspoon' THEN p_amount * 5
    WHEN 'tsp' THEN p_amount * 5
    WHEN 'tbsp' THEN p_amount * 15
    WHEN 'g' THEN p_amount / p_density
    WHEN 'kg' THEN p_amount * 1000 / p_density
    ELSE NULL
  END;
$$;

-- How the drink is made, from its method names, as lib/batch.ts reads them.
CREATE FUNCTION "private"."drink_method"("p_item" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH names AS (
    SELECT lower(string_agg(m.name, ' ')) AS all_names
    FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
    WHERE im.item_id = p_item
  )
  SELECT CASE
    WHEN all_names ~ 'shak' THEN 'shaken'
    WHEN all_names ~ 'stir' THEN 'stirred'
    WHEN all_names ~ 'buil' THEN 'built'
    ELSE 'unknown'
  END FROM names;
$$;

-- The dilution to use: the drink's measured figure, else 0 when water is
-- already in the spec (a freezer martini), else the venue's default for the
-- method, else the house rule (stirred 20, shaken 25, built 10).
CREATE FUNCTION "private"."drink_dilution_pct"("p_item" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH d AS (
    SELECT i.dilution_pct, b.dilution_defaults, private.drink_method(i.id) AS method,
           EXISTS (
             SELECT 1 FROM public.recipes r JOIN public.items w ON w.id = r.ingredient_item_id
             WHERE r.recipe_item_id = i.id AND r.at_service IS NOT TRUE
               AND w.name ~* '^(filtered |still |chilled |cold |mineral |spring |tap )?water$'
           ) AS pre_diluted
    FROM public.items i LEFT JOIN public.bars b ON b.id = i.bar_id
    WHERE i.id = p_item
  )
  SELECT CASE
    WHEN dilution_pct IS NOT NULL THEN dilution_pct
    WHEN pre_diluted THEN 0
    ELSE COALESCE(
      (dilution_defaults ->> method)::numeric,
      CASE method WHEN 'stirred' THEN 20 WHEN 'shaken' THEN 25 WHEN 'built' THEN 10 ELSE 0 END)
  END FROM d;
$$;

-- Work the strength out and store it. Runs as its owner so it reads every
-- line and ingredient the spec has, whoever triggered it. Only items with a
-- spec change; a typed ABV stays unless it was calculated or empty.
CREATE FUNCTION "private"."refresh_drink_strength"("p_item" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_total numeric;
    v_ethanol numeric;
    v_dilution numeric;
    v_serve numeric;
    v_abv numeric;
BEGIN
    IF pg_trigger_depth() > 4 THEN RETURN; END IF;
    SELECT sum(l.ml), sum(l.ml * coalesce(i.abv, 0) / 100)
      INTO v_total, v_ethanol
      FROM public.recipes r
      JOIN public.items i ON i.id = r.ingredient_item_id
      CROSS JOIN LATERAL (SELECT private.line_ml(r.amount, r.unit, private.density_g_ml(i.name, i.abv, i.density_g_ml)) AS ml) l
      WHERE r.recipe_item_id = p_item AND r.amount IS NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE recipe_item_id = p_item) THEN RETURN; END IF;
    IF v_total IS NULL OR v_total <= 0 THEN
        UPDATE public.items SET serve_ml = NULL, serve_abv = NULL,
            abv = CASE WHEN abv_source = 'calculated' THEN NULL ELSE abv END
          WHERE id = p_item AND item_type IN ('cocktail', 'ingredient');
        RETURN;
    END IF;
    v_dilution := private.drink_dilution_pct(p_item);
    v_serve := v_total * (1 + v_dilution / 100);
    v_abv := round(v_ethanol / v_total * 100, 1);
    UPDATE public.items
       SET serve_ml = round(v_serve, 1),
           serve_abv = round(v_ethanol / v_serve * 100, 1),
           abv = CASE WHEN abv_source = 'calculated' OR abv IS NULL THEN v_abv ELSE abv END,
           abv_source = CASE WHEN abv_source = 'calculated' OR abv IS NULL THEN 'calculated' ELSE abv_source END
     WHERE id = p_item AND item_type IN ('cocktail', 'ingredient');
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."density_g_ml"("text", numeric, numeric) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."line_ml"(numeric, "text", numeric) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."drink_method"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."drink_dilution_pct"("uuid") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."refresh_drink_strength"("uuid") FROM PUBLIC, "anon", "authenticated";

-- A spec line changed.
CREATE FUNCTION "private"."recipes_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.refresh_drink_strength(COALESCE(NEW.recipe_item_id, OLD.recipe_item_id));
    RETURN NULL;
END;
$$;
CREATE TRIGGER "recipes_refresh_strength" AFTER INSERT OR UPDATE OR DELETE ON "public"."recipes"
    FOR EACH ROW EXECUTE FUNCTION "private"."recipes_refresh_strength"();

-- An ingredient's ABV or density changed (every drink that uses it), or a
-- drink's own dilution did.
CREATE FUNCTION "private"."items_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
BEGIN
    IF NEW.dilution_pct IS DISTINCT FROM OLD.dilution_pct THEN
        PERFORM private.refresh_drink_strength(NEW.id);
    END IF;
    IF NEW.abv IS DISTINCT FROM OLD.abv OR NEW.density_g_ml IS DISTINCT FROM OLD.density_g_ml THEN
        FOR v_id IN SELECT DISTINCT recipe_item_id FROM public.recipes WHERE ingredient_item_id = NEW.id LOOP
            PERFORM private.refresh_drink_strength(v_id);
        END LOOP;
    END IF;
    RETURN NULL;
END;
$$;
CREATE TRIGGER "items_refresh_strength" AFTER UPDATE OF "abv", "density_g_ml", "dilution_pct" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."items_refresh_strength"();

-- The method changed.
CREATE FUNCTION "private"."item_methods_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.refresh_drink_strength(COALESCE(NEW.item_id, OLD.item_id));
    RETURN NULL;
END;
$$;
CREATE TRIGGER "item_methods_refresh_strength" AFTER INSERT OR UPDATE OR DELETE ON "public"."item_methods"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_methods_refresh_strength"();

-- The house dilution changed: every drink at the venue.
CREATE FUNCTION "private"."bars_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
BEGIN
    FOR v_id IN SELECT id FROM public.items WHERE bar_id = NEW.id AND item_type = 'cocktail' LOOP
        PERFORM private.refresh_drink_strength(v_id);
    END LOOP;
    RETURN NULL;
END;
$$;
CREATE TRIGGER "bars_refresh_strength" AFTER UPDATE OF "dilution_defaults" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."bars_refresh_strength"();

-- Same columns as 20261001120000, plus the strength columns at the end.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
    c.origin,
    c.price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.service_style,
    c.density_g_ml,
    c.dilution_pct,
    c.serve_ml,
    c.serve_abv,
    c.abv_source
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);

-- Every drink and house-made ingredient that has a spec gets its strength now.
DO $$
DECLARE
    v_id uuid;
BEGIN
    FOR v_id IN SELECT DISTINCT recipe_item_id FROM public.recipes WHERE recipe_item_id IS NOT NULL LOOP
        PERFORM private.refresh_drink_strength(v_id);
    END LOOP;
END;
$$;
