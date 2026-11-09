-- A house-made made in parts, saved all at once (board Add-parts: "If one
-- can't save, none do"). Penicillin batch uses Honey-ginger syrup, which uses
-- Fresh ginger juice: three new house-mades, each its own row with its own
-- page and Used in. The app wrote them row by row and deleted what it had
-- made when something failed, and a part that failed was only warned about,
-- so a dropped connection could leave half a recipe behind.
--
-- save_house_mades writes every one in a single statement: the rows, their
-- lines (a new name on a line becomes an ingredient, as the app's own
-- resolver does), their prep cards and steps (through save_prep_spec), what
-- each is made from, and allergens set by hand. It all lands or none of it
-- does.
--
--   * Adds one function, save_house_mades(uuid, jsonb). Nothing is changed or
--     removed.
--
-- It runs as the caller (SECURITY INVOKER), so the items, recipes, item_prep,
-- item_steps and allergen policies decide exactly as they do for the app's
-- direct writes. It allows nothing they don't.
--
-- A name is never quietly changed (board Add-house, Name taken). At a venue a
-- name the venue already has is refused, and a shared ingredient's name makes
-- the venue's own version of it, linked to it. At home a taken name is
-- refused.
--
-- p_bar: the venue, or null at home.
-- p_preps: [{ name, lines, card, steps, made_from, base, allergens }], the
--   house-made itself first, then its parts. Each line is
--   { part } (the index of another entry in p_preps), { id } (an ingredient),
--   or { name, bottle } (found by name, else added; bottle: something you buy),
--   with amount, unit and note. card is save_prep_spec's p_prep, steps its
--   p_steps. base is the index of the line it's made from when that line is a
--   bottle (a fat wash of one); made_from names it outright. allergens: a list
--   when set by hand, else null.
-- Returns the new ids, in the order of p_preps.

CREATE FUNCTION "public"."save_house_mades"("p_bar" "uuid", "p_preps" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_uuid constant text := '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';
    v_prep jsonb;
    v_line jsonb;
    v_ids uuid[] := '{}';
    v_id uuid;
    v_line_id uuid;
    v_name text;
    v_hint text;
    v_lines jsonb;
    v_base uuid;
    v_index integer;
    v_at integer;
    v_allergen text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to save it.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_preps) IS DISTINCT FROM 'array' OR jsonb_array_length(p_preps) = 0 THEN
        RAISE EXCEPTION 'Nothing to save.';
    END IF;
    IF jsonb_array_length(p_preps) > 20 THEN
        RAISE EXCEPTION 'That''s too many parts to save at once.';
    END IF;

    -- Every row first, so a line can point at a part listed after it.
    FOR v_prep IN SELECT * FROM jsonb_array_elements(p_preps) LOOP
        v_name := btrim(COALESCE(v_prep ->> 'name', ''));
        IF v_name = '' THEN RAISE EXCEPTION 'Every house-made needs a name.'; END IF;
        IF p_bar IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.items i
             WHERE i.item_type = 'ingredient' AND i.bar_id = p_bar
               AND public.ingredient_key(i.name) = public.ingredient_key(v_name)
        ) THEN
            RAISE EXCEPTION '% is already here. Use yours, or name this one so they''re told apart.', v_name;
        END IF;
        BEGIN
            INSERT INTO public.items (name, item_type, bar_id, ingredient_role)
            VALUES (v_name, 'ingredient', p_bar, 'prep')
            RETURNING id INTO v_id;
        EXCEPTION WHEN raise_exception THEN
            -- The one-of-each guard names the shared one in its hint; anything else goes on up as it was.
            GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
            IF v_hint IS NULL OR v_hint !~* v_uuid THEN RAISE; END IF;
            IF p_bar IS NULL THEN
                RAISE EXCEPTION '% is already an ingredient. Name this one so they''re told apart.', v_name;
            END IF;
            INSERT INTO public.items (name, item_type, bar_id, ingredient_role, generic_id)
            VALUES (v_name, 'ingredient', p_bar, 'prep', v_hint::uuid)
            RETURNING id INTO v_id;
        END;
        v_ids := v_ids || v_id;
    END LOOP;

    v_index := 0;
    FOR v_prep IN SELECT * FROM jsonb_array_elements(p_preps) LOOP
        v_index := v_index + 1;
        v_id := v_ids[v_index];
        v_lines := '[]'::jsonb;
        v_base := NULL;
        v_at := 0;
        FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_prep -> 'lines', '[]'::jsonb)) LOOP
            IF v_line ? 'part' THEN
                v_line_id := v_ids[(v_line ->> 'part')::integer + 1];
                IF v_line_id IS NULL OR v_line_id = v_id THEN RAISE EXCEPTION 'A part points at nothing.'; END IF;
            ELSIF v_line ->> 'id' ~* v_uuid THEN
                v_line_id := (v_line ->> 'id')::uuid;
            ELSE
                v_name := btrim(COALESCE(v_line ->> 'name', ''));
                IF v_name = '' THEN RAISE EXCEPTION 'Every line needs an ingredient.'; END IF;
                -- As the app's resolver: by name or alias, then by the name as written, else a new one here.
                v_line_id := public.resolve_ingredient(v_name);
                IF v_line_id IS NULL THEN
                    SELECT i.id INTO v_line_id FROM public.items i
                     WHERE i.item_type = 'ingredient' AND lower(i.name) = lower(v_name)
                     ORDER BY (i.bar_id IS NOT DISTINCT FROM p_bar) DESC, i.created_at
                     LIMIT 1;
                END IF;
                IF v_line_id IS NULL THEN
                    BEGIN
                        INSERT INTO public.items (name, item_type, bar_id, ingredient_role)
                        VALUES (v_name, 'ingredient', p_bar, CASE WHEN (v_line ->> 'bottle')::boolean THEN 'product' END)
                        RETURNING id INTO v_line_id;
                    EXCEPTION WHEN raise_exception THEN
                        GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
                        IF v_hint IS NULL OR v_hint !~* v_uuid THEN RAISE; END IF;
                        v_line_id := v_hint::uuid;
                    END;
                END IF;
            END IF;
            IF (v_prep ->> 'base')::integer = v_at THEN v_base := v_line_id; END IF;
            v_lines := v_lines || jsonb_build_object(
                'ingredient_item_id', v_line_id,
                'amount', v_line -> 'amount',
                'unit', v_line ->> 'unit',
                'preparation_notes', NULLIF(btrim(COALESCE(v_line ->> 'note', '')), '')
            );
            v_at := v_at + 1;
        END LOOP;

        PERFORM public.save_prep_spec(v_id, COALESCE(v_prep -> 'card', '{}'::jsonb), COALESCE(v_prep -> 'steps', '[]'::jsonb), v_lines);

        -- Made from a bottle: the one picked, else a base line that's a bottle.
        IF v_prep ->> 'made_from' ~* v_uuid THEN
            UPDATE public.items SET made_from_id = (v_prep ->> 'made_from')::uuid WHERE id = v_id;
        ELSIF v_base IS NOT NULL AND v_base <> v_id
              AND EXISTS (SELECT 1 FROM public.items WHERE id = v_base AND ingredient_role = 'product') THEN
            UPDATE public.items SET made_from_id = v_base WHERE id = v_id;
        END IF;

        -- Allergens set by hand are declared, and checked, for where it's made.
        IF jsonb_typeof(v_prep -> 'allergens') = 'array' THEN
            FOR v_allergen IN SELECT DISTINCT jsonb_array_elements_text(v_prep -> 'allergens') LOOP
                INSERT INTO public.item_allergens (item_id, bar_id, allergen) VALUES (v_id, p_bar, v_allergen::public.allergen);
            END LOOP;
            INSERT INTO public.item_allergen_checks (item_id, bar_id) VALUES (v_id, p_bar);
        END IF;
    END LOOP;

    RETURN to_jsonb(v_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_house_mades"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_house_mades"("uuid", "jsonb") TO "authenticated", "service_role";
