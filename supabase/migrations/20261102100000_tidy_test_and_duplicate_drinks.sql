-- Data tidy from the 22 Oct 2026 database audit. Local stack only until
-- Kevin's OK.
--
-- 1. Three test drinks at Caretaker's Cottage ("Test", "Testing stuff",
--    "Testing hi") go. Nothing real points at them: no menu, ranking, note,
--    draft or credit, only rows worked out from them (sketches, flavours,
--    "Testing hi"'s four spec lines, its method and two photos). The photos'
--    and retired sketches' image rows go too; the files stay in storage for
--    the storage sweep (audit 3.5). Before it goes, every foreign key to
--    items (and the ids held without one) is checked; a test drink anything
--    real points at stays, with a notice.
--
-- 2. Seventeen famous drinks were stored twice under the same bar. In each
--    pair one is the catalog classic (the family tree's: credit, year, glass,
--    history, sources, riffs, readable link) and the other is an older seeded
--    copy of the bar's menu that 20260930950000 / 20261008950100 linked to it
--    as a "version" (riff_of_id). The classic is kept in every pair; the copy
--    is merged into it by private.merge_item() below:
--      * what points at the copy moves to the classic (menu history, menus,
--        rankings, saves, riffs, photos, credits, sources, picks...);
--      * the copy's own spec and what was worked out from it (spec lines,
--        method, steps, versions, flavours, allergens, sketches and their
--        pictures, Discover facts, spec match, bar-credited notes and
--        figures) go, as the classic has its own;
--      * someone who ranked both keeps the classic's ranking, with the
--        copy's comparisons, photos and made drinks moved onto it;
--      * the copy's row and its spec are kept in private.item_merges, so the
--        old id can still be looked up.
--    Its readable link (e.g. paper-plane-498f) goes with it; the classic keeps
--    the plain one (paper-plane).
--
-- 3. The method "Flask Pour" was there twice, made 20 seconds apart, the same
--    in every field and used by nothing: the later one merges into the first.
--
-- 4. Kevin, 22 Oct: "Link all three workspaces to their pages and move Three
--    Horses' menu onto the team." Three Horses, Happiness Forgets and
--    Parkville Palace each have a workspace (bars) and an unclaimed bar page
--    (profiles) of the same name, with no link between them. Each page is
--    linked the way hand_over_claim links an approved bar claim: the page
--    stays at 'description' (what it shows today, and what an approval with
--    no settings gives), it gets bar_id and claimed_at, invitees who already
--    said yes join, and any pending claim on the page is turned down. Linking
--    a staffed bar's page moves its researched menus onto the team
--    (venue_takes_menu_history, 20261017600000); Three Horses' one menu is
--    moved by the explicit call after it too.
--
-- Every step names production ids checked read-only on 22 Oct 2026 and only
-- acts while the rows still look as they did then, so a rerun, or a row
-- already gone, changes nothing.

-- --- A record of merged items ---

CREATE TABLE IF NOT EXISTS "private"."item_merges" (
    "from_id" "uuid" PRIMARY KEY,
    -- Null once the kept item is deleted too; the snapshot stays.
    "into_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    -- The merged-away row, its spec lines and its bar-credited notes, as they were.
    "snapshot" "jsonb" NOT NULL,
    "merged_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX IF NOT EXISTS "item_merges_into_idx" ON "private"."item_merges" ("into_id");
ALTER TABLE "private"."item_merges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."item_merges" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "private"."item_merges" TO "service_role";

-- --- Merging a copy of a drink or method into the one we keep ---

-- private.merge_ingredient (20261008900000) for everything that isn't an
-- ingredient: moves every reference to p_from onto p_into and deletes p_from.
-- Works off the catalog of foreign keys, so a table added later is covered.
-- A row that would then clash (p_into already has one) keeps p_into's, but
-- only when that drops nothing else: a clash in items, or in a table other
-- rows hang off (rank_entries is settled first), stops the merge instead.
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
           AND NOT EXISTS (SELECT 1 FROM public.made_drinks m WHERE m.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM private.retired_drink_sketches r WHERE r.image_id = im.id);
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
        UPDATE public.rank_entries SET profile_pin = v_pin WHERE id = v_dup.keep_id AND profile_pin IS NULL AND v_pin IS NOT NULL;
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
                    EXECUTE format('DELETE FROM %I.%I WHERE ctid = $1', v_fk.schema_name, v_fk.table_name) USING v_ctid;
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
    UPDATE private.retired_drink_sketches SET item_id = p_into WHERE item_id = p_from;
    DELETE FROM private.item_flavor_jobs WHERE item_id = p_from;
    DELETE FROM private.item_image_jobs WHERE item_id = p_from;
    PERFORM private.discover_mark(ARRAY[p_into]);

    DELETE FROM public.items WHERE id = p_from;

    PERFORM set_config('app.image_worker', COALESCE(v_worker, ''), true);
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."merge_item"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- 1. The test drinks ---

CREATE TEMP TABLE "tidy_test_drinks" ("id" "uuid", "name" "text") ON COMMIT DROP;
INSERT INTO "tidy_test_drinks" VALUES
    ('cc7e22e2-907e-4aa1-bc05-a1be451cb9a9', 'Test'),
    ('5ec3ebce-0d1f-4523-a784-ae50103f0db0', 'Testing stuff'),
    ('89a0d3d5-daaa-4d06-9789-0e374e376547', 'Testing hi');

-- Only while each is still that test drink at Caretaker's Cottage.
DELETE FROM "tidy_test_drinks" t
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.id = t.id AND i.name = t.name AND i.item_type = 'cocktail'
      AND i.bar_id = '532e5250-161e-4439-b8d1-9dd4b403ef19'
);

-- And only while nothing real points at it. Every foreign key to items is
-- checked (so a table added later is too), plus the ids held without one;
-- only rows worked out from the drink itself may go with it. Anything else
-- keeps the drink, with a notice, rather than cascading away.
DO $$
DECLARE
    t record;
    v_fk record;
    v_found boolean;
BEGIN
    FOR t IN SELECT id, name FROM pg_temp.tidy_test_drinks LOOP
        v_found := EXISTS (SELECT 1 FROM public.bring_in_batches b WHERE t.id = ANY (b.item_ids))
                OR EXISTS (SELECT 1 FROM public.profile_picks p WHERE p.target_id = t.id);
        IF v_found THEN
            RAISE NOTICE 'Keeping test drink % (%): a bring-in or a profile pick names it.', t.name, t.id;
        END IF;
        FOR v_fk IN
            SELECT n.nspname AS schema_name, c2.relname AS table_name, a.attname AS column_name
              FROM pg_constraint c
              JOIN pg_class c2 ON c2.oid = c.conrelid
              JOIN pg_namespace n ON n.oid = c2.relnamespace
              CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS k(attnum, refnum)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
              JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.refnum
             WHERE c.contype = 'f' AND c.confrelid = 'public.items'::regclass AND ra.attname = 'id'
               AND (n.nspname || '.' || c2.relname || '.' || a.attname) <> ALL (ARRAY[
                   -- Worked out from the drink, or its own spec, method and pictures.
                   'public.recipes.recipe_item_id',
                   'public.item_methods.item_id',
                   'public.item_flavors.item_id',
                   'public.item_sketches.item_id',
                   'public.item_images.item_id',
                   'public.discover_drink_facts.item_id',
                   'private.item_sketch_ai.item_id',
                   'private.item_spec_matches.item_id',
                   'private.share_slugs.item_id'])
        LOOP
            EXIT WHEN v_found;
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)', v_fk.schema_name, v_fk.table_name, v_fk.column_name)
              INTO v_found USING t.id;
            IF v_found THEN
                RAISE NOTICE 'Keeping test drink % (%): %.%.% points at it.', t.name, t.id, v_fk.schema_name, v_fk.table_name, v_fk.column_name;
            END IF;
        END LOOP;
        IF v_found THEN
            DELETE FROM pg_temp.tidy_test_drinks WHERE id = t.id;
        END IF;
    END LOOP;
END;
$$;

CREATE TEMP TABLE "tidy_test_images" ON COMMIT DROP AS
SELECT ii.image_id AS id FROM "public"."item_images" ii JOIN "tidy_test_drinks" t ON t.id = ii.item_id
UNION
SELECT r.image_id FROM "private"."retired_drink_sketches" r JOIN "tidy_test_drinks" t ON t.id = r.item_id WHERE r.image_id IS NOT NULL;

DELETE FROM "private"."retired_drink_sketches" r USING "tidy_test_drinks" t WHERE r.item_id = t.id;
DELETE FROM "private"."item_flavor_jobs" j USING "tidy_test_drinks" t WHERE j.item_id = t.id;
DELETE FROM "private"."item_image_jobs" j USING "tidy_test_drinks" t WHERE j.item_id = t.id;
DELETE FROM "public"."items" i USING "tidy_test_drinks" t WHERE i.id = t.id;

-- Their pictures, when nothing else shows them.
DELETE FROM "public"."images" im USING "tidy_test_images" x
WHERE im.id = x.id
  AND NOT EXISTS (SELECT 1 FROM "public"."item_images" ii WHERE ii.image_id = im.id)
  AND NOT EXISTS (SELECT 1 FROM "public"."drink_photos" p WHERE p.image_id = im.id)
  AND NOT EXISTS (SELECT 1 FROM "public"."made_drinks" m WHERE m.image_id = im.id)
  AND NOT EXISTS (SELECT 1 FROM "private"."retired_drink_sketches" r WHERE r.image_id = im.id);

-- --- 2 and 3. Duplicates ---

SET "app.image_worker" = 'on';

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT v.from_id::uuid AS from_id, v.into_id::uuid AS into_id
        FROM (VALUES
            -- copy, classic kept, name
            ('e83ea9e1-84fd-440c-83c3-db98fca4ed1d', 'f7101017-f46d-4769-bc1f-48b90c6202f6', 'Barrel-Aged Negroni'),
            ('03f88f2e-b7b5-4c09-a496-ce1e1ccb2fc6', '28a26617-fa40-4b85-94a1-d2c0e258d465', 'Batanga'),
            ('5fa02769-ea65-483d-95b0-8cd8939461f4', '6382ae66-143a-4dfc-adfc-720d797f2fda', 'Benton''s Old Fashioned'),
            ('738f4be9-544e-4d75-9c3b-001261b90d9c', '621a801a-9146-4587-871e-f1edb6926cc9', 'Boulevardier'),
            ('7cb1851f-71a4-48b3-b7df-c413726446bd', '91f538c9-fdf1-4951-a73f-3b51ad305bf0', 'Death in Venice'),
            ('0540a9ce-1808-4e68-a8be-37f97bf865da', '082c1b79-598d-435d-ba18-a5f31376001d', 'Dukes Martini'),
            ('b70182a3-ffa1-4a25-aa50-2b646ed6e367', '8962a4d0-c6f4-4435-8863-1e721967374a', 'Gin Basil Smash'),
            ('7874ceee-99b4-443c-9c2b-c77a6644090f', '3e4415ff-a69a-428b-b075-9a9ede4db400', 'Hanky Panky'),
            ('e7cbfe60-8754-4dc9-a4bc-33b38b4fde23', 'c6b9d5ca-b4da-4864-b2fd-20f08a23a5d2', 'Lost Lake'),
            ('15c2df79-d2dc-445d-a177-05996eb49b59', '318431ef-c5db-4c0e-9880-7297aacd5384', 'Mulata Daisy'),
            ('4ce34fd2-bd69-462a-95ee-764304ac6172', 'f7007fb3-4ea8-4897-9f60-51d49010cb15', 'Naked and Famous'),
            ('498f2055-8b8f-41d1-bc8d-b489ea50e5c8', '407ccfd2-04ac-4f30-9a01-d90efac79b26', 'Paper Plane'),
            ('3072fdc2-6923-4287-809f-dbee46b92508', '16581d2f-ef5d-414c-bc03-f49b33fbe604', 'Pink Squirrel'),
            ('d1df0d05-383a-49ec-bf2f-257f52806bda', '8008ccc1-5dd3-447e-8974-b6d3cb70b142', 'Rapscallion'),
            ('a13a3ffc-8016-4814-83a7-5e68e4a2c0d8', '05d85ec3-51f0-44e2-b765-95317e14c3de', 'Serendipity'),
            ('03647619-eaa0-42f7-83dc-2e098ca71a27', 'a1ea0922-bfa0-4ef3-9c0c-c4dbb2939175', 'Singapore Sling'),
            ('5211b0e4-ce97-40bd-9bca-07acb70a43f8', 'ab6e63df-54ef-463b-b984-030e22347f65', 'Tommy''s Margarita')
        ) AS v(from_id, into_id, name)
        JOIN public.items c ON c.id = v.from_id::uuid
        JOIN public.items k ON k.id = v.into_id::uuid
        -- Still the same drink at the same bar: the copy a version of the classic.
        WHERE c.name = v.name AND k.name = v.name
          AND c.item_type = 'cocktail' AND k.item_type = 'cocktail'
          AND c.bar_id IS NULL AND k.bar_id IS NULL
          AND k.is_catalog AND NOT c.is_catalog
          AND c.riff_of_id = k.id
          AND c.origin_bar_profile_id = k.origin_bar_profile_id
    LOOP
        PERFORM private.merge_item(r.from_id, r.into_id);
    END LOOP;

    -- Flask Pour: the later copy into the first.
    IF EXISTS (SELECT 1 FROM public.items WHERE id = '322ea2db-bd8c-4b1c-8818-39ebf4ce56ba' AND item_type = 'method' AND name = 'Flask Pour' AND bar_id IS NULL)
       AND EXISTS (SELECT 1 FROM public.items WHERE id = 'dd42acb0-026e-43be-8f79-6907971d15e0' AND item_type = 'method' AND name = 'Flask Pour' AND bar_id IS NULL) THEN
        PERFORM private.merge_item('322ea2db-bd8c-4b1c-8818-39ebf4ce56ba', 'dd42acb0-026e-43be-8f79-6907971d15e0');
    END IF;
END;
$$;

RESET "app.image_worker";

-- --- 4. Workspaces and their pages ---

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT v.bar_id::uuid AS bar_id, v.profile_id::uuid AS profile_id
        FROM (VALUES
            -- workspace, page, name
            ('76ad06f3-639e-4950-9f44-5e2140dbbaf1', '4d770f6f-cf2e-4a8a-9a8e-1e379226ca11', 'Three Horses'),
            ('54ca9a3c-3e2c-4c6e-97ba-6caf92adc8d5', 'f076ad88-29a3-401a-8289-03cfd113165b', 'Happiness Forgets'),
            ('1487ad58-e48d-4f74-853d-16d3a4b73b1c', '052d5f79-90a1-4de8-bb76-8b57d7cdecf1', 'Parkville Palace')
        ) AS v(bar_id, profile_id, name)
        JOIN public.bars b ON b.id = v.bar_id::uuid AND b.name = v.name
        JOIN public.profiles p ON p.id = v.profile_id::uuid AND p.display_name = v.name
        -- Still an unclaimed bar page, and the workspace has no page yet.
        WHERE p.kind = 'bar' AND p.bar_id IS NULL AND p.user_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.profiles o WHERE o.bar_id = b.id)
    LOOP
        UPDATE public.bars SET page_visibility = 'description' WHERE id = r.bar_id;
        UPDATE public.profiles SET bar_id = r.bar_id, claimed_at = now() WHERE id = r.profile_id;

        INSERT INTO public.user_bars (user_id, bar_id, role_level)
        SELECT i.accepted_by, i.bar_id, i.role_level FROM public.bar_invites i
        WHERE i.bar_id = r.bar_id AND i.accepted_by IS NOT NULL
        ON CONFLICT (user_id, bar_id) DO NOTHING;
        DELETE FROM public.bar_invites WHERE bar_id = r.bar_id AND accepted_by IS NOT NULL;

        UPDATE public.profile_claims
        SET status = 'rejected', decline_reason = 'This page is now linked to its venue.', reviewed_at = now()
        WHERE profile_id = r.profile_id AND status = 'pending';
    END LOOP;
END;
$$;

-- Three Horses' researched menu becomes the team's (AGENTS.md "Bar menus").
-- Linking above already did it through venue_takes_menu_history; this call
-- is a no-op then, and does it when the page was linked some other way. It
-- moves nothing for a bar with no staff, so check what's left: a staffed
-- workspace among the three must have no research history on its page.
DO $$
DECLARE
    v_left integer;
BEGIN
    PERFORM private.move_menu_history_to_venue('76ad06f3-639e-4950-9f44-5e2140dbbaf1');
    SELECT count(*) INTO v_left
      FROM public.profile_menu_editions e
      JOIN public.profiles p ON p.id = e.profile_id AND p.kind = 'bar'
     WHERE p.bar_id IN ('76ad06f3-639e-4950-9f44-5e2140dbbaf1', '54ca9a3c-3e2c-4c6e-97ba-6caf92adc8d5', '1487ad58-e48d-4f74-853d-16d3a4b73b1c')
       AND EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.bar_id = p.bar_id);
    IF v_left > 0 THEN
        RAISE EXCEPTION '% researched menus are still on a staffed workspace''s page.', v_left;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_bars WHERE bar_id = '76ad06f3-639e-4950-9f44-5e2140dbbaf1') THEN
        RAISE NOTICE 'Three Horses has no staff: its menu stays as research history.';
    END IF;
END;
$$;
