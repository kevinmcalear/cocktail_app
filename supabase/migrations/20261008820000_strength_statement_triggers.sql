-- A drink's strength worked out once per saved spec, not once per line.
-- Local stack only until Kevin's OK.
--
-- recipes_refresh_strength and item_methods_refresh_strength
-- (20261001130000_drink_math.sql) were row triggers: saving a six-line spec
-- (delete the old lines, insert the new) worked the whole drink out and
-- updated its item twelve times, and a bulk change (an ingredient merge,
-- a seed) did the same for every line it touched. Row AFTER triggers already
-- ran at the end of the statement, so every one of those runs saw the same
-- final spec: the stored values were right, just paid for many times over.
--
-- They are now statement triggers with transition tables (Postgres needs one
-- trigger per event for those), and each drink a statement touched is worked
-- out once, from the same final state, with the same refresh_drink_strength().
-- items_refresh_strength (an ingredient's ABV or density, a drink's own
-- dilution) stays a row trigger: Postgres doesn't allow transition tables on
-- an UPDATE OF column trigger, and it already refreshes each drink once.

DROP TRIGGER "recipes_refresh_strength" ON "public"."recipes";
DROP TRIGGER "item_methods_refresh_strength" ON "public"."item_methods";
DROP FUNCTION "private"."recipes_refresh_strength"();
DROP FUNCTION "private"."item_methods_refresh_strength"();

-- Spec lines changed: each drink whose lines were added, changed or removed
-- (a line moved to another drink counts for both).
CREATE FUNCTION "private"."recipes_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ids uuid[];
    v_id uuid;
BEGIN
    -- Only the transition tables this event declares can be named.
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT recipe_item_id) INTO v_ids FROM new_lines;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT recipe_item_id) INTO v_ids FROM old_lines;
    ELSE
        SELECT array_agg(DISTINCT x) INTO v_ids
        FROM (SELECT recipe_item_id FROM new_lines UNION SELECT recipe_item_id FROM old_lines) t(x);
    END IF;
    FOREACH v_id IN ARRAY coalesce(v_ids, '{}') LOOP
        IF v_id IS NOT NULL THEN
            PERFORM private.refresh_drink_strength(v_id);
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

-- The method changed: each drink whose methods were added, changed or removed.
CREATE FUNCTION "private"."item_methods_refresh_strength"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ids uuid[];
    v_id uuid;
BEGIN
    -- Only the transition tables this event declares can be named.
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT item_id) INTO v_ids FROM new_methods;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT item_id) INTO v_ids FROM old_methods;
    ELSE
        SELECT array_agg(DISTINCT x) INTO v_ids
        FROM (SELECT item_id FROM new_methods UNION SELECT item_id FROM old_methods) t(x);
    END IF;
    FOREACH v_id IN ARRAY coalesce(v_ids, '{}') LOOP
        IF v_id IS NOT NULL THEN
            PERFORM private.refresh_drink_strength(v_id);
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "recipes_refresh_strength_insert" AFTER INSERT ON "public"."recipes"
    REFERENCING NEW TABLE AS "new_lines"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."recipes_refresh_strength"();
CREATE TRIGGER "recipes_refresh_strength_update" AFTER UPDATE ON "public"."recipes"
    REFERENCING OLD TABLE AS "old_lines" NEW TABLE AS "new_lines"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."recipes_refresh_strength"();
CREATE TRIGGER "recipes_refresh_strength_delete" AFTER DELETE ON "public"."recipes"
    REFERENCING OLD TABLE AS "old_lines"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."recipes_refresh_strength"();

CREATE TRIGGER "item_methods_refresh_strength_insert" AFTER INSERT ON "public"."item_methods"
    REFERENCING NEW TABLE AS "new_methods"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."item_methods_refresh_strength"();
CREATE TRIGGER "item_methods_refresh_strength_update" AFTER UPDATE ON "public"."item_methods"
    REFERENCING OLD TABLE AS "old_methods" NEW TABLE AS "new_methods"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."item_methods_refresh_strength"();
CREATE TRIGGER "item_methods_refresh_strength_delete" AFTER DELETE ON "public"."item_methods"
    REFERENCING OLD TABLE AS "old_methods"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."item_methods_refresh_strength"();

REVOKE EXECUTE ON FUNCTION "private"."recipes_refresh_strength"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_methods_refresh_strength"() FROM PUBLIC, "anon", "authenticated";
