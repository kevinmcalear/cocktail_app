-- The venue's ice in its drinks' drawings (Kevin, 14 Oct 2026: "wire the
-- venue's ice into drink drawings too"). As a bar's main glass draws its
-- drinks (20261007100000_glass_variants.sql), a venue's Ice list (bar_kit,
-- 20261019000000_venue_kit.sql) now draws the ice the worker only guessed:
--
--   * item_sketches.inputs.houseIce   the venue's kind for a guessed ice,
--                                      set here on every write of a drawing;
--                                      the app draws it over "ice". An ice
--                                      the drink's spec names (from.ice =
--                                      'data') is never changed.
--   * a change to a venue's ice redraws its drinks, as glassware does. No
--     flavor job is queued.
--
-- The nearest-kind table matches lib/venueKit.ts houseIce.

-- As 20261017100000_sketch_liquid.sql, plus "houseIce".
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant', 'tint', 'houseIce')) THEN
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
    IF p ? 'houseIce' AND (jsonb_typeof(p -> 'houseIce') IS DISTINCT FROM 'string'
                           OR p ->> 'houseIce' NOT IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;


-- The kinds a guessed ice gives way to, nearest first (lib/venueKit.ts NEAR).
CREATE FUNCTION "private"."house_ice"("p_ice" "text", "p_kinds" "text"[]) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN cardinality(p_kinds) = 0 OR p_ice = ANY (p_kinds) THEN NULL
    ELSE (SELECT k FROM unnest(CASE p_ice
            WHEN 'cubes' THEN ARRAY['cubes', 'large', 'sphere', 'spear']
            WHEN 'large' THEN ARRAY['large', 'sphere', 'cubes']
            WHEN 'sphere' THEN ARRAY['sphere', 'large', 'cubes']
            WHEN 'spear' THEN ARRAY['spear', 'cubes', 'large']
            WHEN 'crushed' THEN ARRAY['crushed', 'pebble', 'shaved', 'cubes']
            WHEN 'pebble' THEN ARRAY['pebble', 'crushed', 'shaved', 'cubes']
            WHEN 'shaved' THEN ARRAY['shaved', 'crushed', 'pebble', 'cubes']
          END) WITH ORDINALITY AS n(k, i)
          WHERE n.k = ANY (p_kinds) ORDER BY n.i LIMIT 1)
  END;
$$;

-- A drink's venue: its own, else the bar it comes from (seeded bar drinks).
CREATE FUNCTION "private"."item_kit_bar"("p_item_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(i.bar_id, (SELECT p.bar_id FROM public.profiles p WHERE p.id = i.origin_bar_profile_id))
  FROM public.items i
  WHERE i.id = p_item_id;
$$;

-- On every write of a drawing: the venue's kind for a guessed ice, or none.
-- Whatever "houseIce" the writer sent is replaced.
CREATE FUNCTION "private"."item_sketches_set_house_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ice text;
BEGIN
    IF coalesce(NEW.inputs -> 'from' ->> 'ice', '') <> 'data' THEN
        v_ice := private.house_ice(
            NEW.inputs ->> 'ice',
            ARRAY(SELECT k.key FROM public.bar_kit k WHERE k.bar_id = private.item_kit_bar(NEW.item_id) AND k.kind = 'ice'));
    END IF;
    NEW.inputs := CASE WHEN v_ice IS NULL THEN NEW.inputs - 'houseIce'
                       ELSE jsonb_set(NEW.inputs, '{houseIce}', to_jsonb(v_ice)) END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_house_ice" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_house_ice"();

-- A change to a venue's ice redraws its drinks (set_house_ice does the work).
CREATE FUNCTION "private"."refresh_house_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF coalesce(NEW.kind, OLD.kind) <> 'ice' THEN RETURN NULL; END IF;
    UPDATE public.item_sketches s SET inputs = s.inputs
    FROM public.items i
    WHERE i.id = s.item_id
      AND coalesce(s.inputs -> 'from' ->> 'ice', '') <> 'data'
      AND (i.bar_id IN (OLD.bar_id, NEW.bar_id)
           OR i.origin_bar_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.bar_id IN (OLD.bar_id, NEW.bar_id)));
    RETURN NULL;
END;
$$;

CREATE TRIGGER "refresh_house_ice" AFTER INSERT OR UPDATE OR DELETE ON "public"."bar_kit"
    FOR EACH ROW EXECUTE FUNCTION "private"."refresh_house_ice"();

REVOKE EXECUTE ON FUNCTION "private"."item_kit_bar"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_house_ice"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_house_ice"() FROM PUBLIC, "anon", "authenticated";
