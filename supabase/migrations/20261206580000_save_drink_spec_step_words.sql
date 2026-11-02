-- save_drink_spec clears the words of steps a save takes away (Kevin, 1 Nov
-- 2026). A step's aside and note (drink_step_notes, 20261205800000) belong to
-- a step of the drink's Steps view; a save that removes the step (the float's
-- lines go, the drink comes out of parts, the garnish goes) left its words
-- behind, and they came back if the step did. The editor clears what it
-- knows about; this also covers every other save (an older app, a bulk
-- bottle swap).
--
--   * After the lines are written, the steps the drink still has are worked
--     out the way lib/specView.ts specGroups names them: garnish for count
--     units (lib/batch.ts GARNISH_UNITS), and of the rest, one per part
--     (part 1 is main, then part-2 on) when the lines sit in more than one
--     part, else main for the pours and float for the floats. Rows for any
--     other step are deleted.
--   * Everything else as 20261130100000_spec_line_float.sql: security
--     definer, search_path '', the same checks, grants untouched.

CREATE OR REPLACE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_ids" "uuid"[], "p_note" "text", "p_method_parts" smallint[] DEFAULT NULL, "p_parts" "jsonb" DEFAULT NULL) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line jsonb;
    v_index integer := 0;
    v_kept uuid[] := '{}';
    v_id uuid;
    v_part smallint;
    v_had_versions boolean;
    v_old_methods jsonb;
    v_count integer;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;
    IF p_method_parts IS NOT NULL AND cardinality(p_method_parts) <> cardinality(COALESCE(p_method_ids, '{}')) THEN
        RAISE EXCEPTION 'Give each method its part.';
    END IF;

    -- The first save through here records how the drink was before it.
    SELECT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_item) INTO v_had_versions;
    IF NOT v_had_versions THEN
        PERFORM private.write_drink_version(p_item, 'As it was before versions were kept');
    END IF;

    IF p_parts IS NOT NULL THEN
        UPDATE public.items SET parts = CASE WHEN p_parts IN ('[]'::jsonb, 'null'::jsonb) THEN NULL ELSE p_parts END WHERE id = p_item;
    END IF;
    SELECT COALESCE(jsonb_array_length(parts), 1) INTO v_count FROM public.items WHERE id = p_item;

    -- Positions are unique per drink, so move the old rows out of the way first.
    UPDATE public.recipes SET sort_order = sort_order + 100000 WHERE recipe_item_id = p_item;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_id := NULLIF(v_line ->> 'id', '')::uuid;
        IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.recipes WHERE id = v_id AND recipe_item_id = p_item) THEN
            v_id := NULL;
        END IF;
        v_part := COALESCE(NULLIF(v_line ->> 'part', '')::smallint, (SELECT part FROM public.recipes WHERE id = v_id), 1);
        IF v_part > v_count THEN RAISE EXCEPTION 'A line is in part %, and the drink has %.', v_part, v_count; END IF;
        IF v_id IS NOT NULL THEN
            UPDATE public.recipes
               SET ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid,
                   amount = NULLIF(v_line ->> 'amount', '')::numeric,
                   unit = NULLIF(v_line ->> 'unit', ''),
                   preparation_notes = NULLIF(v_line ->> 'preparation_notes', ''),
                   is_optional = COALESCE((v_line ->> 'is_optional')::boolean, false),
                   -- Left out (an older app, a bulk bottle swap), a kept line stays as it was.
                   is_float = COALESCE((v_line ->> 'is_float')::boolean, is_float),
                   part = v_part,
                   sort_order = v_index
             WHERE id = v_id;
        ELSE
            INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, is_float, part, sort_order)
            VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                    NULLIF(v_line ->> 'preparation_notes', ''), COALESCE((v_line ->> 'is_optional')::boolean, false),
                    COALESCE((v_line ->> 'is_float')::boolean, false), v_part, v_index)
            RETURNING id INTO v_id;
        END IF;
        v_kept := v_kept || v_id;
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item AND NOT (id = ANY (v_kept));

    -- The words of steps the drink no longer has (lib/specView.ts specGroups' keys).
    -- ponytail: the garnish units are lib/batch.ts GARNISH_UNITS copied; a unit added there needs adding here.
    WITH lines AS (
        SELECT lower(COALESCE(unit, '')) IN ('each', 'pinch', 'sprig', 'leaf', 'peel', 'twist', 'discard', 'wheel', 'slice', 'cube', 'wedge', 'rim', 'spray', 'rinse', 'float', 'grated') AS garnish,
               COALESCE(part, 1) AS part, is_float
          FROM public.recipes WHERE recipe_item_id = p_item
    ), pours AS (
        SELECT * FROM lines WHERE NOT garnish
    ), steps AS (
        SELECT 'garnish' AS step_key FROM lines WHERE garnish
        UNION
        SELECT CASE WHEN p.part = 1 THEN 'main' ELSE 'part-' || p.part END FROM pours p
         WHERE (SELECT count(DISTINCT part) FROM pours) > 1
        UNION
        SELECT CASE WHEN p.is_float THEN 'float' ELSE 'main' END FROM pours p
         WHERE (SELECT count(DISTINCT part) FROM pours) <= 1
    )
    DELETE FROM public.drink_step_notes n
     WHERE n.item_id = p_item AND n.step_key NOT IN (SELECT step_key FROM steps);

    -- Methods in the order given, each in its part. Without parts, a method
    -- keeps every part it was in (Build in two parts stays in both). Unknown
    -- ids and repeats are skipped.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', method_item_id, 'part', part)), '[]'::jsonb) INTO v_old_methods
      FROM public.item_methods WHERE item_id = p_item;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    INSERT INTO public.item_methods (item_id, method_item_id, part, sort_order)
    SELECT p_item, m.id, u.part, (min(u.ord) - 1)::integer
      FROM (SELECT x.id, x.ord, COALESCE(p_method_parts[x.ord], o.part, 1) AS part
              FROM unnest(COALESCE(p_method_ids, '{}')) WITH ORDINALITY AS x(id, ord)
              LEFT JOIN jsonb_to_recordset(v_old_methods) AS o(id uuid, part smallint) ON p_method_parts IS NULL AND o.id = x.id) u
      JOIN public.items m ON m.id = u.id AND m.item_type = 'method'
     GROUP BY m.id, u.part;
    IF EXISTS (SELECT 1 FROM public.item_methods WHERE item_id = p_item AND part > v_count) THEN
        RAISE EXCEPTION 'A method is in a part the drink doesn''t have.';
    END IF;

    RETURN private.write_drink_version(p_item, p_note);
END;
$$;
