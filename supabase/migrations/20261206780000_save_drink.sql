-- A drink and the house-mades written inside it save in one call, all or
-- none (board Add-inside; Kevin, 12 Nov 2026, item 4a). The app saved the
-- house-mades first (save_house_mades), then the drink, and took the
-- house-mades out again when the drink failed. That left three gaps: an
-- ingredient added for a typed line name ("Rosemary juice") stayed behind
-- when the save failed; a save that went through but whose reply was lost
-- could not be tried again (its names were taken); and allergens the app
-- found in a new ingredient's name were shown but never stored.
--
--   * Adds save_drink(uuid, jsonb): the drink (a new row, or the spec of one
--     that exists), its spec lines, every house-made started inside it with
--     its parts, and every ingredient added for a typed name, in one
--     transaction. Any refusal undoes all of it.
--   * Adds private.drink_saves, where a finished save is remembered by its
--     request key and what it sent, so the same save sent again returns the
--     same rows instead of making them twice. Rows go after 30 days.
--   * Adds private.save_line_ingredient, the line resolver both use.
--   * A new ingredient added for a typed name keeps the allergens the app
--     found in its name (catalogue scope, not marked checked), so the
--     drink's roll-up (private.allergen_rollup) says what the screen said.
--   * save_house_mades is not changed: installed apps still call it.
--
-- save_drink runs as the caller (SECURITY INVOKER): every row goes through
-- the same items, recipes, item_credits, item_images and allergen policies,
-- save_house_mades and save_drink_spec as the app's direct writes, so it
-- allows nothing they don't. Only the remembered saves table is written by a
-- definer helper, and only under the caller's own id.
--
-- p_key: made by the app once per save and kept until it goes through (a
--   new drink: its draft's id; an edit: one per editing session). With what
--   was sent it names the save; the same key with other content is a new save.
-- p_save: {
--   bar: the venue, or null at home,
--   drink: a new drink's items row (id included), or item: an existing drink's id,
--   preps: save_house_mades' p_preps; a line found by name may carry allergens,
--   lines: the spec lines save_drink_spec takes, each with ingredient:
--     { house_made: index into preps } | { id, name } | { name, bottle, allergens }
--     | { name, own: true } (a house prep of its own, its recipe to come),
--   methods, method_parts, parts, note: as save_drink_spec takes them,
--   credits: { creator, names, accept } for a new drink (set_drink_credits;
--     accept says yes to your own credit),
--   images: image ids, in order, for a new drink
-- }
-- Returns { item, version, house_mades: ids in the order of preps,
--   lines: [{ id, new }] in the order of lines }.

CREATE TABLE "private"."drink_saves" (
    "key" "text" PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "result" "jsonb",
    "made_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "drink_saves_user_made_idx" ON "private"."drink_saves" ("user_id", "made_at");
ALTER TABLE "private"."drink_saves" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."drink_saves" FROM PUBLIC, "anon", "authenticated";

-- The save's name: who sent it, its key and what it sent.
CREATE FUNCTION "private"."drink_save_key"("p_key" "uuid", "p_save" "jsonb") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT md5(auth.uid()::text || ':' || p_key::text || ':' || p_save::text);
$$;

-- Null when this save is new (it's held for this transaction, so the same
-- save sent twice at once waits for the first); else what it returned.
CREATE FUNCTION "private"."drink_save_seen"("p_key" "uuid", "p_save" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_key text := private.drink_save_key(p_key, p_save);
BEGIN
    -- ponytail: pruned here, one person's rows at a time; a scheduled sweep if this ever grows.
    DELETE FROM private.drink_saves WHERE user_id = auth.uid() AND made_at < now() - interval '30 days';
    INSERT INTO private.drink_saves (key, user_id) VALUES (v_key, auth.uid()) ON CONFLICT (key) DO NOTHING;
    IF FOUND THEN RETURN NULL; END IF;
    RETURN (SELECT result FROM private.drink_saves WHERE key = v_key AND user_id = auth.uid());
END;
$$;

CREATE FUNCTION "private"."drink_save_done"("p_key" "uuid", "p_save" "jsonb", "p_result" "jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  UPDATE private.drink_saves SET result = p_result
   WHERE key = private.drink_save_key(p_key, p_save) AND user_id = auth.uid();
$$;

-- The row a line saves as: { id, new }. A picked row that's gone since
-- (merged into another) goes by its name. A name is found by name or alias,
-- then as written, else added here, with the allergens found in it. One of
-- its own (own) is always a new house prep: a name that's taken makes the
-- venue's version of it, or "My ..." at home, as the app's own() does.
CREATE FUNCTION "private"."save_line_ingredient"("p_line" "jsonb", "p_bar" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_uuid constant text := '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';
    v_name text := btrim(COALESCE(p_line ->> 'name', ''));
    v_id uuid;
    v_hint text;
    v_allergen text;
BEGIN
    IF p_line ->> 'id' ~* v_uuid AND EXISTS (SELECT 1 FROM public.items WHERE id = (p_line ->> 'id')::uuid) THEN
        RETURN jsonb_build_object('id', p_line ->> 'id', 'new', false);
    END IF;
    IF v_name = '' THEN RAISE EXCEPTION 'Every line needs an ingredient.'; END IF;

    IF (p_line ->> 'own')::boolean THEN
        BEGIN
            INSERT INTO public.items (name, item_type, bar_id, ingredient_role)
            VALUES (v_name, 'ingredient', p_bar, 'prep') RETURNING id INTO v_id;
        EXCEPTION WHEN raise_exception THEN
            GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
            IF v_hint IS NULL OR v_hint !~* v_uuid THEN RAISE; END IF;
            BEGIN
                INSERT INTO public.items (name, item_type, bar_id, ingredient_role, generic_id)
                VALUES (CASE WHEN p_bar IS NULL THEN 'My ' || v_name ELSE v_name END, 'ingredient', p_bar, 'prep', v_hint::uuid)
                RETURNING id INTO v_id;
            EXCEPTION WHEN raise_exception THEN
                -- Your version from before: the drink uses it, and it keeps its recipe.
                GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
                IF v_hint IS NULL OR v_hint !~* v_uuid THEN RAISE; END IF;
                RETURN jsonb_build_object('id', v_hint, 'new', false, 'yours', true);
            END;
        END;
        RETURN jsonb_build_object('id', v_id, 'new', true);
    END IF;

    v_id := public.resolve_ingredient(v_name);
    IF v_id IS NULL THEN
        SELECT i.id INTO v_id FROM public.items i
         WHERE i.item_type = 'ingredient' AND lower(i.name) = lower(v_name)
         ORDER BY (i.bar_id IS NOT DISTINCT FROM p_bar) DESC, i.created_at
         LIMIT 1;
    END IF;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'new', false); END IF;
    BEGIN
        INSERT INTO public.items (name, item_type, bar_id, ingredient_role)
        VALUES (v_name, 'ingredient', p_bar, CASE WHEN (p_line ->> 'bottle')::boolean THEN 'product' END)
        RETURNING id INTO v_id;
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
        IF v_hint IS NULL OR v_hint !~* v_uuid THEN RAISE; END IF;
        RETURN jsonb_build_object('id', v_hint, 'new', false);
    END;
    -- What the app found in its name (prepFacts), for the ingredient itself: not
    -- marked checked, so the roll-up still counts it as a line nobody checked.
    IF jsonb_typeof(p_line -> 'allergens') = 'array' THEN
        FOR v_allergen IN SELECT DISTINCT jsonb_array_elements_text(p_line -> 'allergens') LOOP
            INSERT INTO public.item_allergens (item_id, bar_id, allergen) VALUES (v_id, NULL, v_allergen::public.allergen);
        END LOOP;
    END IF;
    RETURN jsonb_build_object('id', v_id, 'new', true);
END;
$$;

CREATE FUNCTION "public"."save_drink"("p_key" "uuid", "p_save" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid := NULLIF(p_save ->> 'bar', '')::uuid;
    v_result jsonb;
    v_prep jsonb;
    v_line jsonb;
    v_ref jsonb;
    v_got jsonb;
    v_lines jsonb;
    v_preps jsonb := '[]'::jsonb;
    v_house uuid[] := '{}';
    v_spec jsonb := '[]'::jsonb;
    v_out jsonb := '[]'::jsonb;
    v_own jsonb := '{}'::jsonb;
    v_key text;
    v_drink jsonb;
    v_cols text;
    v_item uuid;
    v_credit uuid;
    v_version integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to save it.' USING ERRCODE = '42501';
    END IF;
    IF p_key IS NULL THEN RAISE EXCEPTION 'A save needs its key.'; END IF;
    IF jsonb_typeof(p_save -> 'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;
    IF (p_save ? 'drink') = (p_save ? 'item') THEN RAISE EXCEPTION 'Save a new drink or one that exists.'; END IF;

    -- Sent again after it went through (the reply was lost): the same rows.
    v_result := private.drink_save_seen(p_key, p_save);
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;

    -- House-mades: every line that names an ingredient is found or added here
    -- (with what the app found in its name), then save_house_mades writes them
    -- as before, with its limits: three levels, no two of one name, and 20
    -- house-mades and parts in one save, counted across the whole drink.
    IF jsonb_typeof(p_save -> 'preps') = 'array' AND jsonb_array_length(p_save -> 'preps') > 0 THEN
        FOR v_prep IN SELECT * FROM jsonb_array_elements(p_save -> 'preps') LOOP
            v_lines := '[]'::jsonb;
            FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_prep -> 'lines', '[]'::jsonb)) LOOP
                IF NOT v_line ? 'part' THEN
                    v_got := private.save_line_ingredient(v_line, v_bar);
                    v_line := (v_line - 'name' - 'bottle' - 'allergens') || jsonb_build_object('id', v_got ->> 'id');
                END IF;
                v_lines := v_lines || v_line;
            END LOOP;
            v_preps := v_preps || jsonb_set(v_prep, '{lines}', v_lines);
        END LOOP;
        SELECT array_agg(x::uuid ORDER BY n) INTO v_house
          FROM jsonb_array_elements_text(public.save_house_mades(v_bar, v_preps)) WITH ORDINALITY AS t(x, n);
    END IF;

    -- The drink's own lines, on the rows found or made for them.
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_save -> 'lines') LOOP
        v_ref := COALESCE(v_line -> 'ingredient', '{}'::jsonb);
        IF v_ref ? 'house_made' THEN
            IF v_house[(v_ref ->> 'house_made')::integer + 1] IS NULL THEN RAISE EXCEPTION 'A line points at nothing.'; END IF;
            v_got := jsonb_build_object('id', v_house[(v_ref ->> 'house_made')::integer + 1], 'new', false);
        ELSIF (v_ref ->> 'own')::boolean THEN
            -- One of its own twice in a drink is one row.
            v_key := public.ingredient_key(COALESCE(v_ref ->> 'name', ''));
            v_got := COALESCE(v_own -> v_key, private.save_line_ingredient(v_ref, v_bar));
            v_own := v_own || jsonb_build_object(v_key, v_got || '{"new": false}'::jsonb);
        ELSE
            v_got := private.save_line_ingredient(v_ref, v_bar);
        END IF;
        v_spec := v_spec || ((v_line - 'ingredient') || jsonb_build_object('ingredient_item_id', v_got ->> 'id'));
        v_out := v_out || v_got;
    END LOOP;

    IF p_save ? 'drink' THEN
        v_drink := p_save -> 'drink';
        -- An id that's taken (another drink) gets one of its own, as the app did.
        IF v_drink ->> 'id' IS NULL OR EXISTS (SELECT 1 FROM public.items WHERE id = (v_drink ->> 'id')::uuid) THEN
            v_drink := v_drink - 'id';
        END IF;
        SELECT string_agg(format('%I', k), ', ') INTO v_cols FROM jsonb_object_keys(v_drink) AS k;
        IF EXISTS (
            SELECT 1 FROM jsonb_object_keys(v_drink) AS k
             WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
                                WHERE a.attrelid = 'public.items'::regclass AND a.attname = k AND a.attnum > 0 AND NOT a.attisdropped)
        ) THEN
            RAISE EXCEPTION 'A drink has no such field.';
        END IF;
        EXECUTE format('INSERT INTO public.items (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.items, $1) RETURNING id', v_cols)
            INTO v_item USING v_drink;

        IF NULLIF(p_save #>> '{credits,creator}', '') IS NOT NULL OR jsonb_array_length(COALESCE(p_save #> '{credits,names}', '[]'::jsonb)) > 0 THEN
            PERFORM public.set_drink_credits(
                p_item_id => v_item,
                p_creator_profile_id => NULLIF(p_save #>> '{credits,creator}', '')::uuid,
                p_creator_names => ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_save #> '{credits,names}', '[]'::jsonb))),
                p_add => '{}'::uuid[],
                p_remove => '{}'::uuid[]
            );
            -- You can say yes to your own credit; anyone else's starts as suggested.
            IF (p_save #>> '{credits,accept}')::boolean THEN
                SELECT id INTO v_credit FROM public.item_credits
                 WHERE item_id = v_item AND role = 'creator' AND profile_id = (p_save #>> '{credits,creator}')::uuid;
                IF v_credit IS NOT NULL THEN PERFORM public.answer_item_credit(v_credit, true); END IF;
            END IF;
        END IF;

        INSERT INTO public.item_images (item_id, image_id, sort_order)
        SELECT v_item, x::uuid, (n - 1)::integer
          FROM jsonb_array_elements_text(COALESCE(p_save -> 'images', '[]'::jsonb)) WITH ORDINALITY AS t(x, n);
    ELSE
        v_item := (p_save ->> 'item')::uuid;
    END IF;

    v_version := public.save_drink_spec(
        v_item,
        v_spec,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_save -> 'methods', '[]'::jsonb)))::uuid[],
        p_save ->> 'note',
        CASE WHEN jsonb_typeof(p_save -> 'method_parts') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_save -> 'method_parts'))::smallint[] END,
        CASE WHEN jsonb_typeof(p_save -> 'parts') = 'array' THEN p_save -> 'parts' END
    );

    v_result := jsonb_build_object('item', v_item, 'version', v_version, 'house_mades', to_jsonb(v_house), 'lines', v_out);
    PERFORM private.drink_save_done(p_key, p_save, v_result);
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION "private"."drink_save_key"("uuid", "jsonb") FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "private"."drink_save_seen"("uuid", "jsonb") FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "private"."drink_save_done"("uuid", "jsonb", "jsonb") FROM PUBLIC, "anon";
REVOKE ALL ON FUNCTION "private"."save_line_ingredient"("jsonb", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."drink_save_key"("uuid", "jsonb") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."drink_save_seen"("uuid", "jsonb") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."drink_save_done"("uuid", "jsonb", "jsonb") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."save_line_ingredient"("jsonb", "uuid") TO "authenticated", "service_role";

REVOKE EXECUTE ON FUNCTION "public"."save_drink"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_drink"("uuid", "jsonb") TO "authenticated", "service_role";
