-- One row for a drink on a menu: a drink can't be added to a menu twice.
--
-- The same drink could be added to one menu twice (save_menu sent it twice,
-- or two taps landed together), and the second row crashed Tonight on iOS.
-- Kevin approved this fix on 2 Nov 2026: delete the duplicate menu_drinks
-- rows, keeping the first, and add a unique index.
--
--   * DELETES the later rows of any drink that is on a menu more than once,
--     keeping the earliest (created_at, then id). Nothing else is moved or
--     rewritten. A row with a planned take-off (off_at set) is not a
--     duplicate: a drink swapped out for later and swapped back in is two
--     rows on purpose, one ending and one coming on, so it is left alone.
--     Deleting a row fires the menu_drinks_removed record only for a menu on
--     now, as for any delete.
--   * menu_drinks_menu_item_live_key: one row per (menu_id, item_id) among
--     rows with no off_at.
--   * save_menu puts a drink sent twice on the menu once, and an insert
--     that finds the drink already there keeps that row instead of erroring.
--     Same as 20261206507000_save_menu_cover_credit.sql otherwise.
--   * move_menu_history_to_venue skips a drink an edition lists twice. Same
--     as 20261017600000_venue_owns_menu_history.sql otherwise.
--   * The app's add paths (hooks/useLivingList.ts) treat the unique
--     violation (23505) of a re-add as done. They can't use ON CONFLICT: the
--     API can't name the index's WHERE.
--   * merge_item: two copies of a drink live on one menu would now collide,
--     and the merge refuses a clash that has dependents (run sheet swaps).
--     It now drops the copy's row first, kept in the merge record, and the
--     record of a drink taken off (record_menu_drink_removed) skips that
--     delete. Same as 20261204300000_one_home.sql otherwise.

DELETE FROM "public"."menu_drinks" md
USING (
    SELECT "id", row_number() OVER (PARTITION BY "menu_id", "item_id" ORDER BY "created_at", "id") AS rn
    FROM "public"."menu_drinks"
    WHERE "off_at" IS NULL AND "menu_id" IS NOT NULL AND "item_id" IS NOT NULL
) d
WHERE md."id" = d."id" AND d.rn > 1;

CREATE UNIQUE INDEX "menu_drinks_menu_item_live_key" ON "public"."menu_drinks" ("menu_id", "item_id") WHERE "off_at" IS NULL;

CREATE OR REPLACE FUNCTION "private"."move_menu_history_to_venue"("p_bar_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    e record;
    v_menu uuid;
    v_section uuid;
    v_start timestamptz;
    v_last_month timestamptz;
    v_end timestamptz;
    v_moved integer := 0;
BEGIN
    IF p_bar_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.bar_id = p_bar_id) THEN
        RETURN 0;
    END IF;
    FOR e IN
        SELECT pe.*
        FROM public.profile_menu_editions pe
        JOIN public.profiles p ON p.id = pe.profile_id
        WHERE p.bar_id = p_bar_id AND p.kind = 'bar'
        ORDER BY pe.year, pe.month NULLS FIRST, pe.created_at
    LOOP
        v_start := make_timestamptz(e.year, COALESCE(e.month, 1), 1, 12, 0, 0, 'UTC');
        v_last_month := CASE
            WHEN e.end_year IS NOT NULL THEN make_timestamptz(e.end_year, COALESCE(e.end_month, 12), 1, 12, 0, 0, 'UTC')
            WHEN e.month IS NULL THEN v_start + interval '11 months'
            ELSE v_start
        END;
        IF v_last_month < v_start THEN
            v_last_month := v_start;
        END IF;
        -- The last day of the last month.
        v_end := CASE WHEN e.is_current THEN NULL ELSE v_last_month + interval '1 month' - interval '1 day' END;

        INSERT INTO public.menus (bar_id, name, kind, description, starts_at, ends_at, created_by)
        VALUES (p_bar_id, e.name, 'menu', e.theme, v_start, v_end, NULL)
        RETURNING id INTO v_menu;
        INSERT INTO public.menu_sections (menu_id, name, sort_order, min_items)
        VALUES (v_menu, 'Drinks', 0, 0)
        RETURNING id INTO v_section;
        INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order)
        SELECT v_menu, v_section, d.item_id, d.sort_order
        FROM public.profile_menu_edition_drinks d
        WHERE d.edition_id = e.id
        ORDER BY d.sort_order
        ON CONFLICT (menu_id, item_id) WHERE off_at IS NULL DO NOTHING;

        DELETE FROM public.profile_menu_editions WHERE id = e.id;
        v_moved := v_moved + 1;
    END LOOP;
    RETURN v_moved;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."save_menu"(
    "p_menu_id" "uuid",
    "p_name" "text",
    "p_cover_url" "text",
    "p_cover_position" real,
    "p_sections" "jsonb",
    "p_cover_credit" "text" DEFAULT NULL
) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  sec jsonb;
  sec_id uuid;
  sec_index integer := 0;
  drink_index integer := 0;
  v_item uuid;
  item_kind text;
  types text[];
  kept uuid[] := '{}';
  kept_drinks uuid[] := '{}';
  seen_items uuid[] := '{}';
  row_id uuid;
  this_item uuid;
  menu_bar uuid;
  has_prices boolean;
  item_ord bigint;
  menu_price text;
BEGIN
  IF jsonb_typeof(p_sections) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'sections must be a list' USING ERRCODE = '22023';
  END IF;

  UPDATE public.menus
  SET name = btrim(p_name), cover_url = p_cover_url, cover_position = COALESCE(p_cover_position, 50)
  WHERE id = p_menu_id
  RETURNING bar_id INTO menu_bar;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu not found or not yours to edit' USING ERRCODE = '42501';
  END IF;

  -- The cover's credit, after the cover: a new cover has just dropped the old
  -- credit (private.menu_cover_credit), and a credit sent here is the new
  -- photo's, even when it reads the same as the old one.
  IF p_cover_credit IS NOT NULL THEN
    UPDATE public.menus SET cover_credit = NULLIF(btrim(p_cover_credit), '') WHERE id = p_menu_id;
  END IF;

  FOR sec IN SELECT value FROM jsonb_array_elements(p_sections) LOOP
    types := COALESCE(
      (SELECT array_agg(t) FROM jsonb_array_elements_text(sec->'allowed_types') t),
      ARRAY['cocktail', 'beer', 'wine']
    );
    sec_id := NULLIF(sec->>'id', '')::uuid;
    IF sec_id IS NOT NULL THEN
      UPDATE public.menu_sections
      SET name = btrim(sec->>'name'),
          sort_order = sec_index,
          min_items = COALESCE((sec->>'min_items')::integer, 1),
          max_items = (sec->>'max_items')::integer,
          allowed_types = types
      WHERE id = sec_id AND menu_id = p_menu_id;
      IF NOT FOUND THEN
        sec_id := NULL;
      END IF;
    END IF;
    IF sec_id IS NULL THEN
      INSERT INTO public.menu_sections (menu_id, name, sort_order, min_items, max_items, allowed_types)
      VALUES (p_menu_id, btrim(sec->>'name'), sec_index, COALESCE((sec->>'min_items')::integer, 1),
              (sec->>'max_items')::integer, types)
      RETURNING id INTO sec_id;
    END IF;
    kept := kept || sec_id;
    -- This menu's prices, one for each of item_ids, when the app sends them.
    has_prices := jsonb_typeof(sec->'prices') = 'array';

    FOR v_item, item_ord IN SELECT value::uuid, ordinality FROM jsonb_array_elements_text(COALESCE(sec->'item_ids', '[]'::jsonb)) WITH ORDINALITY LOOP
      -- A drink sent twice is on the menu once.
      IF v_item = ANY (seen_items) THEN
        CONTINUE;
      END IF;
      seen_items := seen_items || v_item;
      SELECT i.item_type::text INTO item_kind FROM public.items i WHERE i.id = v_item;
      IF item_kind IS NULL AND menu_bar IS NULL THEN
        SELECT p.item_type::text INTO item_kind FROM public.published_items p WHERE p.id = v_item AND NOT p.is_reference;
      END IF;
      IF item_kind IS NULL THEN
        RAISE EXCEPTION 'drink % not found', v_item USING ERRCODE = '22023';
      END IF;
      IF NOT item_kind = ANY (types) THEN
        RAISE EXCEPTION '% is not allowed in section %', item_kind, sec->>'name' USING ERRCODE = '22023';
      END IF;
      menu_price := CASE WHEN has_prices THEN NULLIF(btrim(sec->'prices'->>(item_ord - 1)::integer), '') END;
      -- The drink's row from before the save, if it's still on the menu: its
      -- serves, run sheet swaps and (with no prices sent) price stay with it.
      this_item := v_item;
      SELECT md.id INTO row_id FROM public.menu_drinks md
      WHERE md.menu_id = p_menu_id AND md.item_id = this_item AND NOT (md.id = ANY (kept_drinks))
      ORDER BY md.sort_order, md.id
      LIMIT 1;
      IF row_id IS NOT NULL THEN
        UPDATE public.menu_drinks
        SET menu_section_id = sec_id, sort_order = drink_index,
            price = CASE WHEN has_prices THEN menu_price ELSE price END
        WHERE id = row_id;
      ELSE
        INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order, price)
        VALUES (p_menu_id, sec_id, v_item, drink_index, menu_price)
        ON CONFLICT (menu_id, item_id) WHERE off_at IS NULL DO NOTHING
        RETURNING id INTO row_id;
        -- Already on the menu (a save at the same moment): keep that row.
        IF row_id IS NULL THEN
          SELECT md.id INTO row_id FROM public.menu_drinks md
          WHERE md.menu_id = p_menu_id AND md.item_id = this_item AND md.off_at IS NULL;
        END IF;
      END IF;
      kept_drinks := kept_drinks || row_id;
      drink_index := drink_index + 1;
    END LOOP;
    sec_index := sec_index + 1;
  END LOOP;

  DELETE FROM public.menu_drinks WHERE menu_id = p_menu_id AND NOT (id = ANY (kept_drinks));
  DELETE FROM public.menu_sections WHERE menu_id = p_menu_id AND NOT (id = ANY (kept));
END;
$$;

-- The record of a drink taken off a menu skips a merge's clash delete. Same
-- as 20261203100000_lists_and_runs.sql otherwise.
CREATE OR REPLACE FUNCTION "private"."record_menu_drink_removed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF current_setting('app.merging_item', true) = 'on' THEN
        RETURN NULL;
    END IF;
    -- The joins find nothing when the menu or the drink is the row being
    -- deleted (a cascade), so only a drink taken off a live list is kept.
    INSERT INTO public.menu_drinks_removed (
        menu_id, item_id, section_name, price, went_on, came_off, taken_off_by, added_by, replaces_item_id, slot_name
    )
    SELECT m.id, i.id, s.name, coalesce(OLD.price, nullif(btrim(i.price), '')),
           x.went_on, greatest(x.went_on, least(coalesce(OLD.off_at, now()), now())),
           coalesce(OLD.off_by, auth.uid()), OLD.added_by, OLD.replaces_item_id, OLD.slot_name
    FROM public.menus m
    JOIN public.items i ON i.id = OLD.item_id
    LEFT JOIN public.menu_sections s ON s.id = OLD.menu_section_id
    -- A row dated ahead (a script, a skewed clock) went on no later than now.
    CROSS JOIN LATERAL (SELECT least(greatest(coalesce(OLD.on_from, m.starts_at), m.starts_at), now()) AS went_on) x
    WHERE m.id = OLD.menu_id
      AND private.menu_on_now(m.starts_at, m.ends_at)
      AND OLD.waiting IS DISTINCT FROM 'on'
      AND coalesce(OLD.on_from, m.starts_at) <= now();
    RETURN NULL;
END;
$$;


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
        -- The copy's spec moves, with its parts (20261123100000): lines and
        -- methods keep their part, so p_into takes the parts' names too.
        UPDATE public.items SET parts = v_from.parts WHERE id = p_into AND parts IS NULL;
        -- The copy's spec moves; its steps and versions only when p_into has none.
        IF EXISTS (SELECT 1 FROM public.item_steps WHERE item_id = p_into) THEN
            DELETE FROM public.item_steps WHERE item_id = p_from;
        END IF;
        IF EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_into) THEN
            DELETE FROM public.item_versions WHERE item_id = p_from;
        END IF;
    END IF;
    -- Figures kept aside for a bar-credited drink (20261008050000) only
    -- follow onto another bar-credited drink, and so do its notes: any other
    -- copy's notes went with its row, as they did on items.notes.
    IF NOT private.is_bar_credited_drink(v_into.bar_id, v_into.is_catalog, v_into.created_by, v_into.origin_bar_profile_id) THEN
        DELETE FROM public.credited_drink_details WHERE item_id = p_from;
    END IF;
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

    -- The same drink can't be on one menu twice (menu_drinks_menu_item_live_key):
    -- where both copies are live on a menu, the copy's row goes, kept in the
    -- merge record like any other dropped row. Its run sheet swaps go with it,
    -- and the record of a drink taken off (private.record_menu_drink_removed)
    -- is not written: the drink stays on the menu.
    PERFORM set_config('app.merging_item', 'on', true);
    WITH gone AS (
        DELETE FROM public.menu_drinks f
         WHERE f.item_id = p_from AND f.off_at IS NULL
           AND EXISTS (SELECT 1 FROM public.menu_drinks k WHERE k.menu_id = f.menu_id AND k.item_id = p_into AND k.off_at IS NULL)
        RETURNING to_jsonb(f) AS dropped_row
    )
    UPDATE private.item_merges m
       SET snapshot = jsonb_set(m.snapshot, '{dropped}', COALESCE(m.snapshot -> 'dropped', '[]')
                      || (SELECT jsonb_agg(jsonb_build_object('table', 'public.menu_drinks', 'row', g.dropped_row)) FROM gone g))
     WHERE m.from_id = p_from AND EXISTS (SELECT 1 FROM gone);
    PERFORM set_config('app.merging_item', '', true);

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
            -- takes p_from's own link instead (the based-on link only when
            -- it's the same kind); any other link is cleared.
            EXECUTE format('UPDATE public.items i SET %1$I = %2$s FROM public.items f WHERE f.id = $1 AND i.id = $2 AND i.%1$I = $1',
                           v_fk.column_name,
                           CASE WHEN v_fk.column_name IN ('riff_of_id', 'spec_from_id', 'lineage_parent_id')
                                THEN format('NULLIF(f.%I, $2)', v_fk.column_name)
                                WHEN v_fk.column_name = 'based_on_id'
                                THEN 'CASE WHEN f.based_on_kind = i.based_on_kind THEN NULLIF(f.based_on_id, $2) END'
                                ELSE 'NULL' END)
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
