-- Ice builds (canvas "Cocktail: the whole app", Create, "Ice builds",
-- approved by Kevin 20 Oct 2026): how the ice sits in the glass, layer by
-- layer. Cubes under pebble so it looks full of pebble, a spear on a cube
-- when the glass is taller than the spear, crushed mounded over the rim, the
-- shaking ice dumped in and topped with crushed.
--
--   * items.ice_build        the layers, bottom first: [{"ice": <ice item id>,
--                            "n": 4}, {"ice": <id>, "to": "mound"}]. Null is one
--                            plain ice, as every drink today. ice_id stays the
--                            top layer, so everything that reads one ice still
--                            does. Shape checked by private.valid_ice_build.
--   * bar_kit.length_mm      how long a venue's ice is (its spears), so the
--                            wizard can tell when a spear is shorter than the
--                            glass.
--   * item_sketches.inputs   "build": the layers as the drawing paints them,
--                            set here on every write of a drawing from
--                            items.ice_build (private.ice_kind names each
--                            layer's ice, as sketchRules.ts iceFromName). A
--                            changed build redraws the drink.
--   * stored drawings of drinks whose ice is "No ice" were painted with cubes
--     (iceFromName tried "ice" before "no ice"); they're set to none here.
--
-- No RLS changes: items and bar_kit keep their policies and table grants.

-- --- items.ice_build ---

CREATE FUNCTION "private"."valid_ice_build"("p" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'array'
    AND jsonb_array_length(p) BETWEEN 1 AND 6
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) l
      WHERE jsonb_typeof(l) IS DISTINCT FROM 'object'
         OR EXISTS (SELECT 1 FROM jsonb_object_keys(l) k WHERE k NOT IN ('ice', 'n', 'to', 'packed', 'tin'))
         OR coalesce(l ->> 'ice', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR (l ? 'n' AND (jsonb_typeof(l -> 'n') IS DISTINCT FROM 'number' OR (l ->> 'n')::numeric NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)))
         OR (l ? 'to' AND coalesce(l ->> 'to', '') NOT IN ('half', 'rim', 'mound'))
         OR (l ? 'packed' AND jsonb_typeof(l -> 'packed') IS DISTINCT FROM 'boolean')
         OR (l ? 'tin' AND jsonb_typeof(l -> 'tin') IS DISTINCT FROM 'boolean')
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION "private"."valid_ice_build"("jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."valid_ice_build"("jsonb") TO "authenticated", "service_role";

ALTER TABLE "public"."items"
    ADD COLUMN "ice_build" "jsonb" CONSTRAINT "items_ice_build_check" CHECK ("private"."valid_ice_build"("ice_build"));

COMMENT ON COLUMN "public"."items"."ice_build" IS
    'Cocktails: how the ice sits in the glass, bottom layer first ([{"ice": id, "n": 4}, {"ice": id, "to": "mound"}]). Null is one plain ice; ice_id is the top layer.';

-- As 20261029100000_method_ice.sql, with ice_build at the end.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    COALESCE(c.notes, (SELECT n.notes FROM public.credited_drink_notes n WHERE n.item_id = c.id)) AS notes,
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
    COALESCE(c.price_minor, (SELECT cd.price_minor FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);

-- --- bar_kit.length_mm ---

ALTER TABLE "public"."bar_kit"
    ADD COLUMN "length_mm" integer CONSTRAINT "bar_kit_length_mm_check" CHECK ("length_mm" IS NULL OR ("kind" = 'ice' AND "length_mm" BETWEEN 20 AND 400));

COMMENT ON COLUMN "public"."bar_kit"."length_mm" IS
    'Ice: how long a piece is (a spear), in mm. Null is not said.';

-- --- The drawing ---

-- An ice's kind, as the drawings name it (sketchRules.ts ICE_NAMES, in its order).
CREATE FUNCTION "private"."ice_kind"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN n ~ '(\mno ice\M|^none\M|^neat\M|^up\M|\mserved up\M)' THEN 'none'
    WHEN n ~ '(crush|cracked|frapp)' THEN 'crushed'
    WHEN n ~ '(pebble|nugget|pellet|sonic)' THEN 'pebble'
    WHEN n ~ '(shaved|snow|kakig[oō]ri)' THEN 'shaved'
    WHEN n ~ '(spear|collins ice|column)' THEN 'spear'
    WHEN n ~ '(sphere|ball)' THEN 'sphere'
    WHEN n ~ '(large|big|king|block|single|clear cube|rock\M)' THEN 'large'
    WHEN n ~ '(cube|ice)' THEN 'cubes'
    WHEN n ~ 'none' THEN 'none'
  END
  FROM (SELECT lower(btrim(p_name)) AS n) x;
$$;

-- As 20261019600000_venue_ice_drawings.sql, plus "build".
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant', 'tint', 'houseIce', 'build')) THEN
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
                                   WHERE jsonb_typeof(l) IS DISTINCT FROM 'object'
                                      OR EXISTS (SELECT 1 FROM jsonb_object_keys(l) k WHERE k NOT IN ('kind', 'n', 'to'))
                                      OR coalesce(l ->> 'kind', '') NOT IN ('cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere')
                                      OR (l ? 'n' AND (jsonb_typeof(l -> 'n') IS DISTINCT FROM 'number' OR (l ->> 'n')::numeric NOT BETWEEN 1 AND 12))
                                      OR (l ? 'to' AND coalesce(l ->> 'to', '') NOT IN ('half', 'rim', 'mound')))) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;

-- On every write of a drawing: the drink's build in the drawing's words, or none.
-- Whatever "build" the writer sent is replaced.
CREATE FUNCTION "private"."item_sketches_set_ice_build"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_build jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', k.kind, 'n', l.layer -> 'n', 'to', l.layer -> 'to')) ORDER BY l.ord)
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

CREATE TRIGGER "set_ice_build" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_ice_build"();

-- A changed build redraws the drink (set_ice_build does the work). No flavor job.
CREATE FUNCTION "private"."refresh_ice_build"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.item_sketches s SET inputs = s.inputs WHERE s.item_id = NEW.id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "refresh_ice_build" AFTER UPDATE OF "ice_build" ON "public"."items"
    FOR EACH ROW WHEN (OLD."ice_build" IS DISTINCT FROM NEW."ice_build")
    EXECUTE FUNCTION "private"."refresh_ice_build"();

REVOKE EXECUTE ON FUNCTION "private"."ice_kind"("text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_ice_build"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_ice_build"() FROM PUBLIC, "anon", "authenticated";

-- --- "No ice" drawn as cubes ---

UPDATE public.item_sketches s
SET inputs = jsonb_set(s.inputs, '{ice}', '"none"')
FROM public.items i
JOIN public.items x ON x.id = i.ice_id
WHERE s.item_id = i.id
  AND private.ice_kind(x.name) = 'none'
  AND s.inputs ->> 'ice' IS DISTINCT FROM 'none';
