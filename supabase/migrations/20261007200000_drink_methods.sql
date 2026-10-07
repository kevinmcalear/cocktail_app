-- A drink can have several methods (stirred, then a freezer pour).
-- item_methods always allowed it; save_drink_spec took one. It now takes a
-- list, in order. The one-method signature stays for apps that haven't
-- picked up the new JS yet, and calls the list version.

CREATE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_ids" "uuid"[], "p_note" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line jsonb;
    v_index integer := 0;
    v_kept uuid[] := '{}';
    v_id uuid;
    v_had_versions boolean;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;

    -- The first save through here records how the drink was before it.
    SELECT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_item) INTO v_had_versions;
    IF NOT v_had_versions THEN
        PERFORM private.write_drink_version(p_item, 'As it was before versions were kept');
    END IF;

    -- Positions are unique per drink, so move the old rows out of the way first.
    UPDATE public.recipes SET sort_order = sort_order + 100000 WHERE recipe_item_id = p_item;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_id := NULLIF(v_line ->> 'id', '')::uuid;
        IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.recipes WHERE id = v_id AND recipe_item_id = p_item) THEN
            UPDATE public.recipes
               SET ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid,
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

    -- Methods in the order given. Unknown ids and repeats are skipped.
    DELETE FROM public.item_methods WHERE item_id = p_item;
    INSERT INTO public.item_methods (item_id, method_item_id, sort_order)
    SELECT p_item, m.id, (min(u.ord) - 1)::integer
      FROM unnest(COALESCE(p_method_ids, '{}')) WITH ORDINALITY AS u(id, ord)
      JOIN public.items m ON m.id = u.id AND m.item_type = 'method'
     GROUP BY m.id;

    RETURN private.write_drink_version(p_item, p_note);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_id" "uuid", "p_note" "text") RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  SELECT public.save_drink_spec(p_item, p_lines, CASE WHEN p_method_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[p_method_id] END, p_note);
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid"[], "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid"[], "text") TO "authenticated", "service_role";
