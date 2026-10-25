-- Glass outlines: a real glass's shape, traced, so a drink is drawn in the
-- glass it's served in, after 20261112100000. Kevin, 24 Oct 2026: "bite the
-- bullet once", look up every glass and trace its real outline, so the app
-- never has to look anything up.
--
--   glass_models.outline       the glass traced from its maker's (or a
--                              stockist's) product photo and scaled to its
--                              height, in mm measured down from the rim:
--                              the bowl's diameters, rim, widest point,
--                              stem, foot and bowl depth, and what it's made
--                              of, its handle and its sleeve when it isn't
--                              plain clear glass (lib/sketch/outline.ts
--                              GlassOutline). Numbers and a colour only: no
--                              photo or copied text is stored, and
--                              traced_from cites the page the photo was on.
--                              20261113110000 loads them.
--   item_sketches.inputs       a drink's drawing carries the outline of the
--     .outline                 glass it's served in, set here like its
--                              variant: its own model's, unless it names a
--                              model or a drawing of its own; else its bar's
--                              default glass of that type, when that glass
--                              names a traced model. The painter draws it in
--                              place of the family's shape (lib/sketch/paint.ts);
--                              apps that don't know it yet ignore it.

-- --- What an outline may hold ---

-- [depth, diameter] pairs in mm, top to bottom.
CREATE FUNCTION "private"."valid_mm_pairs"("p" "jsonb", "p_min" integer, "p_max" integer) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_typeof(p) = 'array'
     AND jsonb_array_length(p) BETWEEN p_min AND p_max
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p) e
        WHERE jsonb_typeof(e) IS DISTINCT FROM 'array' OR jsonb_array_length(e) <> 2
           OR jsonb_typeof(e -> 0) <> 'number' OR jsonb_typeof(e -> 1) <> 'number'
           OR (e ->> 0)::numeric NOT BETWEEN 0 AND 1000 OR (e ->> 1)::numeric NOT BETWEEN 0 AND 1000);
$$;

CREATE FUNCTION "private"."valid_glass_outline"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
    v_mm text;
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('height_mm', 'rim_mm', 'widest_mm', 'stemmed', 'outline', 'bowl_mm', 'stem_to_mm', 'stem_mm',
                               'foot_mm', 'stem_profile', 'foot_profile', 'base_mm', 'material', 'sleeve', 'handle', 'traced_from')) THEN
        RETURN false;
    END IF;
    -- What the painter needs to draw it (lib/sketch/outline.ts readOutline): a height, a width, the
    -- bowl, and for a stemmed glass where the bowl and the stem end.
    IF jsonb_typeof(p -> 'height_mm') IS DISTINCT FROM 'number' OR jsonb_typeof(p -> 'widest_mm') IS DISTINCT FROM 'number'
       OR (p ->> 'height_mm')::numeric <= 0 OR (p ->> 'widest_mm')::numeric <= 0
       OR jsonb_typeof(p -> 'stemmed') IS DISTINCT FROM 'boolean' OR NOT private.valid_mm_pairs(p -> 'outline', 3, 80) THEN
        RETURN false;
    END IF;
    IF (p ->> 'stemmed')::boolean AND (jsonb_typeof(p -> 'bowl_mm') IS DISTINCT FROM 'number' OR (p ->> 'bowl_mm')::numeric <= 0
                                       OR jsonb_typeof(p -> 'stem_to_mm') IS DISTINCT FROM 'number' OR (p ->> 'stem_to_mm')::numeric <= 0) THEN
        RETURN false;
    END IF;
    FOREACH v_mm IN ARRAY ARRAY['height_mm', 'rim_mm', 'widest_mm', 'bowl_mm', 'stem_to_mm', 'stem_mm', 'foot_mm', 'base_mm'] LOOP
        IF p ? v_mm AND (jsonb_typeof(p -> v_mm) IS DISTINCT FROM 'number' OR (p ->> v_mm)::numeric NOT BETWEEN 0 AND 1000) THEN
            RETURN false;
        END IF;
    END LOOP;
    IF (p ? 'stem_profile' AND NOT private.valid_mm_pairs(p -> 'stem_profile', 2, 40))
       OR (p ? 'foot_profile' AND NOT private.valid_mm_pairs(p -> 'foot_profile', 2, 40)) THEN
        RETURN false;
    END IF;
    IF p ? 'material' AND (jsonb_typeof(p -> 'material') IS DISTINCT FROM 'object'
                           OR EXISTS (SELECT 1 FROM jsonb_object_keys(p -> 'material') k WHERE k NOT IN ('kind', 'color', 'hammered'))
                           OR coalesce(p -> 'material' ->> 'kind', '') NOT IN ('tinted', 'metal', 'ceramic')
                           OR coalesce(p -> 'material' ->> 'color', '') !~ v_hex
                           OR (p -> 'material' ? 'hammered' AND jsonb_typeof(p -> 'material' -> 'hammered') IS DISTINCT FROM 'boolean')) THEN
        RETURN false;
    END IF;
    IF p ? 'sleeve' AND (jsonb_typeof(p -> 'sleeve') IS DISTINCT FROM 'object'
                         OR EXISTS (SELECT 1 FROM jsonb_object_keys(p -> 'sleeve') k WHERE k NOT IN ('from_mm', 'to_mm', 'color', 'weave'))
                         OR jsonb_typeof(p -> 'sleeve' -> 'from_mm') IS DISTINCT FROM 'number'
                         OR jsonb_typeof(p -> 'sleeve' -> 'to_mm') IS DISTINCT FROM 'number'
                         OR (p -> 'sleeve' ->> 'from_mm')::numeric NOT BETWEEN 0 AND 1000
                         OR (p -> 'sleeve' ->> 'to_mm')::numeric NOT BETWEEN 0.1 AND 1000
                         OR coalesce(p -> 'sleeve' ->> 'color', '') !~ v_hex
                         OR jsonb_typeof(p -> 'sleeve' -> 'weave') IS DISTINCT FROM 'boolean') THEN
        RETURN false;
    END IF;
    IF p ? 'handle' AND (jsonb_typeof(p -> 'handle') IS DISTINCT FROM 'object'
                         OR EXISTS (SELECT 1 FROM jsonb_object_keys(p -> 'handle') k WHERE k NOT IN ('from_mm', 'to_mm', 'reach_mm'))
                         OR jsonb_typeof(p -> 'handle' -> 'from_mm') IS DISTINCT FROM 'number'
                         OR jsonb_typeof(p -> 'handle' -> 'to_mm') IS DISTINCT FROM 'number'
                         OR jsonb_typeof(p -> 'handle' -> 'reach_mm') IS DISTINCT FROM 'number'
                         OR (p -> 'handle' ->> 'from_mm')::numeric NOT BETWEEN 0 AND 1000
                         OR (p -> 'handle' ->> 'to_mm')::numeric NOT BETWEEN 0.1 AND 1000
                         OR (p -> 'handle' ->> 'reach_mm')::numeric NOT BETWEEN 0.1 AND 1000) THEN
        RETURN false;
    END IF;
    IF p ? 'traced_from' AND (jsonb_typeof(p -> 'traced_from') IS DISTINCT FROM 'string'
                              OR NOT private.valid_source_urls(ARRAY[p ->> 'traced_from'])) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;

ALTER TABLE "public"."glass_models"
    ADD COLUMN "outline" "jsonb" CHECK ("outline" IS NULL OR "private"."valid_glass_outline"("outline"));

COMMENT ON COLUMN "public"."glass_models"."outline" IS
    'The glass traced from a product photo and scaled to its height: mm down from the rim (lib/sketch/outline.ts GlassOutline). Numbers only; traced_from cites the page.';

-- --- A drawing carries its glass's outline ---

-- As 20261029500000, plus outline.
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant', 'tint', 'houseIce', 'build', 'outline')) THEN
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
    IF p ? 'outline' AND NOT private.valid_glass_outline(p -> 'outline') THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;

-- The outline a drink is drawn in, in item_sketch_variant's order: a drink
-- that picked a drawing of its own keeps it (no outline); a drink that names
-- a model of this glass gets that model's (none, if it isn't traced); else
-- its bar's default glass of this type, when that glass names a traced model.
CREATE FUNCTION "private"."item_sketch_outline"("p_item_id" "uuid", "p_glass" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN split_part(i.sketch_variant, '_', 1) = p_glass THEN NULL
    WHEN m.id IS NOT NULL THEN m.outline
    ELSE (SELECT bm.outline
            FROM public.bar_glassware g
            JOIN public.glass_models bm ON bm.id = g.model_id AND bm.glass = p_glass
           WHERE g.profile_id = private.item_bar_profile(i.id) AND g.glass = p_glass AND g.is_default
           LIMIT 1)
  END - 'traced_from'
  FROM public.items i
  LEFT JOIN public.glass_models m ON m.id = i.glass_model_id AND m.glass = p_glass
  WHERE i.id = p_item_id;
$$;

-- As 20261007100000, plus the outline.
CREATE OR REPLACE FUNCTION "private"."item_sketches_set_variant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_variant text := private.item_sketch_variant(NEW.item_id, NEW.inputs ->> 'glass');
    v_outline jsonb := private.item_sketch_outline(NEW.item_id, NEW.inputs ->> 'glass');
BEGIN
    NEW.inputs := CASE WHEN v_variant IS NULL THEN NEW.inputs - 'variant'
                       ELSE jsonb_set(NEW.inputs, '{variant}', to_jsonb(v_variant)) END;
    NEW.inputs := CASE WHEN v_outline IS NULL THEN NEW.inputs - 'outline'
                       ELSE jsonb_set(NEW.inputs, '{outline}', v_outline) END;
    RETURN NEW;
END;
$$;

-- Models traced (or traced again) redraw the drinks they're in: drinks that
-- name one, and drinks at bars whose default glass of its type names one. Once
-- per statement, so a load of hundreds of outlines refreshes in one pass.
CREATE FUNCTION "private"."refresh_glass_model_sketches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    WITH changed AS (
        SELECT n.id, n.glass FROM new_models n JOIN old_models o ON o.id = n.id
         WHERE o.outline IS DISTINCT FROM n.outline OR o.glass IS DISTINCT FROM n.glass
    )
    UPDATE public.item_sketches s SET inputs = s.inputs
      FROM public.items i
     WHERE i.id = s.item_id
       AND (EXISTS (SELECT 1 FROM changed c WHERE c.id = i.glass_model_id AND c.glass = s.inputs ->> 'glass')
            OR EXISTS (SELECT 1 FROM changed c
                         JOIN public.bar_glassware g ON g.model_id = c.id AND g.is_default AND g.glass = c.glass
                         JOIN public.profiles p ON p.id = g.profile_id
                        WHERE c.glass = s.inputs ->> 'glass'
                          AND (i.origin_bar_profile_id = g.profile_id OR i.bar_id = p.bar_id)));
    RETURN NULL;
END;
$$;

-- A statement trigger can't name columns and read its rows, so it compares them itself.
CREATE TRIGGER "refresh_sketches" AFTER UPDATE ON "public"."glass_models"
    REFERENCING OLD TABLE AS "old_models" NEW TABLE AS "new_models"
    FOR EACH STATEMENT EXECUTE FUNCTION "private"."refresh_glass_model_sketches"();

REVOKE EXECUTE ON FUNCTION "private"."valid_mm_pairs"("jsonb", integer, integer) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."valid_glass_outline"("jsonb") FROM PUBLIC, "anon", "authenticated";
-- valid_sketch_inputs runs them as its caller (service_role, as 20261006300000 grants it).
GRANT EXECUTE ON FUNCTION "private"."valid_mm_pairs"("jsonb", integer, integer) TO "service_role";
GRANT EXECUTE ON FUNCTION "private"."valid_glass_outline"("jsonb") TO "service_role";
REVOKE EXECUTE ON FUNCTION "private"."item_sketch_outline"("uuid", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_glass_model_sketches"() FROM PUBLIC, "anon", "authenticated";
