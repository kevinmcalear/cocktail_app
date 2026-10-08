-- A drink keeps the drawing its maker watched being drawn.
--
-- The add-drink wizard draws the drink from its own rules as it's made
-- (lib/sketch/draft.ts), and the app saves the drink under the draft's id so
-- the pencil matches. The flavor-worker then works out drawing inputs again,
-- and where the AI fill knows something the rules didn't (a colour for an
-- ingredient it hasn't seen) the drawing changed after the person had seen
-- and saved it.
--
-- save_maker_sketch stores the wizard's inputs as source 'maker', with the
-- drink's fingerprint at that moment. save_item_sketch (the worker) leaves a
-- maker drawing alone while the fingerprint matches: change the spec, name,
-- description, glass, ice or methods and the worker draws it afresh, as for
-- any drink.

ALTER TABLE "public"."item_sketches" DROP CONSTRAINT "item_sketches_source_check";
ALTER TABLE "public"."item_sketches" ADD CONSTRAINT "item_sketches_source_check" CHECK ("source" IN ('rules', 'ai', 'maker'));

-- The wizard's drawing for a drink the caller can edit (the items_update
-- rule). False when they can't, or it isn't a cocktail; inputs the app can't
-- draw are refused.
CREATE FUNCTION "public"."save_maker_sketch"("p_item_id" "uuid", "p_inputs" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = p_item_id AND i.item_type = 'cocktail' AND private.can_write(i.bar_id, i.created_by)
    ) THEN
        RETURN false;
    END IF;
    IF NOT coalesce(private.valid_sketch_inputs(p_inputs), false) THEN
        RAISE EXCEPTION 'Those drawing inputs can''t be drawn.' USING ERRCODE = '22023';
    END IF;

    -- rules_version 0: no worker rules made it.
    INSERT INTO public.item_sketches AS s (item_id, inputs, source, spec_fingerprint, rules_version, updated_at)
    VALUES (p_item_id, p_inputs, 'maker', private.item_flavor_fingerprint(p_item_id), 0, now())
    ON CONFLICT (item_id) DO UPDATE SET
        inputs = excluded.inputs, source = 'maker', spec_fingerprint = excluded.spec_fingerprint,
        rules_version = 0, updated_at = now();
    RETURN true;
END;
$$;

-- As in 20261006300000_item_sketches.sql, except a maker's drawing stands
-- until the drink it was drawn from changes.
CREATE OR REPLACE FUNCTION "public"."save_item_sketch"(
    "p_item_id" "uuid",
    "p_inputs" "jsonb",
    "p_source" "text",
    "p_spec_fingerprint" "text",
    "p_rules_version" integer,
    "p_ai_basis" "text" DEFAULT NULL,
    "p_ai_answer" "jsonb" DEFAULT NULL
) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND item_type = 'cocktail') THEN
        RETURN;
    END IF;

    IF p_ai_basis IS NOT NULL AND p_ai_answer IS NOT NULL THEN
        INSERT INTO private.item_sketch_ai (item_id, basis, answer)
        VALUES (p_item_id, p_ai_basis, p_ai_answer)
        ON CONFLICT (item_id) DO UPDATE SET basis = excluded.basis, answer = excluded.answer, created_at = now();
    END IF;

    INSERT INTO public.item_sketches AS s (item_id, inputs, source, spec_fingerprint, rules_version, updated_at)
    VALUES (p_item_id, p_inputs, p_source, p_spec_fingerprint, p_rules_version, now())
    ON CONFLICT (item_id) DO UPDATE SET
        inputs = excluded.inputs, source = excluded.source, spec_fingerprint = excluded.spec_fingerprint,
        rules_version = excluded.rules_version, updated_at = now()
    WHERE s.source <> 'maker' OR s.spec_fingerprint IS DISTINCT FROM excluded.spec_fingerprint;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_maker_sketch"("p_item_id" "uuid", "p_inputs" "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_maker_sketch"("p_item_id" "uuid", "p_inputs" "jsonb") TO "authenticated", "service_role";
