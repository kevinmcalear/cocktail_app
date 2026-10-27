-- Glass and ice kinds (docs/glass_ice_kinds.md, approved by Kevin 26 Oct):
-- a shared glass or ice item says what kind it is, so nothing works out an
-- item's kind from its name.
--
-- 1. private.is_glass_type: the 16 glass types in one place. glass_models,
--    bar_glassware, home_glassware and valid_glass_variant check against it.
-- 2. items.glass (a glassware item's type) and items.ice_kind (how an ice item
--    is drawn in the glass, 'none' for "served without ice"). Null is not sure.
-- 3. A venue's ice keeps its shape in item_ice; how it's drawn moves from
--    item_ice.draw_as to items.ice_kind, and follows the shape. venue_ice()
--    still returns draw_as and save_venue_ice still takes p_draw_as, for app
--    builds from before this migration.
-- 4. A saved drawing takes its glass and ice from the drink's items when they
--    say (set_glass_and_ice, before set_house_ice), and the build triggers read
--    items.ice_kind. private.ice_kind(name) is dropped.
-- 5. Only an admin changes a shared item's kind once it exists; a change
--    redraws every drink with it.
-- 6. Backfill, by name, of production's 26 glass and 10 ice items (as the app's
--    name rules read them on 26 Oct), Kevin's calls: "Rocks & Crushed ice"
--    becomes Rocks (plus Crushed on a drink that names no ice), the two
--    "No Ice" rows become one, "Custom" stays not sure. Setting a kind redraws
--    its drinks (refresh_kind), which puts right the 8 drawings in production
--    whose glass disagreed with their glassware on 26 Oct.

-- None of this may queue paid pictures or sketches (merge_item does the same).
SELECT set_config('app.image_worker', 'on', true);

-- --- 1. The glass types, once ---

CREATE FUNCTION "private"."is_glass_type"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
               'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer');
$$;

-- How an ice is drawn in the glass ('none': served without ice).
CREATE FUNCTION "private"."is_ice_kind"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p IN ('none', 'cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere');
$$;

-- CHECKs run as the writer, like valid_glass_variant.
REVOKE EXECUTE ON FUNCTION "private"."is_glass_type"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."is_glass_type"("text") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."is_ice_kind"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."is_ice_kind"("text") TO "authenticated", "service_role";

ALTER TABLE "public"."glass_models" DROP CONSTRAINT "glass_models_glass_check",
    ADD CONSTRAINT "glass_models_glass_check" CHECK ("private"."is_glass_type"("glass"));
ALTER TABLE "public"."bar_glassware" DROP CONSTRAINT "bar_glassware_glass_check",
    ADD CONSTRAINT "bar_glassware_glass_check" CHECK ("private"."is_glass_type"("glass"));
ALTER TABLE "public"."home_glassware" DROP CONSTRAINT "home_glassware_glass_check",
    ADD CONSTRAINT "home_glassware_glass_check" CHECK ("private"."is_glass_type"("glass"));

-- As 20261007100000_glass_variants.sql, with the types from is_glass_type.
CREATE OR REPLACE FUNCTION "private"."valid_glass_variant"("p_glass" "text", "p_variant" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_variant ~ '^[a-z]+_[a-z]+$' AND char_length(p_variant) <= 40
     AND split_part(p_variant, '_', 1) = p_glass
     AND private.is_glass_type(p_glass);
$$;

-- --- 2. The kinds on items ---

ALTER TABLE "public"."items"
    ADD COLUMN "glass" "text",
    ADD COLUMN "ice_kind" "text",
    ADD CONSTRAINT "items_glass_kind" CHECK ("glass" IS NULL OR ("item_type" = 'glassware' AND "private"."is_glass_type"("glass"))),
    ADD CONSTRAINT "items_ice_kind" CHECK ("ice_kind" IS NULL OR ("item_type" = 'ice' AND "private"."is_ice_kind"("ice_kind")));

COMMENT ON COLUMN "public"."items"."glass" IS
    'A glassware item''s type (private.is_glass_type): how drinks in it are drawn. Null is not sure. Only an admin changes it once set.';
COMMENT ON COLUMN "public"."items"."ice_kind" IS
    'How an ice item is drawn in the glass (private.is_ice_kind; none is served without ice). Null is not sure, or a block or slab. A venue''s ice: follows item_ice.shape. A shared one: only an admin changes it once set.';

-- --- 3. A venue's ice: drawn as items.ice_kind ---

-- How a venue's ice of this shape is drawn: its shape, or for one cut to size
-- or something else the kind picked for it; never a block or slab.
CREATE FUNCTION "private"."venue_ice_kind"("p_shape" "text", "p_pick" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_shape IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere') THEN p_shape
    WHEN p_shape IN ('cut', 'other') AND p_pick IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere') THEN p_pick
  END;
$$;

UPDATE public.items i SET ice_kind = private.venue_ice_kind(x.shape, x.draw_as)
FROM public.item_ice x
WHERE x.item_id = i.id;

-- A change of shape carries the kind with it (a cut ice keeps the kind it was picked).
CREATE FUNCTION "private"."item_ice_set_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.items i SET ice_kind = private.venue_ice_kind(NEW.shape, i.ice_kind)
    WHERE i.id = NEW.item_id AND i.ice_kind IS DISTINCT FROM private.venue_ice_kind(NEW.shape, i.ice_kind);
    RETURN NULL;
END;
$$;

CREATE TRIGGER "set_ice_kind" AFTER INSERT OR UPDATE OF "shape" ON "public"."item_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_ice_set_kind"();

-- As 20261110100000_kit_and_ice.sql, with draw_as read from the item.
CREATE OR REPLACE FUNCTION "public"."venue_ice"("p_bar_id" "uuid") RETURNS TABLE (
    "id" "uuid", "name" "text", "shape" "text", "draw_as" "text", "size_mm" integer, "length_mm" integer,
    "clear" boolean, "stamped" boolean, "frozen_inside" "text", "source" "text", "supplier_id" "uuid",
    "supplier_name" "text", "machine" "text", "note" "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT i.id, i.name, x.shape, CASE WHEN x.shape IN ('cut', 'other') THEN i.ice_kind END,
         x.size_mm, x.length_mm, x.clear, x.stamped, x.frozen_inside, x.source, x.supplier_id,
         (SELECT s.name FROM public.suppliers s
          WHERE s.id = x.supplier_id
            AND (s.bar_id IN (SELECT private.bars_with_capability('prep')) OR s.bar_id IN (SELECT private.bars_with_capability('costs')) OR private.is_app_admin())),
         x.machine, x.note
  FROM public.item_ice x
  JOIN public.items i ON i.id = x.item_id
  WHERE x.bar_id = p_bar_id
    AND (p_bar_id IN (SELECT private.my_bar_ids(0)) OR private.is_app_admin())
  ORDER BY i.created_at, i.id;
$$;

-- As 20261110100000_kit_and_ice.sql: p_draw_as is now the item's ice_kind,
-- written after item_ice so it's checked against the new shape.
CREATE OR REPLACE FUNCTION "public"."save_venue_ice"(
    "p_bar_id" "uuid", "p_name" "text", "p_shape" "text", "p_id" "uuid" DEFAULT NULL,
    "p_draw_as" "text" DEFAULT NULL, "p_size_mm" integer DEFAULT NULL, "p_length_mm" integer DEFAULT NULL,
    "p_clear" boolean DEFAULT NULL, "p_stamped" boolean DEFAULT false, "p_frozen_inside" "text" DEFAULT NULL,
    "p_source" "text" DEFAULT NULL, "p_supplier_id" "uuid" DEFAULT NULL, "p_machine" "text" DEFAULT NULL, "p_note" "text" DEFAULT NULL
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid := p_id;
    v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
    v_kind text := private.venue_ice_kind(p_shape, p_draw_as);
BEGIN
    IF auth.uid() IS NULL OR NOT (p_bar_id IN (SELECT private.bars_with_capability('prep')) OR private.is_app_admin()) THEN
        RAISE EXCEPTION 'Changing a venue''s ice needs Prep there.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
        RAISE EXCEPTION 'An ice needs a name of up to 80 characters.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_draw_as IS NOT NULL AND v_kind IS DISTINCT FROM p_draw_as THEN
        RAISE EXCEPTION 'Only an ice cut to size or something else is drawn as another kind.' USING ERRCODE = 'check_violation';
    END IF;
    IF v_id IS NULL THEN
        INSERT INTO public.items (name, item_type, bar_id, created_by)
        VALUES (v_name, 'ice', p_bar_id, auth.uid())
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.items SET name = v_name
        WHERE id = v_id AND item_type = 'ice' AND bar_id = p_bar_id AND name IS DISTINCT FROM v_name;
        IF NOT EXISTS (SELECT 1 FROM public.item_ice WHERE item_id = v_id AND bar_id = p_bar_id) THEN
            RAISE EXCEPTION 'That isn''t this venue''s ice.' USING ERRCODE = 'no_data_found';
        END IF;
    END IF;
    INSERT INTO public.item_ice AS x (item_id, bar_id, shape, size_mm, length_mm, clear, stamped, frozen_inside, source, supplier_id, machine, note)
    VALUES (v_id, p_bar_id, p_shape, p_size_mm, p_length_mm, p_clear, coalesce(p_stamped, false),
            nullif(btrim(p_frozen_inside), ''), p_source, p_supplier_id, nullif(btrim(p_machine), ''), nullif(btrim(p_note), ''))
    ON CONFLICT (item_id) DO UPDATE SET
        shape = excluded.shape, size_mm = excluded.size_mm, length_mm = excluded.length_mm,
        clear = excluded.clear, stamped = excluded.stamped, frozen_inside = excluded.frozen_inside, source = excluded.source,
        supplier_id = excluded.supplier_id, machine = excluded.machine, note = excluded.note;
    UPDATE public.items SET ice_kind = v_kind WHERE id = v_id AND ice_kind IS DISTINCT FROM v_kind;
    RETURN v_id;
END;
$$;

-- As 20261122100000_ice_look_drawings.sql, with the kind from the item.
CREATE OR REPLACE FUNCTION "private"."drawn_ice_look"("p_ice_item" "uuid", "p_bar" "uuid", "p_kind" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(
    (SELECT private.ice_look(x) FROM public.item_ice x
       JOIN public.items i ON i.id = x.item_id
      WHERE x.item_id = p_ice_item AND x.bar_id = p_bar AND i.ice_kind = p_kind),
    (SELECT private.ice_look(x)
       FROM public.item_ice x
       JOIN public.items i ON i.id = x.item_id
      WHERE x.bar_id = p_bar AND i.ice_kind = p_kind
      ORDER BY i.created_at, i.id
      LIMIT 1));
$$;

-- As 20261110100000_kit_and_ice.sql, with the kinds from the items.
CREATE OR REPLACE FUNCTION "private"."item_sketches_set_house_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ice text;
BEGIN
    IF coalesce(NEW.inputs -> 'from' ->> 'ice', '') <> 'data' THEN
        v_ice := private.house_ice(
            NEW.inputs ->> 'ice',
            ARRAY(SELECT i.ice_kind FROM public.item_ice x
                  JOIN public.items i ON i.id = x.item_id
                  WHERE x.bar_id = private.item_kit_bar(NEW.item_id) AND i.ice_kind IS NOT NULL));
    END IF;
    NEW.inputs := CASE WHEN v_ice IS NULL THEN NEW.inputs - 'houseIce'
                       ELSE jsonb_set(NEW.inputs, '{houseIce}', to_jsonb(v_ice)) END;
    RETURN NEW;
END;
$$;

DROP TRIGGER "refresh_house_ice" ON "public"."item_ice";
CREATE TRIGGER "refresh_house_ice" AFTER INSERT OR DELETE OR UPDATE OF "shape", "bar_id", "size_mm", "length_mm", "clear", "stamped", "frozen_inside" ON "public"."item_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."refresh_house_ice"();

ALTER TABLE "public"."item_ice" DROP CONSTRAINT "item_ice_draw_as_cut_or_other", DROP COLUMN "draw_as";

-- --- 4. Drawings take the kinds from the items ---

-- First of item_sketches' triggers (they run by name), so set_house_ice,
-- set_ice_look and set_variant see the drink's own glass and ice.
CREATE FUNCTION "private"."item_sketches_set_glass_and_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_glass text;
    v_ice text;
BEGIN
    SELECT g.glass, x.ice_kind INTO v_glass, v_ice
    FROM public.items d
    LEFT JOIN public.items g ON g.id = d.glassware_id
    LEFT JOIN public.items x ON x.id = d.ice_id
    WHERE d.id = NEW.item_id;
    IF v_glass IS NOT NULL THEN
        NEW.inputs := jsonb_set(jsonb_set(NEW.inputs, '{glass}', to_jsonb(v_glass)), '{from,glass}', '"data"');
    END IF;
    IF v_ice IS NOT NULL THEN
        NEW.inputs := jsonb_set(jsonb_set(NEW.inputs, '{ice}', to_jsonb(v_ice)), '{from,ice}', '"data"');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_glass_and_ice" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_glass_and_ice"();

-- As 20261122100000_ice_look_drawings.sql, with each layer's kind from its item.
CREATE OR REPLACE FUNCTION "private"."item_sketches_set_ice_build"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid := private.item_kit_bar(NEW.item_id);
    v_build jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', x.ice_kind, 'n', l.layer -> 'n', 'to', l.layer -> 'to'))
                     || coalesce(private.drawn_ice_look(x.id, v_bar, x.ice_kind), '{}'::jsonb)
                     ORDER BY l.ord)
    INTO v_build
    FROM public.items i
    CROSS JOIN LATERAL jsonb_array_elements(i.ice_build) WITH ORDINALITY AS l(layer, ord)
    JOIN public.items x ON x.id = (l.layer ->> 'ice')::uuid
    WHERE i.id = NEW.item_id AND jsonb_typeof(i.ice_build) = 'array' AND x.ice_kind IS NOT NULL AND x.ice_kind <> 'none';
    NEW.inputs := CASE WHEN v_build IS NULL THEN NEW.inputs - 'build'
                       ELSE jsonb_set(NEW.inputs, '{build}', v_build) END;
    RETURN NEW;
END;
$$;

DROP FUNCTION "private"."ice_kind"("text");

-- --- 5. Changing a kind ---

-- A shared item's kind is every drink's with it: only an admin changes it
-- (the service role and migrations too). A venue's ice is drawn as its shape.
CREATE FUNCTION "private"."items_guard_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF OLD.bar_id IS NULL AND auth.uid() IS NOT NULL AND NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only an admin can change what kind a shared glass or ice is.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF EXISTS (SELECT 1 FROM public.item_ice x
               WHERE x.item_id = NEW.id AND private.venue_ice_kind(x.shape, NEW.ice_kind) IS DISTINCT FROM NEW.ice_kind) THEN
        RAISE EXCEPTION 'A venue''s ice is drawn as its shape: change it in Kit.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_kind" BEFORE UPDATE OF "glass", "ice_kind" ON "public"."items"
    FOR EACH ROW WHEN (OLD."glass" IS DISTINCT FROM NEW."glass" OR OLD."ice_kind" IS DISTINCT FROM NEW."ice_kind")
    EXECUTE FUNCTION "private"."items_guard_kind"();

-- Redraw the drinks with it, and a venue's own drinks when it's the venue's ice.
CREATE FUNCTION "private"."refresh_item_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.item_sketches s SET inputs = s.inputs
    FROM public.items d
    WHERE d.id = s.item_id
      AND (d.glassware_id = NEW.id OR d.ice_id = NEW.id
           OR d.ice_build @> jsonb_build_array(jsonb_build_object('ice', NEW.id::text))
           OR (NEW.item_type = 'ice' AND NEW.bar_id IS NOT NULL
               AND (d.bar_id = NEW.bar_id
                    OR d.origin_bar_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.bar_id = NEW.bar_id))));
    RETURN NULL;
END;
$$;

CREATE TRIGGER "refresh_kind" AFTER UPDATE OF "glass", "ice_kind" ON "public"."items"
    FOR EACH ROW WHEN (OLD."glass" IS DISTINCT FROM NEW."glass" OR OLD."ice_kind" IS DISTINCT FROM NEW."ice_kind")
    EXECUTE FUNCTION "private"."refresh_item_kind"();

REVOKE EXECUTE ON FUNCTION "private"."venue_ice_kind"("text", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_ice_set_kind"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_glass_and_ice"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."items_guard_kind"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_item_kind"() FROM PUBLIC, "anon", "authenticated";

-- --- 6. Backfill ---

-- Kevin's calls 3 and 4 first, so the merged rows aren't counted below.
DO $$
DECLARE
    v_rocks uuid := (SELECT id FROM public.items WHERE item_type = 'glassware' AND bar_id IS NULL AND lower(btrim(name)) = 'rocks' ORDER BY created_at, id LIMIT 1);
    v_crushed uuid := (SELECT id FROM public.items WHERE item_type = 'ice' AND bar_id IS NULL AND lower(btrim(name)) = 'crushed' ORDER BY created_at, id LIMIT 1);
    v_no_ice uuid := (SELECT id FROM public.items WHERE item_type = 'ice' AND bar_id IS NULL AND lower(btrim(name)) = 'no ice' ORDER BY created_at, id LIMIT 1);
    v_old uuid;
BEGIN
    FOR v_old IN SELECT id FROM public.items
                 WHERE item_type = 'glassware' AND bar_id IS NULL AND lower(btrim(name)) = 'rocks & crushed ice' AND v_rocks IS NOT NULL
    LOOP
        UPDATE public.items SET ice_id = v_crushed
        WHERE glassware_id = v_old AND ice_id IS NULL AND ice_build IS NULL AND v_crushed IS NOT NULL;
        PERFORM private.merge_item(v_old, v_rocks);
    END LOOP;
    FOR v_old IN SELECT id FROM public.items
                 WHERE item_type = 'ice' AND bar_id IS NULL AND lower(btrim(name)) = 'no ice' AND id <> v_no_ice
    LOOP
        PERFORM private.merge_item(v_old, v_no_ice);
    END LOOP;
    -- merge_item puts the worker flag back.
    PERFORM set_config('app.image_worker', 'on', true);
END;
$$;

UPDATE public.items i SET glass = m.kind
FROM (VALUES ('rocks', 'rocks'), ('small rocks', 'rocks'), ('butcher glass', 'rocks'),
             ('coupe', 'coupe'), ('coupette', 'coupe'),
             ('highball', 'highball'),
             ('collins', 'collins'), ('swizzle', 'collins'), ('tall spirit mixer', 'collins'),
             ('martini', 'martini'),
             ('nick & nora', 'nick'), ('chartreuse glass', 'nick'),
             ('wine', 'wine'), ('flute', 'flute'),
             ('fizz', 'fizz'), ('small highball', 'fizz'),
             ('julep cup', 'julep'), ('ceramic', 'ceramic'),
             ('beer', 'beer'), ('beer glass', 'beer'),
             ('spritz', 'spritz'), ('mug', 'mug'), ('tiki mug', 'tiki'), ('snifter', 'snifter')) AS m(name, kind)
WHERE i.item_type = 'glassware' AND lower(btrim(i.name)) = m.name;

UPDATE public.items i SET ice_kind = m.kind
FROM (VALUES ('cubes', 'cubes'), ('hoshizaki', 'cubes'), ('large cube', 'large'), ('crushed', 'crushed'),
             ('spear', 'spear'), ('shaved', 'shaved'), ('pebble', 'pebble'), ('sphere', 'sphere'),
             ('no ice', 'none')) AS m(name, kind)
WHERE i.item_type = 'ice' AND lower(btrim(i.name)) = m.name
  AND NOT EXISTS (SELECT 1 FROM public.item_ice x WHERE x.item_id = i.id);

DO $$
BEGIN
    RAISE NOTICE 'Glass and ice items left not sure: % glass, % ice (Custom is one on purpose).',
        (SELECT count(*) FROM public.items WHERE item_type = 'glassware' AND glass IS NULL),
        (SELECT count(*) FROM public.items i WHERE i.item_type = 'ice' AND i.ice_kind IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.item_ice x WHERE x.item_id = i.id AND x.shape IN ('block', 'slab')));
END;
$$;
