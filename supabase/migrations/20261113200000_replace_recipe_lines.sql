-- Replacing an item's recipe lines in one transaction. The ingredient editor
-- deleted every line and then inserted the new ones as two requests, so a
-- failed insert (a dropped connection, an RLS refusal, the app killed between
-- the two) left a house prep with no recipe. replace_recipe_lines does the
-- whole swap in one statement: it all lands or none of it does.
--
-- It runs as the caller (SECURITY INVOKER), so the recipes policies decide
-- exactly as they do for direct writes today: can_edit_item, or Prep at the
-- venue for its own ice (20261110100000). The check up front only turns a
-- refusal into a plain message; it allows nothing the policies don't.
--
-- Lines keep their rows by id, as save_drink_spec does, so what hangs off a
-- line (at_service, the service spec's decision) survives a save. A line
-- that changes ingredient drops its generic and service decision, as a new
-- row would. A line with no id, or an id from another item, is a new row;
-- rows not named are removed. A cocktail is refused: drinks save through
-- save_drink_spec, which also writes the version.

CREATE FUNCTION "public"."replace_recipe_lines"("p_item" "uuid", "p_lines" "jsonb") RETURNS void
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line jsonb;
    v_index integer := 0;
    v_kept uuid[] := '{}';
    v_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT (private.can_edit_item(p_item) OR private.can_edit_venue_ice(p_item)) THEN
        RAISE EXCEPTION 'You can''t edit this recipe.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.items WHERE id = p_item AND item_type = 'cocktail') THEN
        RAISE EXCEPTION 'A drink''s spec saves through save_drink_spec.';
    END IF;
    IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;

    -- Positions are unique per item, so move the old rows out of the way first.
    UPDATE public.recipes SET sort_order = sort_order + 100000 WHERE recipe_item_id = p_item;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        IF NULLIF(v_line ->> 'ingredient_item_id', '') IS NULL THEN
            RAISE EXCEPTION 'Every line needs an ingredient.';
        END IF;
        v_id := CASE WHEN v_line ->> 'id' ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' THEN (v_line ->> 'id')::uuid END;
        IF v_id IS NOT NULL AND NOT (v_id = ANY (v_kept)) AND EXISTS (SELECT 1 FROM public.recipes WHERE id = v_id AND recipe_item_id = p_item) THEN
            UPDATE public.recipes
               SET parent_ingredient_id = CASE WHEN ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid THEN parent_ingredient_id END,
                   at_service = CASE WHEN ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid THEN at_service END,
                   ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid,
                   amount = NULLIF(v_line ->> 'amount', '')::numeric,
                   unit = NULLIF(v_line ->> 'unit', ''),
                   preparation_notes = NULLIF(v_line ->> 'preparation_notes', ''),
                   is_optional = COALESCE((v_line ->> 'is_optional')::boolean, false),
                   sort_order = v_index
             WHERE id = v_id;
        ELSE
            INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order)
            VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                    NULLIF(v_line ->> 'preparation_notes', ''), COALESCE((v_line ->> 'is_optional')::boolean, false), v_index)
            RETURNING id INTO v_id;
        END IF;
        v_kept := v_kept || v_id;
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item AND NOT (id = ANY (v_kept));
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."replace_recipe_lines"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."replace_recipe_lines"("uuid", "jsonb") TO "authenticated", "service_role";
