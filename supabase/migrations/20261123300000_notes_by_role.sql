-- Notes by role (E29, Eddie's TestFlight notes, 26 Oct; Kevin picked A).
--
-- At a venue, "Who reads the notes?" picks a role and everyone above it:
-- a head bartender's note on a house spec isn't for a new barback or a
-- takeover guest. Until now a drink's notes sat on items.notes, read by
-- anyone who could read the drink, and a bar-credited drink's notes sat in
-- credited_drink_notes (20261008050000). Both move to one table:
--
--   item_notes  one per drink: the text and who reads it. read_level NULL is
--               everyone who sees the drink (as before); 20, 30, 35 or 40 is
--               that venue role level and up, venue drinks only. The role
--               counted is the reader's own at the drink's venue, lowered by
--               View as, so the drink page, run sheet and View as follow it.
--               The last person to write a note reads it too (outside View as).
--
--   * Writes: whoever can edit the drink (private.can_edit_item), on notes
--     they can read. Who wrote it and when are set by a trigger.
--   * app_item_presentation reads item_notes, so every screen that showed
--     notes still does, to whoever may read them.
--   * Versions keep only notes for everyone: item_versions reaches everyone
--     with the spec. Restoring a version leaves role notes alone.
--   * merge_item moves the copy's notes the way it did before.
--   * items.notes and credited_drink_notes stay until 20261123310000 drops
--     them, because installed apps write items.notes until the OTA reaches
--     them. Two triggers copy those writes into item_notes (section 5); the
--     new app writes item_notes and reads it alone.
--
-- "Just me" notes stay in item_private_notes (20261025100000), one per person.

-- --- 1. The table ---

CREATE TABLE "public"."item_notes" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "body" "text" NOT NULL CHECK (char_length(btrim("body")) BETWEEN 1 AND 20000),
    "read_level" smallint CHECK ("read_level" IN (20, 30, 35, 40)),
    "updated_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."item_notes" ENABLE ROW LEVEL SECURITY;

-- Who wrote it and when, whatever the client sends.
CREATE FUNCTION "private"."item_notes_stamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_by := COALESCE(auth.uid(), CASE WHEN TG_OP = 'UPDATE' THEN OLD.updated_by END);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "item_notes_stamp" BEFORE INSERT OR UPDATE ON "public"."item_notes"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_notes_stamp"();

-- --- 2. Who reads them ---

-- A note the caller may read, on a drink they can already see (the policy
-- checks that part through items' own RLS, one row at a time as
-- 20261010200000 does for the notes it replaces). One look at the drink: a
-- bar-credited drink behind a closed page keeps its notes back as before
-- (is_spec_locked); a role note needs that role or above at the drink's
-- venue, from a role that hasn't ended, lowered by View as.
CREATE FUNCTION "private"."item_note_readable"("p_item_id" "uuid", "p_read_level" smallint, "p_updated_by" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT NOT (private.is_bar_credited_drink(i.bar_id, i.is_catalog, i.created_by, i.origin_bar_profile_id)
                AND public.is_spec_locked(i.id))
       AND (p_read_level IS NULL
            -- Its writer, unless they're looking through View as.
            OR (p_updated_by = auth.uid()
                AND NOT EXISTS (SELECT 1 FROM public.user_prefs up WHERE up.user_id = auth.uid() AND up.view_as_role_level IS NOT NULL))
            OR EXISTS (
              SELECT 1
              FROM public.user_bars ub
              LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
              WHERE ub.bar_id = i.bar_id AND ub.user_id = auth.uid()
                AND (vr.ends_at IS NULL OR vr.ends_at > now())
                AND public.effective_bar_role(ub.role_level) >= p_read_level))
    FROM public.items i WHERE i.id = p_item_id), false);
$$;

REVOKE ALL ON FUNCTION "private"."item_note_readable"("uuid", smallint, "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "private"."item_note_readable"("uuid", smallint, "uuid") TO "anon", "authenticated", "service_role";

CREATE POLICY "item_notes_select" ON "public"."item_notes" FOR SELECT TO "anon", "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_notes"."item_id")
           AND "private"."item_note_readable"("item_id", "read_level", "updated_by"));

-- Editors of the drink write its notes; a role level only on a venue drink.
CREATE POLICY "item_notes_insert" ON "public"."item_notes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "private"."can_edit_item"("item_id")
        AND ("read_level" IS NULL OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_notes"."item_id" AND "i"."bar_id" IS NOT NULL))
    );
CREATE POLICY "item_notes_update" ON "public"."item_notes" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id") AND "private"."item_note_readable"("item_id", "read_level", "updated_by"))
    WITH CHECK (
        "private"."can_edit_item"("item_id")
        AND ("read_level" IS NULL OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_notes"."item_id" AND "i"."bar_id" IS NOT NULL))
    );
CREATE POLICY "item_notes_delete" ON "public"."item_notes" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id") AND "private"."item_note_readable"("item_id", "read_level", "updated_by"));

REVOKE ALL ON TABLE "public"."item_notes" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON TABLE "public"."item_notes" TO "anon", "authenticated";
GRANT INSERT ("item_id", "body", "read_level"), UPDATE ("body", "read_level"), DELETE ON TABLE "public"."item_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."item_notes" TO "service_role";

-- --- 3. Move what's there ---

-- Every note today is for whoever sees the drink. A drink's own notes and a
-- credited drink's kept-aside notes never both exist (the trigger moved them).
INSERT INTO "public"."item_notes" ("item_id", "body")
SELECT "id", "notes" FROM "public"."items" WHERE "notes" IS NOT NULL AND btrim("notes") <> ''
UNION ALL
SELECT "item_id", "notes" FROM "public"."credited_drink_notes" WHERE btrim("notes") <> ''
ON CONFLICT ("item_id") DO NOTHING;

-- --- 4. Reading them back ---

-- As 20261123200000_show_sketch, with notes from item_notes. Applied after it,
-- so show_sketch stays.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    -- item_notes' own rules decide who gets them (the view is security_invoker).
    (SELECT n.body FROM public.item_notes n WHERE n.item_id = c.id) AS notes,
    c.origin,
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id,
    c.generic_id,
    c.service_style,
    c.density_g_ml,
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build,
    CASE
      WHEN c.bar_id IS NOT NULL OR c.created_by IS NOT NULL THEN c.picture
      WHEN c.item_type = 'ingredient' AND c.picture = 'photo' AND private.item_picture_url(c.id) IS NOT NULL THEN 'photo'::public.item_picture
      ELSE 'drawing'::public.item_picture
    END AS picture,
    CASE WHEN c.item_type = 'ingredient' THEN private.item_picture_url(c.id) END AS picture_url,
    c.show_sketch
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
     LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
     LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
     CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
  WHERE c.bar_id IS NULL
     OR private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
     OR (ub.user_id IS NOT NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END));

-- As 20261010100000, with notes from item_notes.
CREATE OR REPLACE FUNCTION private.drink_snapshot(p_item uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ingredient_item_id', r.ingredient_item_id,
        'name', ing.name,
        'amount', r.amount,
        'unit', r.unit,
        'note', r.preparation_notes,
        'optional', COALESCE(r.is_optional, false),
        'at_service', r.at_service) ORDER BY r.sort_order, r.created_at)
      FROM public.recipes r LEFT JOIN public.items ing ON ing.id = r.ingredient_item_id
      WHERE r.recipe_item_id = p_item), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(m.name ORDER BY im.sort_order)
      FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
      WHERE im.item_id = p_item), '[]'::jsonb),
    'method_ids', COALESCE((
      SELECT jsonb_agg(im.method_item_id ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'glass', (SELECT g.name FROM public.items i JOIN public.items g ON g.id = i.glassware_id WHERE i.id = p_item),
    'ice', (SELECT ic.name FROM public.items i JOIN public.items ic ON ic.id = i.ice_id WHERE i.id = p_item),
    -- Only notes for everyone who sees the drink: version history reaches
    -- everyone with the spec, so notes for a role and up stay out of it.
    'notes', (SELECT n.body FROM public.item_notes n WHERE n.item_id = p_item AND n.read_level IS NULL),
    'dilution_pct', (SELECT COALESCE(i.dilution_pct, cd.dilution_pct) FROM public.items i LEFT JOIN public.credited_drink_details cd ON cd.item_id = i.id WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

-- As 20261008050000, with notes in item_notes.
CREATE OR REPLACE FUNCTION public.restore_drink_version(p_item uuid, p_version integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
    v_snapshot jsonb;
    v_line jsonb;
    v_index integer := 0;
    v_method uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    SELECT snapshot INTO v_snapshot FROM public.item_versions WHERE item_id = p_item AND version = p_version;
    IF v_snapshot IS NULL THEN RAISE EXCEPTION 'No version % of this drink.', p_version; END IF;

    DELETE FROM public.recipes WHERE recipe_item_id = p_item;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'lines') LOOP
        INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, at_service, sort_order)
        VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                NULLIF(v_line ->> 'note', ''), COALESCE((v_line ->> 'optional')::boolean, false), (v_line ->> 'at_service')::boolean, v_index);
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    v_index := 0;
    FOR v_method IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(v_snapshot -> 'method_ids', '[]'::jsonb)) LOOP
        INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES (p_item, v_method, v_index);
        v_index := v_index + 1;
    END LOOP;
    -- Versions only hold notes for everyone (drink_snapshot), so notes for a
    -- role and up stay as they are.
    IF NOT EXISTS (SELECT 1 FROM public.item_notes WHERE item_id = p_item AND read_level IS NOT NULL) THEN
        IF NULLIF(btrim(v_snapshot ->> 'notes'), '') IS NULL THEN
            DELETE FROM public.item_notes WHERE item_id = p_item;
        ELSE
            INSERT INTO public.item_notes (item_id, body) VALUES (p_item, v_snapshot ->> 'notes')
            ON CONFLICT (item_id) DO UPDATE SET body = EXCLUDED.body;
        END IF;
    END IF;
    UPDATE public.items
       SET dilution_pct = NULLIF(v_snapshot ->> 'dilution_pct', '')::numeric,
           service_style = NULLIF(v_snapshot ->> 'service_style', '')
     WHERE id = p_item;

    RETURN private.write_drink_version(p_item, 'Restored version ' || p_version);
END;
$$;

-- As 20261102400000, with notes in item_notes.
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
        'item_notes', (SELECT to_jsonb(n) FROM public.item_notes n WHERE n.item_id = p_from),
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
    -- item_notes the same way: any other copy's notes went with its row, as
    -- they did on items.notes.
    IF NOT (private.is_bar_credited_drink(v_into.bar_id, v_into.is_catalog, v_into.created_by, v_into.origin_bar_profile_id)
            AND private.is_bar_credited_drink(v_from.bar_id, v_from.is_catalog, v_from.created_by, v_from.origin_bar_profile_id)) THEN
        DELETE FROM public.item_notes WHERE item_id = p_from;
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

-- --- 5. Installed apps, until 20261123310000 ---

-- An app from before this writes items.notes. Its text becomes the drink's
-- notes, as it would have: a role level stays as it is, and a note the
-- writer can't read is left alone (that app shows the box empty, so saving
-- it sends an empty one). An update that doesn't change notes is no write
-- (the new app never sends them, so items.notes goes stale). On a
-- bar-credited drink NULL keeps the notes and '' clears them
-- (20261008050000). Runs before keep_credited_drink_notes takes them off the
-- row: trigger names sort alphabetically.
CREATE FUNCTION "private"."items_notes_to_item_notes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_body text := NULLIF(btrim(COALESCE(NEW.notes, '')), '');
    v_note public.item_notes;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.notes IS NOT DISTINCT FROM OLD.notes THEN
            RETURN NEW;
        END IF;
        IF NEW.notes IS NULL
           AND (private.is_bar_credited_drink(NEW.bar_id, NEW.is_catalog, NEW.created_by, NEW.origin_bar_profile_id)
                OR private.is_bar_credited_drink(OLD.bar_id, OLD.is_catalog, OLD.created_by, OLD.origin_bar_profile_id)) THEN
            RETURN NEW;
        END IF;
    ELSIF v_body IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO v_note FROM public.item_notes WHERE item_id = NEW.id;
    IF FOUND AND v_note.read_level IS NOT NULL
       AND (auth.uid() IS NULL OR NOT private.item_note_readable(NEW.id, v_note.read_level, v_note.updated_by)) THEN
        RETURN NEW;
    END IF;
    IF v_body IS NULL THEN
        DELETE FROM public.item_notes WHERE item_id = NEW.id;
    ELSE
        INSERT INTO public.item_notes (item_id, body) VALUES (NEW.id, left(v_body, 20000))
        ON CONFLICT (item_id) DO UPDATE SET body = EXCLUDED.body;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "items_notes_to_item_notes" BEFORE UPDATE ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."items_notes_to_item_notes"();
-- A new drink's notes once its row exists.
CREATE TRIGGER "items_new_notes_to_item_notes" AFTER INSERT ON "public"."items"
    FOR EACH ROW
    WHEN ("new"."notes" IS NOT NULL)
    EXECUTE FUNCTION "private"."items_notes_to_item_notes"();

REVOKE ALL ON FUNCTION "private"."items_notes_to_item_notes"() FROM PUBLIC, "anon", "authenticated";
