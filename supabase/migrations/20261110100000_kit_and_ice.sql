-- Kit and ice, the data (canvas "Cocktail: the whole app", Venue tools,
-- "Kit and ice", approved by Kevin 25 Oct 2026; plan: docs/kit_and_ice.md,
-- PR 1 of 7). Glassware, Ice and Tools say what each thing is and where it
-- comes from, the same way:
--
--   * a venue's ice is an ice item of that venue (items, item_type 'ice',
--     bar_id = the venue) with item_ice beside it: what it looks like in the
--     glass (shape, size, length, clear, stamped, frozen inside) and where it
--     comes from (bought from a supplier, our machine, made here). Blocks and
--     slabs, the ice a bar cuts from, are ice items too. Ice made here gets
--     its recipe the way a house prep does: item_steps, item_prep, and
--     recipes lines for what it starts from (another ice, or a flavour).
--   * bar_kit's ice rows move there and bar_kit holds only tools (one home
--     for each fact). The drawings' venue ice (20261019600000) reads
--     item_ice now, and a spear's length is item_ice.length_mm.
--   * tools get a name of their own, where they are (behind the bar, the
--     prep kitchen), how many, and bought or already ours.
--   * bar_glassware gets bought (from which supplier) or already ours, and
--     how many. Suppliers say whether they cut to order.
--   * item_steps.equipment: the tools a step needs, for the kit check.
--
-- RLS:
--   * item_ice: the venue's team reads it, as bar_kit. Nobody writes it
--     directly: save_venue_ice and remove_venue_ice (Prep at the venue)
--     write the item and its item_ice together, since a Prep holder can't
--     write items (that's Edit drinks). venue_ice lists a venue's ice for
--     its team, whatever their drink visibility.
--   * recipes: Prep at the venue writes the lines of its own ice too (what
--     a piece starts from). Every other recipe keeps its rules.
--   * bar_kit, bar_glassware, suppliers and item_steps keep their policies.
--   No anon access anywhere.

-- --- Venue ice ---

CREATE TABLE "public"."item_ice" (
    "item_id" "uuid" PRIMARY KEY,
    "bar_id" "uuid" NOT NULL,
    -- In the glass: the drawings' kinds (spear is the Collins block), cut to
    -- size and something else (drawn as draw_as). To cut from: block (the
    -- whole freeze) and slab (a cut layer).
    "shape" "text" NOT NULL CHECK ("shape" IN ('cubes', 'large', 'spear', 'sphere', 'cut', 'crushed', 'pebble', 'shaved', 'other', 'block', 'slab')),
    "draw_as" "text" CHECK ("draw_as" IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')),
    -- A cube's side, a sphere's across, a Collins block's width; length is a
    -- Collins block's or spear's, or a block's or slab's longest side. A
    -- drawing is a side view, so these two are what it scales.
    "size_mm" integer CHECK ("size_mm" BETWEEN 5 AND 2000),
    "length_mm" integer CHECK ("length_mm" BETWEEN 5 AND 2000),
    -- Null is not sure.
    "clear" boolean,
    "stamped" boolean DEFAULT false NOT NULL,
    -- "A glass prism", "a viola".
    "frozen_inside" "text" CHECK ("frozen_inside" IS NULL OR char_length(btrim("frozen_inside")) BETWEEN 1 AND 60),
    -- Null is not said yet.
    "source" "text" CHECK ("source" IN ('bought', 'machine', 'made')),
    "supplier_id" "uuid",
    -- "Hoshizaki under the well".
    "machine" "text" CHECK ("machine" IS NULL OR char_length(btrim("machine")) BETWEEN 1 AND 60),
    -- "Bagged", "cut from their 300 lb block".
    "note" "text" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 120),
    -- The item is the venue's own (items_id_bar_id_key), and so is the supplier.
    FOREIGN KEY ("item_id", "bar_id") REFERENCES "public"."items"("id", "bar_id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("supplier_id", "bar_id") REFERENCES "public"."suppliers"("id", "bar_id") ON DELETE SET NULL ("supplier_id"),
    CONSTRAINT "item_ice_draw_as_cut_or_other" CHECK ("draw_as" IS NULL OR "shape" IN ('cut', 'other')),
    CONSTRAINT "item_ice_supplier_when_bought" CHECK ("supplier_id" IS NULL OR "source" = 'bought'),
    CONSTRAINT "item_ice_machine_when_machine" CHECK ("machine" IS NULL OR "source" = 'machine')
);

CREATE INDEX "item_ice_bar_id_idx" ON "public"."item_ice" ("bar_id");
CREATE INDEX "item_ice_supplier_id_idx" ON "public"."item_ice" ("supplier_id") WHERE "supplier_id" IS NOT NULL;

COMMENT ON TABLE "public"."item_ice" IS
    'A venue''s ice (Kit › Ice): what an ice item of the venue looks like in the glass and where it comes from. Its team reads it; save_venue_ice and remove_venue_ice (Prep) write it.';

ALTER TABLE "public"."item_ice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_ice_select" ON "public"."item_ice" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(0)) OR "private"."is_app_admin"());

REVOKE ALL ON "public"."item_ice" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."item_ice" TO "authenticated";
GRANT ALL ON "public"."item_ice" TO "service_role";

-- bar_kit's ice, as ice items: the wizard's names, where each came from, a spear's length.
DROP TRIGGER "refresh_house_ice" ON "public"."bar_kit";

CREATE TEMP TABLE "kit_ice_moved" AS
    SELECT "gen_random_uuid"() AS "item_id", k.* FROM "public"."bar_kit" k WHERE k."kind" = 'ice';

INSERT INTO "public"."items" ("id", "name", "item_type", "bar_id", "created_at")
SELECT m."item_id",
       CASE m."key" WHEN 'cubes' THEN 'Cubes' WHEN 'large' THEN 'Large cube' WHEN 'spear' THEN 'Spear' WHEN 'crushed' THEN 'Crushed'
                    WHEN 'pebble' THEN 'Pebble' WHEN 'shaved' THEN 'Shaved' WHEN 'sphere' THEN 'Sphere' END,
       'ice', m."bar_id", m."created_at"
FROM "kit_ice_moved" m;

INSERT INTO "public"."item_ice" ("item_id", "bar_id", "shape", "length_mm", "source", "supplier_id", "note")
SELECT m."item_id", m."bar_id", m."key", m."length_mm",
       CASE WHEN m."supplier_id" IS NOT NULL THEN 'bought' WHEN m."made_here" THEN 'made' END,
       m."supplier_id", m."note"
FROM "kit_ice_moved" m;

DELETE FROM "public"."bar_kit" WHERE "kind" = 'ice';
DROP TABLE "kit_ice_moved";

-- Their drawings are unchanged: the venues have the same kinds as before.

-- --- Tools: bar_kit ---

ALTER TABLE "public"."bar_kit"
    DROP CONSTRAINT "bar_kit_kind_check",
    DROP CONSTRAINT "bar_kit_key_check",
    DROP CONSTRAINT "bar_kit_source_check",
    DROP COLUMN "length_mm",
    -- A tool that isn't on our list (lib/techniques/equipment.ts), or our
    -- tool in the venue's words.
    ADD COLUMN "name" "text" CHECK ("name" IS NULL OR char_length(btrim("name")) BETWEEN 1 AND 60),
    ADD COLUMN "location" "text" CHECK ("location" IN ('bar', 'prep')),
    ADD COLUMN "count" integer CHECK ("count" BETWEEN 1 AND 9999),
    -- Null is not said.
    ADD COLUMN "source" "text" CHECK ("source" IN ('bought', 'ours')),
    ALTER COLUMN "key" DROP NOT NULL,
    -- Always 'tool' now. It stays so app builds from before this migration
    -- keep saving tools (they send it, and upsert on bar_id, kind, key).
    ALTER COLUMN "kind" SET DEFAULT 'tool',
    ADD CONSTRAINT "bar_kit_kind_check" CHECK ("kind" = 'tool'),
    ADD CONSTRAINT "bar_kit_key_check" CHECK (("key" IS NULL OR "key" ~ '^[a-z0-9-]{1,40}$') AND ("key" IS NOT NULL OR "name" IS NOT NULL));

UPDATE "public"."bar_kit" SET "source" = CASE WHEN "supplier_id" IS NOT NULL THEN 'bought' WHEN "made_here" THEN 'ours' END
WHERE "supplier_id" IS NOT NULL OR "made_here";

ALTER TABLE "public"."bar_kit"
    DROP COLUMN "made_here",
    ADD CONSTRAINT "bar_kit_supplier_when_bought" CHECK ("supplier_id" IS NULL OR "source" = 'bought');

COMMENT ON TABLE "public"."bar_kit" IS
    'A venue''s tools (Kit › Tools): ours (key, lib/techniques/equipment.ts) or its own (name). Its team reads it; anyone with the prep capability writes it.';

-- --- Glassware: bought or ours, how many ---

ALTER TABLE "public"."bar_glassware"
    ADD COLUMN "source" "text" CHECK ("source" IN ('bought', 'ours')),
    ADD COLUMN "supplier_id" "uuid" REFERENCES "public"."suppliers"("id") ON DELETE SET NULL,
    ADD COLUMN "count" integer CHECK ("count" BETWEEN 1 AND 9999),
    ADD CONSTRAINT "bar_glassware_supplier_when_bought" CHECK ("supplier_id" IS NULL OR "source" = 'bought');

CREATE INDEX "bar_glassware_supplier_id_idx" ON "public"."bar_glassware" ("supplier_id") WHERE "supplier_id" IS NOT NULL;

-- A glass comes from the bar's own supplier (the row has a profile, not a bar, so no composite key).
CREATE FUNCTION "private"."bar_glassware_own_supplier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers s JOIN public.profiles p ON p.bar_id = s.bar_id
        WHERE s.id = NEW.supplier_id AND p.id = NEW.profile_id
    ) THEN
        RAISE EXCEPTION 'A glass comes from one of the venue''s own suppliers.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."bar_glassware_own_supplier"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "own_supplier" BEFORE INSERT OR UPDATE OF "supplier_id", "profile_id" ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."bar_glassware_own_supplier"();

-- --- Suppliers: cuts to order ---

ALTER TABLE "public"."suppliers" ADD COLUMN "cuts_to_order" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."suppliers"."cuts_to_order" IS 'An ice supplier that cuts to the venue''s sizes.';

-- --- Steps name their tools ---

CREATE FUNCTION "private"."valid_step_tools"("p" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT cardinality(p) <= 12
     AND NOT EXISTS (SELECT 1 FROM unnest(p) t WHERE t IS NULL OR char_length(btrim(t)) NOT BETWEEN 1 AND 60);
$$;

REVOKE EXECUTE ON FUNCTION "private"."valid_step_tools"("text"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."valid_step_tools"("text"[]) TO "authenticated", "service_role";

ALTER TABLE "public"."item_steps"
    ADD COLUMN "equipment" "text"[] DEFAULT '{}'::"text"[] NOT NULL CONSTRAINT "item_steps_equipment_check" CHECK ("private"."valid_step_tools"("equipment"));

COMMENT ON COLUMN "public"."item_steps"."equipment" IS
    'The tools this step needs: ids from lib/techniques/equipment.ts, or a venue''s own tool by its name (bar_kit.name).';

-- --- Reading and writing a venue's ice ---

CREATE FUNCTION "private"."can_edit_venue_ice"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = p_item_id AND i.item_type = 'ice'
      AND (i.bar_id IN (SELECT private.bars_with_capability('prep')) OR (i.bar_id IS NOT NULL AND private.is_app_admin()))
  );
$$;

REVOKE EXECUTE ON FUNCTION "private"."can_edit_venue_ice"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."can_edit_venue_ice"("uuid") TO "authenticated", "service_role";

-- The venue's ice for its team, in the order it was added. A supplier's name
-- only for those who see the venue's suppliers (Prep, Costs).
CREATE FUNCTION "public"."venue_ice"("p_bar_id" "uuid") RETURNS TABLE (
    "id" "uuid", "name" "text", "shape" "text", "draw_as" "text", "size_mm" integer, "length_mm" integer,
    "clear" boolean, "stamped" boolean, "frozen_inside" "text", "source" "text", "supplier_id" "uuid",
    "supplier_name" "text", "machine" "text", "note" "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT i.id, i.name, x.shape, x.draw_as, x.size_mm, x.length_mm, x.clear, x.stamped, x.frozen_inside, x.source, x.supplier_id,
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

REVOKE EXECUTE ON FUNCTION "public"."venue_ice"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."venue_ice"("uuid") TO "authenticated", "service_role";

-- Add a venue's ice (no p_id) or change one: its name and every fact, as
-- the sheet has them (a fact left out is not said). Returns the ice item's id.
CREATE FUNCTION "public"."save_venue_ice"(
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
BEGIN
    IF auth.uid() IS NULL OR NOT (p_bar_id IN (SELECT private.bars_with_capability('prep')) OR private.is_app_admin()) THEN
        RAISE EXCEPTION 'Changing a venue''s ice needs Prep there.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
        RAISE EXCEPTION 'An ice needs a name of up to 80 characters.' USING ERRCODE = 'check_violation';
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
    INSERT INTO public.item_ice AS x (item_id, bar_id, shape, draw_as, size_mm, length_mm, clear, stamped, frozen_inside, source, supplier_id, machine, note)
    VALUES (v_id, p_bar_id, p_shape, p_draw_as, p_size_mm, p_length_mm, p_clear, coalesce(p_stamped, false),
            nullif(btrim(p_frozen_inside), ''), p_source, p_supplier_id, nullif(btrim(p_machine), ''), nullif(btrim(p_note), ''))
    ON CONFLICT (item_id) DO UPDATE SET
        shape = excluded.shape, draw_as = excluded.draw_as, size_mm = excluded.size_mm, length_mm = excluded.length_mm,
        clear = excluded.clear, stamped = excluded.stamped, frozen_inside = excluded.frozen_inside, source = excluded.source,
        supplier_id = excluded.supplier_id, machine = excluded.machine, note = excluded.note;
    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_venue_ice"("uuid", "text", "text", "uuid", "text", integer, integer, boolean, boolean, "text", "text", "uuid", "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_venue_ice"("uuid", "text", "text", "uuid", "text", integer, integer, boolean, boolean, "text", "text", "uuid", "text", "text") TO "authenticated", "service_role";

-- Take an ice off the venue's kit. Refused while a drink pours it or another
-- ice starts from it, so nothing loses its ice without saying.
CREATE FUNCTION "public"."remove_venue_ice"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_used text;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.item_ice x WHERE x.item_id = p_id) OR NOT private.can_edit_venue_ice(p_id) THEN
        RAISE EXCEPTION 'Changing a venue''s ice needs Prep there.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Named only when it's the venue's own drink or ice; anything else the caller may not see.
    SELECT CASE WHEN d.bar_id IS NOT DISTINCT FROM (SELECT x.bar_id FROM public.item_ice x WHERE x.item_id = p_id) THEN d.name ELSE 'A drink elsewhere' END
    INTO v_used FROM public.items d
    WHERE d.id <> p_id
      AND (d.ice_id = p_id OR d.method_ice_id = p_id OR d.ice_build @> jsonb_build_array(jsonb_build_object('ice', p_id::text))
           OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.recipe_item_id = d.id AND r.ingredient_item_id = p_id))
    LIMIT 1;
    IF v_used IS NOT NULL THEN
        RAISE EXCEPTION '% uses this ice. Change it there first.', v_used USING ERRCODE = 'foreign_key_violation';
    END IF;
    DELETE FROM public.items WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."remove_venue_ice"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."remove_venue_ice"("uuid") TO "authenticated", "service_role";

-- --- Recipes: what a venue's ice starts from ---

ALTER POLICY "recipes_select" ON "public"."recipes"
    USING ("private"."can_edit_item"("recipe_item_id") OR "private"."can_edit_venue_ice"("recipe_item_id"));
ALTER POLICY "recipes_insert" ON "public"."recipes"
    WITH CHECK ("private"."can_edit_item"("recipe_item_id") OR "private"."can_edit_venue_ice"("recipe_item_id"));
ALTER POLICY "recipes_update" ON "public"."recipes"
    USING ("private"."can_edit_item"("recipe_item_id") OR "private"."can_edit_venue_ice"("recipe_item_id"))
    WITH CHECK ("private"."can_edit_item"("recipe_item_id") OR "private"."can_edit_venue_ice"("recipe_item_id"));
ALTER POLICY "recipes_delete" ON "public"."recipes"
    USING ("private"."can_edit_item"("recipe_item_id") OR "private"."can_edit_venue_ice"("recipe_item_id"));

-- --- The drawings read the venue's ice from item_ice ---

-- As 20261019600000_venue_ice_drawings.sql: the kinds of the venue's ice in
-- the glass (a cut-to-size or odd ice by the kind it's drawn as).
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
            ARRAY(SELECT coalesce(x.draw_as, x.shape) FROM public.item_ice x
                  WHERE x.bar_id = private.item_kit_bar(NEW.item_id)
                    AND (x.shape NOT IN ('cut', 'other', 'block', 'slab') OR x.draw_as IS NOT NULL)));
    END IF;
    NEW.inputs := CASE WHEN v_ice IS NULL THEN NEW.inputs - 'houseIce'
                       ELSE jsonb_set(NEW.inputs, '{houseIce}', to_jsonb(v_ice)) END;
    RETURN NEW;
END;
$$;

-- A change to a venue's ice redraws its drinks (set_house_ice does the work).
CREATE OR REPLACE FUNCTION "private"."refresh_house_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.item_sketches s SET inputs = s.inputs
    FROM public.items i
    WHERE i.id = s.item_id
      AND coalesce(s.inputs -> 'from' ->> 'ice', '') <> 'data'
      AND (i.bar_id IN (OLD.bar_id, NEW.bar_id)
           OR i.origin_bar_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.bar_id IN (OLD.bar_id, NEW.bar_id)));
    RETURN NULL;
END;
$$;

CREATE TRIGGER "refresh_house_ice" AFTER INSERT OR DELETE OR UPDATE OF "shape", "draw_as", "bar_id" ON "public"."item_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."refresh_house_ice"();
