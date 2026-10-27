-- Saving a house-made ingredient's or a venue ice's prep card in one
-- transaction. The app upserted item_prep, deleted every item_steps row and
-- then inserted the new steps as three requests, so a failure after the
-- delete (a dropped connection, a step the checks refuse, the app killed)
-- left the prep with no method. An ice's "starts from" line was a fourth and
-- fifth request (delete the recipe line, insert the new one).
--
-- save_prep_spec does it all in one statement: the card, the steps and,
-- when p_lines is given, the recipe lines through replace_recipe_lines. It
-- all lands or none of it does.
--
-- It runs as the caller (SECURITY INVOKER), so the item_prep, item_steps and
-- recipes policies decide exactly as they do for direct writes: can_edit_item
-- (and house_made at a venue), or Prep at the venue. The check up front only
-- turns a refusal into a plain message; it allows nothing the policies don't.
--
-- p_prep: { yield_amount, yield_unit, shelf_life_hours, lead_time_minutes,
--           lead_time_note, storage, actions }
-- p_steps: [{ body, timer_seconds, equipment }]; blank bodies are skipped and
--          the rest numbered from 0 in order.
-- p_lines: null leaves the recipe lines alone; a list replaces them (see
--          replace_recipe_lines).

CREATE FUNCTION "public"."save_prep_spec"("p_item" "uuid", "p_prep" "jsonb", "p_steps" "jsonb", "p_lines" "jsonb" DEFAULT NULL) RETURNS void
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_step jsonb;
    v_index integer := 0;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.items i
         WHERE i.id = p_item
           AND (i.bar_id IN (SELECT private.bars_with_capability('prep'::public.venue_capability))
                OR (private.can_edit_item(i.id)
                    AND (i.bar_id IS NULL OR i.bar_id IN (SELECT private.bars_with_capability('house_made'::public.venue_capability)))))
    ) THEN
        RAISE EXCEPTION 'You can''t edit this prep.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_prep) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'The prep card must be an object.'; END IF;
    IF jsonb_typeof(p_steps) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Steps must be a list.'; END IF;

    INSERT INTO public.item_prep (item_id, yield_amount, yield_unit, shelf_life_hours, lead_time_minutes, lead_time_note, storage, actions, updated_by, updated_at)
    VALUES (
        p_item,
        NULLIF(p_prep ->> 'yield_amount', '')::numeric,
        NULLIF(p_prep ->> 'yield_unit', ''),
        NULLIF(p_prep ->> 'shelf_life_hours', '')::integer,
        NULLIF(p_prep ->> 'lead_time_minutes', '')::integer,
        NULLIF(p_prep ->> 'lead_time_note', ''),
        NULLIF(p_prep ->> 'storage', ''),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_prep -> 'actions')), '{}'),
        auth.uid(),
        now()
    )
    ON CONFLICT (item_id) DO UPDATE SET
        yield_amount = EXCLUDED.yield_amount,
        yield_unit = EXCLUDED.yield_unit,
        shelf_life_hours = EXCLUDED.shelf_life_hours,
        lead_time_minutes = EXCLUDED.lead_time_minutes,
        lead_time_note = EXCLUDED.lead_time_note,
        storage = EXCLUDED.storage,
        actions = EXCLUDED.actions,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

    DELETE FROM public.item_steps WHERE item_id = p_item;
    FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
        CONTINUE WHEN btrim(COALESCE(v_step ->> 'body', '')) = '';
        INSERT INTO public.item_steps (item_id, position, body, timer_seconds, equipment)
        VALUES (
            p_item,
            v_index,
            btrim(v_step ->> 'body'),
            NULLIF(v_step ->> 'timer_seconds', '')::integer,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_step -> 'equipment')), '{}')
        );
        v_index := v_index + 1;
    END LOOP;

    IF p_lines IS NOT NULL THEN
        PERFORM public.replace_recipe_lines(p_item, p_lines);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_prep_spec"("uuid", "jsonb", "jsonb", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_prep_spec"("uuid", "jsonb", "jsonb", "jsonb") TO "authenticated", "service_role";
