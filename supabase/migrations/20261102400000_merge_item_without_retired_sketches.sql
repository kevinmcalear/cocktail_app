-- private.merge_item without private.retired_drink_sketches.
--
-- 20261102100000 (#740) rewrote merge_item to clear and move rows in
-- private.retired_drink_sketches. 20261102300000 (#744) then dropped that
-- table. Each PR passed CI against the main it branched from, but together
-- every merge_item call fails with "relation does not exist", and
-- `supabase db lint` fails on main. This is the same function with the three
-- references taken out; nothing else changes. The table only linked retired
-- AI sketches to drinks, so there is nothing left to move or keep.

CREATE OR REPLACE FUNCTION "private"."merge_item"("p_from" "uuid", "p_into" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from public.items;
    v_into public.items;
    v_fk record;
    v_dup record;
    v_ctid tid;
    v_pin smallint;
    v_images uuid[];
    v_row jsonb;
    v_worker text := current_setting('app.image_worker', true);
BEGIN
    SELECT * INTO v_from FROM public.items WHERE id = p_from;
    SELECT * INTO v_into FROM public.items WHERE id = p_into;
    IF v_from.id IS NULL OR v_into.id IS NULL OR p_from = p_into THEN
        RAISE EXCEPTION 'Pick two different items.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_from.item_type <> v_into.item_type OR v_from.item_type = 'ingredient' THEN
        RAISE EXCEPTION 'Merge two items of the same kind (ingredients use merge_ingredient).' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_from.bar_id IS DISTINCT FROM v_into.bar_id THEN
        RAISE EXCEPTION 'Merge items from the same venue, or two shared ones.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Moving spec rows must not queue paid sketches. Put back at the end.
    PERFORM set_config('app.image_worker', 'on', true);

    INSERT INTO private.item_merges (from_id, into_id, snapshot)
    VALUES (p_from, p_into, jsonb_build_object(
        'item', to_jsonb(v_from),
        'recipes', (SELECT jsonb_agg(to_jsonb(r)) FROM public.recipes r WHERE r.recipe_item_id = p_from),
        'credited_drink_notes', (SELECT to_jsonb(n) FROM public.credited_drink_notes n WHERE n.item_id = p_from),
        'credited_drink_details', (SELECT to_jsonb(d) FROM public.credited_drink_details d WHERE d.item_id = p_from)))
    ON CONFLICT (from_id) DO NOTHING;

    -- A spec belongs to one drink: when p_into has its own, the copy's spec
    -- and everything worked out from it go rather than mixing into it.
    IF EXISTS (SELECT 1 FROM public.recipes WHERE recipe_item_id = p_into) THEN
        DELETE FROM public.recipes WHERE recipe_item_id = p_from;
        DELETE FROM public.item_methods WHERE item_id = p_from;
        DELETE FROM public.item_steps WHERE item_id = p_from;
        DELETE FROM public.item_versions WHERE item_id = p_from;
        DELETE FROM public.item_flavors WHERE item_id = p_from;
        DELETE FROM public.item_allergens WHERE item_id = p_from;
        DELETE FROM public.item_allergen_checks WHERE item_id = p_from;
        DELETE FROM public.item_sketches WHERE item_id = p_from;
        DELETE FROM private.item_sketch_ai WHERE item_id = p_from;
        DELETE FROM public.discover_drink_facts WHERE item_id = p_from;
        DELETE FROM private.item_spec_matches WHERE item_id = p_from;
        -- Sketches drawn from the copy's spec; photos move with the rest.
        WITH gone AS (
            DELETE FROM public.item_images WHERE item_id = p_from AND is_generated RETURNING image_id
        )
        SELECT array_agg(image_id) INTO v_images FROM gone;
        DELETE FROM public.images im
         WHERE im.id = ANY (COALESCE(v_images, '{}'))
           AND NOT EXISTS (SELECT 1 FROM public.item_images ii WHERE ii.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.drink_photos p WHERE p.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.made_drinks m WHERE m.image_id = im.id);
    ELSE
        -- The copy's spec moves; its steps and versions only when p_into has none.
        IF EXISTS (SELECT 1 FROM public.item_steps WHERE item_id = p_into) THEN
            DELETE FROM public.item_steps WHERE item_id = p_from;
        END IF;
        IF EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_into) THEN
            DELETE FROM public.item_versions WHERE item_id = p_from;
        END IF;
    END IF;
    -- Notes and figures kept aside for a bar-credited drink (20261008050000)
    -- only follow onto another bar-credited drink.
    IF NOT private.is_bar_credited_drink(v_into.bar_id, v_into.is_catalog, v_into.created_by, v_into.origin_bar_profile_id) THEN
        DELETE FROM public.credited_drink_notes WHERE item_id = p_from;
        DELETE FROM public.credited_drink_details WHERE item_id = p_from;
    END IF;

    -- Someone who ranked both keeps one ranking. The one already on p_into
    -- stays; what hangs off the other (comparisons, photos, made drinks) moves
    -- onto it first, so nothing is dropped with it.
    FOR v_dup IN
        WITH m AS (
            SELECT e.id, e.user_id, e.venue_profile_id,
                   CASE WHEN e.item_id = p_from THEN p_into ELSE e.item_id END AS item_id,
                   CASE WHEN e.ranked_as_item_id = p_from THEN p_into ELSE e.ranked_as_item_id END AS ranked_as_item_id,
                   (e.item_id = p_from OR e.ranked_as_item_id IS NOT DISTINCT FROM p_from) AS moving
              FROM public.rank_entries e
             WHERE e.user_id IN (SELECT user_id FROM public.rank_entries WHERE item_id = p_from OR ranked_as_item_id = p_from)
        ), g AS (
            SELECT id, first_value(id) OVER (
                       PARTITION BY user_id, item_id, ranked_as_item_id, venue_profile_id
                       ORDER BY moving, id) AS keep_id
              FROM m
        )
        SELECT id AS drop_id, keep_id FROM g WHERE id <> keep_id
    LOOP
        DELETE FROM public.rank_comparisons
         WHERE (winner_entry_id = v_dup.drop_id AND loser_entry_id = v_dup.keep_id)
            OR (winner_entry_id = v_dup.keep_id AND loser_entry_id = v_dup.drop_id);
        FOR v_fk IN
            SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
              JOIN pg_namespace n ON n.oid = t.relnamespace
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
             WHERE c.contype = 'f' AND c.confrelid = 'public.rank_entries'::regclass
        LOOP
            EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2', v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name)
              USING v_dup.keep_id, v_dup.drop_id;
        END LOOP;
        DELETE FROM public.rank_entries WHERE id = v_dup.drop_id RETURNING profile_pin INTO v_pin;
        -- A pinned ranking stays pinned, so it stays shown (rank_entries_pin_shown).
        UPDATE public.rank_entries SET profile_pin = v_pin, on_profile = true
         WHERE id = v_dup.keep_id AND profile_pin IS NULL AND v_pin IS NOT NULL;
    END LOOP;

    -- Every foreign key to items, on the column that holds the item's id
    -- (release_items' key also carries bar_id, which the two share).
    FOR v_fk IN
        SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name,
               -- Rows elsewhere that a delete here would cascade to or clear.
               EXISTS (SELECT 1 FROM pg_constraint d WHERE d.contype = 'f' AND d.confrelid = c.conrelid
                         AND d.confdeltype IN ('c', 'n', 'd')) AS has_dependents
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS k(attnum, refnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.refnum
         WHERE c.contype = 'f' AND c.confrelid = 'public.items'::regclass AND ra.attname = 'id'
    LOOP
        IF v_fk.schema_name = 'public' AND v_fk.table_name = 'items' THEN
            -- p_into can't end up linked to itself. A riff, copy or child
            -- takes p_from's own link instead; any other link is cleared.
            EXECUTE format('UPDATE public.items i SET %1$I = %2$s FROM public.items f WHERE f.id = $1 AND i.id = $2 AND i.%1$I = $1',
                           v_fk.column_name,
                           CASE WHEN v_fk.column_name IN ('riff_of_id', 'spec_from_id', 'lineage_parent_id')
                                THEN format('NULLIF(f.%I, $2)', v_fk.column_name) ELSE 'NULL' END)
              USING p_from, p_into;
            -- Items are never deleted here: a clash stops the merge.
            EXECUTE format('UPDATE public.items SET %1$I = $1 WHERE %1$I = $2', v_fk.column_name)
              USING p_into, p_from;
            CONTINUE;
        END IF;
        BEGIN
            EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2', v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name)
              USING p_into, p_from;
        EXCEPTION WHEN unique_violation OR check_violation THEN
            -- Row by row: what clashes stays with p_into.
            FOR v_ctid IN EXECUTE format('SELECT ctid FROM %I.%I WHERE %I = $1', v_fk.schema_name, v_fk.table_name, v_fk.column_name) USING p_from LOOP
                BEGIN
                    EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE ctid = $2', v_fk.schema_name, v_fk.table_name, v_fk.column_name)
                      USING p_into, v_ctid;
                EXCEPTION WHEN unique_violation OR check_violation THEN
                    IF v_fk.has_dependents THEN
                        RAISE EXCEPTION 'Merging % into %: a %.% row clashes and other rows depend on it.', p_from, p_into, v_fk.schema_name, v_fk.table_name
                            USING ERRCODE = 'unique_violation';
                    END IF;
                    -- Kept in the merge record, so it can be put back.
                    EXECUTE format('DELETE FROM %I.%I t WHERE ctid = $1 RETURNING to_jsonb(t)', v_fk.schema_name, v_fk.table_name)
                      INTO v_row USING v_ctid;
                    UPDATE private.item_merges
                       SET snapshot = jsonb_set(snapshot, '{dropped}', COALESCE(snapshot -> 'dropped', '[]')
                                      || jsonb_build_array(jsonb_build_object('table', v_fk.schema_name || '.' || v_fk.table_name, 'row', v_row)))
                     WHERE from_id = p_from;
                    RAISE NOTICE 'merge_item %: dropped a %.% row that p_into already has', p_from, v_fk.schema_name, v_fk.table_name;
                END;
            END LOOP;
        END;
    END LOOP;
    -- A copy matched to p_into as its classic now reads as p_into matching itself.
    DELETE FROM private.item_spec_matches WHERE item_id = p_into AND classic_id = p_into;

    -- Ids held without a foreign key.
    DELETE FROM public.profile_picks p
     WHERE p.target_id = p_from
       AND EXISTS (SELECT 1 FROM public.profile_picks q WHERE q.profile_id = p.profile_id AND q.section = p.section AND q.target_id = p_into);
    UPDATE public.profile_picks SET target_id = p_into WHERE target_id = p_from;
    -- A bring-in's list is what Undo deletes: p_from leaves it, and p_into
    -- (which that bring-in didn't make) is never added.
    UPDATE public.bring_in_batches SET item_ids = array_remove(item_ids, p_from) WHERE p_from = ANY (item_ids);
    DELETE FROM private.item_flavor_jobs WHERE item_id = p_from;
    DELETE FROM private.item_image_jobs WHERE item_id = p_from;
    PERFORM private.discover_mark(ARRAY[p_into]);

    DELETE FROM public.items WHERE id = p_from;

    PERFORM set_config('app.image_worker', COALESCE(v_worker, ''), true);
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."merge_item"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";
