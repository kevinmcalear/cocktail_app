-- Saved drinks are drawn with the venue's own ice: its size, clear or cloudy,
-- a stamp and something frozen inside (item_ice, 20261110100000_kit_and_ice.sql),
-- which the painter already draws (lib/sketch/types.ts IceLook, #812).
--
-- 1. valid_sketch_inputs allows "iceLook" and the same look on each build layer.
-- 2. set_ice_look (a new trigger on item_sketches, after set_house_ice and
--    set_ice_build) writes "iceLook" for a drink with one ice: the drink's own
--    venue ice when it names one, else the venue's ice of the kind it's drawn with.
-- 3. set_ice_build gives each layer its ice's look the same way.
-- 4. A change to a venue ice's size, length, clear, stamp or what's inside
--    redraws its drinks, as a change of shape already did.
-- Nothing else changes: a drink with no venue ice, or ice that says nothing
-- about its look, is drawn exactly as before.

-- --- What a venue ice looks like, in the painter's words ---

-- {mm, lengthMm, clear, stamp, inside}, only what's said and in the painter's
-- ranges (sketchRules.ts readIceLook); null when it says nothing.
CREATE FUNCTION "private"."ice_look"("p_ice" "public"."item_ice") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT nullif(jsonb_strip_nulls(jsonb_build_object(
    'mm', CASE WHEN (p_ice).size_mm BETWEEN 5 AND 120 THEN (p_ice).size_mm END,
    'lengthMm', CASE WHEN (p_ice).length_mm BETWEEN 20 AND 300 THEN (p_ice).length_mm END,
    'clear', (p_ice).clear,
    'stamp', CASE WHEN (p_ice).stamped THEN true END,
    'inside', CASE WHEN (p_ice).frozen_inside IS NOT NULL THEN true END
  )), '{}'::jsonb);
$$;

-- The look of the ice a drink is drawn with: the ice item itself when it's
-- one of the venue's, else the venue's first ice in the glass of that kind
-- (by the order Kit lists them). Null when the venue has none or it says nothing.
CREATE FUNCTION "private"."drawn_ice_look"("p_ice_item" "uuid", "p_bar" "uuid", "p_kind" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(
    (SELECT private.ice_look(x) FROM public.item_ice x WHERE x.item_id = p_ice_item),
    (SELECT private.ice_look(x)
       FROM public.item_ice x
       JOIN public.items i ON i.id = x.item_id
      WHERE x.bar_id = p_bar
        AND coalesce(x.draw_as, x.shape) = p_kind
        AND x.shape NOT IN ('block', 'slab')
      ORDER BY i.created_at, i.id
      LIMIT 1));
$$;

-- --- Drawings may carry it ---

-- A look object: only its own keys, each the type and range the painter reads.
CREATE FUNCTION "private"."valid_ice_look"("p" "jsonb", "p_also" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_typeof(p) = 'object'
    AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
                    WHERE k <> ALL (p_also || ARRAY['mm', 'lengthMm', 'clear', 'stamp', 'inside']))
    AND (NOT p ? 'mm' OR (jsonb_typeof(p -> 'mm') = 'number' AND (p ->> 'mm')::numeric BETWEEN 5 AND 120))
    AND (NOT p ? 'lengthMm' OR (jsonb_typeof(p -> 'lengthMm') = 'number' AND (p ->> 'lengthMm')::numeric BETWEEN 20 AND 300))
    AND (NOT p ? 'clear' OR jsonb_typeof(p -> 'clear') = 'boolean')
    AND (NOT p ? 'stamp' OR p -> 'stamp' = 'true'::jsonb)
    AND (NOT p ? 'inside' OR p -> 'inside' = 'true'::jsonb);
$$;

-- As 20261113100000_glass_outlines.sql, plus iceLook and a look on each build layer.
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant', 'tint', 'houseIce', 'build', 'outline', 'iceLook')) THEN
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
    IF p ? 'build' AND (jsonb_typeof(p -> 'build') IS DISTINCT FROM 'array'
                        OR jsonb_array_length(p -> 'build') NOT BETWEEN 1 AND 6
                        OR EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'build') l
                                   WHERE NOT private.valid_ice_look(l, ARRAY['kind', 'n', 'to'])
                                      OR coalesce(l ->> 'kind', '') NOT IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')
                                      OR (l ? 'n' AND (jsonb_typeof(l -> 'n') IS DISTINCT FROM 'number' OR (l ->> 'n')::numeric NOT BETWEEN 1 AND 12))
                                      OR (l ? 'to' AND coalesce(l ->> 'to', '') NOT IN ('half', 'rim', 'mound')))) THEN
        RETURN false;
    END IF;
    IF p ? 'outline' AND NOT private.valid_glass_outline(p -> 'outline') THEN
        RETURN false;
    END IF;
    IF p ? 'iceLook' AND NOT private.valid_ice_look(p -> 'iceLook', ARRAY[]::text[]) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;

-- --- A build's layers carry their ice's look ---

-- As 20261029500000_ice_builds.sql, plus each layer's look.
CREATE OR REPLACE FUNCTION "private"."item_sketches_set_ice_build"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid := private.item_kit_bar(NEW.item_id);
    v_build jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', k.kind, 'n', l.layer -> 'n', 'to', l.layer -> 'to'))
                     || coalesce(private.drawn_ice_look(x.id, v_bar, k.kind), '{}'::jsonb)
                     ORDER BY l.ord)
    INTO v_build
    FROM public.items i
    CROSS JOIN LATERAL jsonb_array_elements(i.ice_build) WITH ORDINALITY AS l(layer, ord)
    JOIN public.items x ON x.id = (l.layer ->> 'ice')::uuid
    CROSS JOIN LATERAL (SELECT private.ice_kind(x.name) AS kind) k
    WHERE i.id = NEW.item_id AND jsonb_typeof(i.ice_build) = 'array' AND k.kind IS NOT NULL AND k.kind <> 'none';
    NEW.inputs := CASE WHEN v_build IS NULL THEN NEW.inputs - 'build'
                       ELSE jsonb_set(NEW.inputs, '{build}', v_build) END;
    RETURN NEW;
END;
$$;

-- --- One ice: the drawing's iceLook ---

-- After set_house_ice and set_ice_build (triggers run by name), so it sees the
-- kind the drink is drawn with. A drink with a build leaves it to the layers.
CREATE FUNCTION "private"."item_sketches_set_ice_look"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_kind text := coalesce(NEW.inputs ->> 'houseIce', NEW.inputs ->> 'ice');
    v_look jsonb;
BEGIN
    IF NOT NEW.inputs ? 'build' AND v_kind IS NOT NULL AND v_kind <> 'none' THEN
        SELECT private.drawn_ice_look(i.ice_id, private.item_kit_bar(i.id), v_kind)
        INTO v_look
        FROM public.items i
        WHERE i.id = NEW.item_id;
    END IF;
    NEW.inputs := CASE WHEN v_look IS NULL THEN NEW.inputs - 'iceLook'
                       ELSE jsonb_set(NEW.inputs, '{iceLook}', v_look) END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_ice_look" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_ice_look"();

-- --- A venue changing its ice's look redraws its drinks ---

DROP TRIGGER "refresh_house_ice" ON "public"."item_ice";
CREATE TRIGGER "refresh_house_ice" AFTER INSERT OR DELETE OR UPDATE OF "shape", "draw_as", "bar_id", "size_mm", "length_mm", "clear", "stamped", "frozen_inside" ON "public"."item_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."refresh_house_ice"();

-- refresh_house_ice skips drinks whose spec names their ice ("from" data), but
-- the look now reaches those too: redraw them as well.
CREATE OR REPLACE FUNCTION "private"."refresh_house_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.item_sketches s SET inputs = s.inputs
    FROM public.items i
    WHERE i.id = s.item_id
      AND (i.bar_id IN (OLD.bar_id, NEW.bar_id)
           OR i.origin_bar_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.bar_id IN (OLD.bar_id, NEW.bar_id)));
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."ice_look"("public"."item_ice") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."drawn_ice_look"("uuid", "uuid", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."valid_ice_look"("jsonb", "text"[]) FROM PUBLIC, "anon";
-- valid_sketch_inputs runs it as its caller, like valid_glass_outline (20261118500000).
GRANT EXECUTE ON FUNCTION "private"."valid_ice_look"("jsonb", "text"[]) TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_ice_look"() FROM PUBLIC, "anon", "authenticated";

-- --- Redraw the drinks of venues that already list their ice ---

UPDATE public.item_sketches s SET inputs = s.inputs
FROM public.items i
WHERE i.id = s.item_id
  AND EXISTS (SELECT 1 FROM public.item_ice x
              WHERE x.bar_id = private.item_kit_bar(i.id) AND private.ice_look(x) IS NOT NULL);
