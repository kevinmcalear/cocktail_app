-- DRAFT. Local stack only until Kevin's OK.
--
-- Cost per serve: what a drink costs to make at a bar, worked out from its
-- spec through every house-made sub-recipe, from the pack prices the bar has
-- entered (item_costs, item_purchasing) and each prep's yield (item_prep).
--
--   drink_cost(item, bar)  → {"liquid_minor": 190, "garnish_minor": 8,
--                             "ice_minor": 3, "total_minor": 201, "missing": 1,
--                             "lines": [{"ingredient": "White rum", "minor": 165,
--                                        "kind": "ml", "garnish": false}, ...]}
--                          or NULL for a caller without the costs capability.
--
-- Runs as the caller (security invoker), so item_costs' own policy decides
-- who gets numbers; the capability check up front just saves the walk. The
-- spec is read through app_recipe_presentation, masked for the caller like
-- everything else. A line with no price counts as missing, never as free.
-- Ethyl shows GP to anyone with the link; this never leaves the costs
-- capability, and nothing here goes in a view Floor can read.

-- Which kind of quantity a unit measures: a volume, a weight, or a count.
CREATE FUNCTION "private"."qty_kind"("p_unit" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_unit, ''))) IN ('ml','cl','dl','l','oz','fl oz','dash','dashes','drop','drops','bsp','barspoon','tsp','tbsp') THEN 'ml'
    WHEN lower(trim(coalesce(p_unit, ''))) IN ('g','kg') THEN 'g'
    ELSE 'each'
  END;
$$;

-- An amount in its kind's base unit: ml, g, or a count.
CREATE FUNCTION "private"."qty_base"("p_amount" numeric, "p_unit" "text") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE private.qty_kind(p_unit)
    WHEN 'ml' THEN private.line_ml(p_amount, p_unit, 1)
    WHEN 'g' THEN CASE lower(trim(p_unit)) WHEN 'kg' THEN p_amount * 1000 ELSE p_amount END
    ELSE p_amount
  END;
$$;

-- A quantity of an item read in another kind: ml to g and back through the
-- item's density; counts never convert.
CREATE FUNCTION "private"."qty_convert"("p_qty" numeric, "p_from" "text", "p_to" "text", "p_density" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_from = p_to THEN p_qty
    WHEN p_from = 'ml' AND p_to = 'g' THEN p_qty * p_density
    WHEN p_from = 'g' AND p_to = 'ml' THEN p_qty / p_density
    ELSE NULL
  END;
$$;

-- What one base unit (ml, g or each) of an item costs this bar, in minor
-- units: from its pack price, or from its own recipe and yield when it's
-- house-made. NULL when anything on the way has no price.
CREATE FUNCTION "private"."item_cost_per"("p_item" "uuid", "p_bar" "uuid", "p_kind" "text", "p_depth" integer) RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_density numeric;
    v_pack_cost numeric;
    v_pack_qty numeric;
    v_pack_kind text;
    v_batch_cost numeric := 0;
    v_line record;
    v_line_cost numeric;
    v_yield_qty numeric;
    v_yield_kind text;
    v_volume numeric := 0;
    v_has_lines boolean := false;
BEGIN
    SELECT private.density_g_ml(i.name, i.abv, i.density_g_ml) INTO v_density FROM public.items i WHERE i.id = p_item;
    IF v_density IS NULL THEN RETURN NULL; END IF;

    -- Bought: the pack price over the pack size.
    SELECT c.pack_cost_minor, private.qty_base(p.pack_size_amount, p.pack_size_unit), private.qty_kind(p.pack_size_unit)
      INTO v_pack_cost, v_pack_qty, v_pack_kind
      FROM public.item_costs c
      JOIN public.item_purchasing p ON p.bar_id = c.bar_id AND p.item_id = c.item_id
     WHERE c.bar_id = p_bar AND c.item_id = p_item;
    IF v_pack_cost IS NOT NULL THEN
        IF v_pack_qty IS NULL OR v_pack_qty <= 0 THEN RETURN NULL; END IF;
        v_pack_qty := private.qty_convert(v_pack_qty, v_pack_kind, p_kind, v_density);
        IF v_pack_qty IS NULL OR v_pack_qty <= 0 THEN RETURN NULL; END IF;
        RETURN v_pack_cost / v_pack_qty;
    END IF;

    -- House-made: one batch's lines, over its yield.
    IF p_depth >= 4 THEN RETURN NULL; END IF;
    FOR v_line IN
        SELECT r.display_ingredient_id AS item_id, r.amount, r.unit
          FROM public.app_recipe_presentation r
         WHERE r.recipe_item_id = p_item
    LOOP
        v_has_lines := true;
        IF v_line.item_id IS NULL OR v_line.amount IS NULL THEN RETURN NULL; END IF;
        v_line_cost := private.item_cost_per(v_line.item_id, p_bar, private.qty_kind(v_line.unit), p_depth + 1);
        IF v_line_cost IS NULL THEN RETURN NULL; END IF;
        v_batch_cost := v_batch_cost + v_line_cost * private.qty_base(v_line.amount, v_line.unit);
        IF private.qty_kind(v_line.unit) = 'ml' THEN v_volume := v_volume + private.qty_base(v_line.amount, v_line.unit); END IF;
    END LOOP;
    IF NOT v_has_lines THEN RETURN NULL; END IF;

    SELECT private.qty_base(ip.yield_amount, ip.yield_unit), private.qty_kind(ip.yield_unit)
      INTO v_yield_qty, v_yield_kind
      FROM public.item_prep ip WHERE ip.item_id = p_item AND ip.yield_amount IS NOT NULL;
    IF v_yield_qty IS NULL THEN
        -- No yield on the card: what went in is what comes out.
        v_yield_qty := v_volume;
        v_yield_kind := 'ml';
    END IF;
    v_yield_qty := private.qty_convert(v_yield_qty, v_yield_kind, p_kind, v_density);
    IF v_yield_qty IS NULL OR v_yield_qty <= 0 THEN RETURN NULL; END IF;
    RETURN v_batch_cost / v_yield_qty;
END;
$$;

CREATE FUNCTION "public"."drink_cost"("p_item" "uuid", "p_bar" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line record;
    v_per numeric;
    v_minor numeric;
    v_liquid numeric := 0;
    v_garnish numeric := 0;
    v_ice numeric := 0;
    v_missing integer := 0;
    v_lines jsonb := '[]'::jsonb;
    v_garnish_line boolean;
    v_ice_id uuid;
    v_ice_g numeric;
BEGIN
    IF auth.uid() IS NULL OR NOT ('costs' = ANY (private.capabilities(p_bar))) THEN RETURN NULL; END IF;

    FOR v_line IN
        SELECT r.display_ingredient_id AS item_id, i.name, r.amount, r.unit
          FROM public.app_recipe_presentation r
          LEFT JOIN public.app_item_presentation i ON i.id = r.display_ingredient_id
         WHERE r.recipe_item_id = p_item
         ORDER BY r.sort_order, r.created_at
    LOOP
        v_garnish_line := lower(trim(coalesce(v_line.unit, ''))) IN ('each','pinch','sprig','leaf','peel','twist','wheel','slice','cube','wedge');
        v_per := CASE WHEN v_line.item_id IS NULL OR v_line.amount IS NULL THEN NULL
                      ELSE private.item_cost_per(v_line.item_id, p_bar, private.qty_kind(v_line.unit), 1) END;
        v_minor := CASE WHEN v_per IS NULL THEN NULL ELSE round(v_per * private.qty_base(v_line.amount, v_line.unit)) END;
        IF v_minor IS NULL THEN v_missing := v_missing + 1;
        ELSIF v_garnish_line THEN v_garnish := v_garnish + v_minor;
        ELSE v_liquid := v_liquid + v_minor;
        END IF;
        v_lines := v_lines || jsonb_build_object(
            'ingredient', coalesce(v_line.name, 'Hidden ingredient'),
            'minor', v_minor,
            'kind', private.qty_kind(v_line.unit),
            'garnish', v_garnish_line);
    END LOOP;

    -- Ice: the ice type's price per gram times the grams in the glass.
    SELECT i.ice_id, i.ice_per_serve_g INTO v_ice_id, v_ice_g FROM public.items i WHERE i.id = p_item;
    IF v_ice_id IS NOT NULL AND v_ice_g IS NOT NULL AND v_ice_g > 0 THEN
        v_per := private.item_cost_per(v_ice_id, p_bar, 'g', 1);
        IF v_per IS NOT NULL THEN v_ice := round(v_per * v_ice_g); END IF;
    END IF;

    RETURN jsonb_build_object(
        'liquid_minor', v_liquid::integer,
        'garnish_minor', v_garnish::integer,
        'ice_minor', v_ice::integer,
        'total_minor', (v_liquid + v_garnish + v_ice)::integer,
        'missing', v_missing,
        'lines', v_lines);
END;
$$;

-- The cost walk runs as the caller, so the strength helpers it borrows
-- (20261001130000) need to be callable by signed-in members.
GRANT EXECUTE ON FUNCTION "private"."density_g_ml"("text", numeric, numeric) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."line_ml"(numeric, "text", numeric) TO "authenticated", "service_role";

REVOKE EXECUTE ON FUNCTION "private"."qty_kind"("text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."qty_base"(numeric, "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."qty_convert"(numeric, "text", "text", numeric) FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."item_cost_per"("uuid", "uuid", "text", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."qty_kind"("text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."qty_base"(numeric, "text") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."qty_convert"(numeric, "text", "text", numeric) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."item_cost_per"("uuid", "uuid", "text", integer) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "public"."drink_cost"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."drink_cost"("uuid", "uuid") TO "authenticated", "service_role";
