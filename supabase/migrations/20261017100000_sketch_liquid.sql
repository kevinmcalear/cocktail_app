-- DRAFT. Local stack only until Kevin's OK.
--
-- A drink's sketch colour, picked by whoever edits the drink (13 Oct: "only
-- so many stirred-down browns ... you want to adjust it"). Follows
-- items.sketch_variant (20261007100000_glass_variants.sql):
--
--   items.sketch_liquid     the editor's pick of the watercolour, '#rrggbb'
--                           (a swatch from constants/sketch.ts SKETCH_TINTS);
--                           null is Auto, the colour the worker works out
--                           from the spec.
--   item_sketches.inputs    gains "tint": the pick, copied in by a trigger,
--                           never by the worker. The worker's own colour
--                           stays in "liquid", so Auto is just "no tint", and
--                           the painter (lib/sketch/types.ts liquidOf) lays the
--                           tint over it at paint time. Nothing is redrawn
--                           server side, no job is queued, no AI runs.
--
-- Who may set it: anyone items_update lets edit the drink (can_write). No new
-- policy; item_sketches stays unwritable by clients.

ALTER TABLE "public"."items" ADD COLUMN "sketch_liquid" "text"
    CHECK ("sketch_liquid" IS NULL OR "sketch_liquid" ~ '^#[0-9a-f]{6}$');

-- As 20261007100000_glass_variants.sql, plus "tint".
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant', 'tint')) THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p -> 'v') IS DISTINCT FROM 'number' OR jsonb_typeof(p -> 'coverage') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p -> 'fizz') IS DISTINCT FROM 'boolean' THEN
        RETURN false;
    END IF;
    IF p ->> 'glass' IS NULL OR p ->> 'glass' NOT IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
                                                     'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer')
       OR p ->> 'ice' IS NULL OR p ->> 'ice' NOT IN ('none', 'cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')
       OR p ->> 'method' IS NULL OR p ->> 'method' NOT IN ('shake', 'stir', 'build', 'blend', 'swizzle', 'throw', 'pour') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p -> 'liquid') IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p -> 'liquid') k WHERE k NOT IN ('hex', 'alpha'))
       OR coalesce(p -> 'liquid' ->> 'hex', '') !~ v_hex
       OR jsonb_typeof(p -> 'liquid' -> 'alpha') IS DISTINCT FROM 'number' THEN
        RETURN false;
    END IF;
    IF coalesce(jsonb_typeof(p -> 'foam'), 'null') <> 'null'
       AND p ->> 'foam' NOT IN ('cap', 'crema', 'froth', 'silk', 'sheen') THEN
        RETURN false;
    END IF;
    IF (coalesce(jsonb_typeof(p -> 'float'), 'null') <> 'null' AND p ->> 'float' !~ v_hex)
       OR (coalesce(jsonb_typeof(p -> 'bleed'), 'null') <> 'null' AND p ->> 'bleed' !~ v_hex) THEN
        RETURN false;
    END IF;
    IF coalesce(jsonb_typeof(p -> 'garnish'), 'null') <> 'null' AND p ->> 'garnish' NOT IN (
        'orange_peel', 'lemon_peel', 'grapefruit_peel', 'lime_wheel', 'lemon_wheel', 'orange_wheel', 'lime_wedge',
        'cherry', 'olive', 'onion', 'mint', 'herb', 'berries', 'strawberry', 'pineapple', 'coffee_beans',
        'grated_spice', 'flower', 'cucumber', 'salt_rim', 'sugar_rim', 'ginger', 'chili', 'apple') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p -> 'from') IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_each_text(p -> 'from') e
                  WHERE e.key NOT IN ('glass', 'ice', 'method', 'liquid', 'garnish')
                     OR e.value NOT IN ('data', 'rules', 'ai', 'default')) THEN
        RETURN false;
    END IF;
    IF p ? 'variant' AND (jsonb_typeof(p -> 'variant') IS DISTINCT FROM 'string'
                          OR NOT private.valid_glass_variant(p ->> 'glass', p ->> 'variant')) THEN
        RETURN false;
    END IF;
    IF p ? 'tint' AND (jsonb_typeof(p -> 'tint') IS DISTINCT FROM 'string' OR p ->> 'tint' !~ v_hex) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;

-- The drink's pick, on every write of its drawing: the worker's, a maker's
-- (save_maker_sketch), or the refresh below. Whatever "tint" they sent is
-- replaced, so only the drink's editors decide it.
CREATE FUNCTION "private"."item_sketches_set_tint"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_tint text := (SELECT i.sketch_liquid FROM public.items i WHERE i.id = NEW.item_id);
BEGIN
    NEW.inputs := CASE WHEN v_tint IS NULL THEN NEW.inputs - 'tint'
                       ELSE jsonb_set(NEW.inputs, '{tint}', to_jsonb(v_tint)) END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_tint" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_tint"();

-- A pick (or Auto) rewrites the drink's inputs in place: refresh_item_sketch_variants
-- touches them, and set_tint above does the work. No flavor job is queued.
CREATE TRIGGER "refresh_sketch_tint" AFTER UPDATE OF "sketch_liquid" ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."sketch_liquid" IS DISTINCT FROM NEW."sketch_liquid")
    EXECUTE FUNCTION "private"."refresh_item_sketch_variants"();

REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_tint"() FROM PUBLIC, "anon", "authenticated";
