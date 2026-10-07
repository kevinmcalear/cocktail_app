-- DRAFT. Local stack only until Kevin's OK.
--
-- Glass variants for drawn sketches: a drink is drawn in its own bar's glass.
--
--   items.sketch_variant    the drink editor's pick of how its glass is drawn,
--                           a key from lib/sketch/geometry.ts GLASS_VARIANTS
--                           ('martini_pony'). It only counts while the drink
--                           is drawn in that glass.
--   bar_glassware           the glasses a bar pours into, one row per shape:
--                           maker, designer, series, the shape's name and a
--                           note on it, sources, and which drawing it is.
--                           The default glass of each type is what the bar's
--                           drinks are drawn in. A research pass fills real
--                           data later (its glassware[].shapes[] load one row
--                           each, sketch_shape as glass); bar admins (brand)
--                           can edit it.
--   item_sketches.inputs    gains "variant": the drink's pick, else its bar's
--                           default glass of that type, else nothing (the
--                           default drawing). Set here by a trigger, never by
--                           the worker, so the worker and the AI fill don't
--                           run again when a pick changes.
--
-- Also: get_item_sketch_context says whether the drink already has a drawing,
-- so the worker stops overwriting a finished one with a rules-only stand-in
-- each time a drink is re-queued (one reason drawings changed on refresh).

-- ---------------------------------------------------------------------------
-- What may be stored
-- ---------------------------------------------------------------------------

-- '<glass>_<name>', lowercase. Which names exist is the app's business: an
-- unknown one draws the default.
CREATE FUNCTION "private"."valid_glass_variant"("p_glass" "text", "p_variant" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_variant ~ '^[a-z]+_[a-z]+$' AND char_length(p_variant) <= 40
     AND split_part(p_variant, '_', 1) = p_glass
     AND p_glass IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
                     'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer');
$$;

ALTER TABLE "public"."items" ADD COLUMN "sketch_variant" "text"
    CHECK ("sketch_variant" IS NULL OR "private"."valid_glass_variant"(split_part("sketch_variant", '_', 1), "sketch_variant"));

-- As 20261006300000_item_sketches.sql, plus "variant".
CREATE OR REPLACE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage', 'variant')) THEN
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
    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- A bar's glassware
-- ---------------------------------------------------------------------------

CREATE FUNCTION "private"."valid_source_urls"("p_urls" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest(p_urls) u WHERE u !~ '^https?://[^\s]+$' OR char_length(u) > 500);
$$;

CREATE TABLE "public"."bar_glassware" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "glass" "text" NOT NULL CHECK ("glass" IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
                                               'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer')),
    -- How it's drawn; null is the default drawing of its type.
    "variant" "text" CHECK ("variant" IS NULL OR "private"."valid_glass_variant"("glass", "variant")),
    -- The shape's name, and who makes and designed it: "Coupe", a maker, its
    -- designer, the series.
    "name" "text" CHECK ("name" IS NULL OR char_length(btrim("name")) BETWEEN 1 AND 80),
    "maker" "text" CHECK ("maker" IS NULL OR char_length(btrim("maker")) BETWEEN 1 AND 80),
    "designer" "text" CHECK ("designer" IS NULL OR char_length(btrim("designer")) BETWEEN 1 AND 80),
    "series" "text" CHECK ("series" IS NULL OR char_length(btrim("series")) BETWEEN 1 AND 80),
    -- What the shape is like, in words ("tall, narrow V on a short stem"):
    -- what a person or the research pass picks the variant from.
    "shape_note" "text" CHECK ("shape_note" IS NULL OR char_length("shape_note") <= 500),
    -- Where it was found: web pages only.
    "source_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL
        CHECK (cardinality("source_urls") <= 10 AND "private"."valid_source_urls"("source_urls")),
    -- The glass of its type the bar's drinks are drawn in.
    "is_default" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE INDEX "bar_glassware_bar_id_idx" ON "public"."bar_glassware" ("bar_id", "sort_order");
CREATE UNIQUE INDEX "bar_glassware_default_key" ON "public"."bar_glassware" ("bar_id", "glass") WHERE "is_default";

ALTER TABLE "public"."bar_glassware" ENABLE ROW LEVEL SECURITY;

-- Which glasses a bar uses is no secret: anyone signed in, like the bar itself.
CREATE POLICY "bar_glassware_select" ON "public"."bar_glassware" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "bar_glassware_write" ON "public"."bar_glassware" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('brand')))
    WITH CHECK ("bar_id" IN (SELECT "private"."bars_with_capability"('brand')));

REVOKE ALL ON "public"."bar_glassware" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."bar_glassware" TO "authenticated", "service_role";

CREATE FUNCTION "private"."screen_bar_glassware_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM private.refuse_screened(NEW.name, 'name', 'name');
    PERFORM private.refuse_screened(NEW.maker, 'maker', 'maker');
    PERFORM private.refuse_screened(NEW.designer, 'designer', 'designer');
    PERFORM private.refuse_screened(NEW.series, 'series', 'series');
    PERFORM private.refuse_screened(NEW.shape_note, 'note', 'shape_note');
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_bar_glassware_text"();

-- ---------------------------------------------------------------------------
-- The variant in the drawing inputs
-- ---------------------------------------------------------------------------

-- The drink's own pick for this glass, else its bar's default glass of it.
CREATE FUNCTION "private"."item_sketch_variant"("p_item_id" "uuid", "p_glass" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(
    CASE WHEN split_part(i.sketch_variant, '_', 1) = p_glass THEN i.sketch_variant END,
    (SELECT g.variant FROM public.bar_glassware g WHERE g.bar_id = i.bar_id AND g.glass = p_glass AND g.is_default)
  )
  FROM public.items i
  WHERE i.id = p_item_id;
$$;

CREATE FUNCTION "private"."item_sketches_set_variant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_variant text := private.item_sketch_variant(NEW.item_id, NEW.inputs ->> 'glass');
BEGIN
    NEW.inputs := CASE WHEN v_variant IS NULL THEN NEW.inputs - 'variant'
                       ELSE jsonb_set(NEW.inputs, '{variant}', to_jsonb(v_variant)) END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "set_variant" BEFORE INSERT OR UPDATE OF "inputs" ON "public"."item_sketches"
    FOR EACH ROW EXECUTE FUNCTION "private"."item_sketches_set_variant"();

-- A pick, a move to another bar, or a change to a bar's glassware redraws
-- the drinks it touches (set_variant above does the work).
CREATE FUNCTION "private"."refresh_item_sketch_variants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'items' THEN
        UPDATE public.item_sketches SET inputs = inputs WHERE item_id = NEW.id;
    ELSE
        UPDATE public.item_sketches s SET inputs = s.inputs
        FROM public.items i
        WHERE i.id = s.item_id
          AND i.bar_id IN (OLD.bar_id, NEW.bar_id)
          AND s.inputs ->> 'glass' IN (OLD.glass, NEW.glass);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "refresh_sketch_variant" AFTER UPDATE OF "sketch_variant", "bar_id" ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."sketch_variant" IS DISTINCT FROM NEW."sketch_variant" OR OLD."bar_id" IS DISTINCT FROM NEW."bar_id")
    EXECUTE FUNCTION "private"."refresh_item_sketch_variants"();
CREATE TRIGGER "refresh_sketch_variant" AFTER INSERT OR UPDATE OR DELETE ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."refresh_item_sketch_variants"();

-- ---------------------------------------------------------------------------
-- The worker's context: whether a drawing already exists
-- ---------------------------------------------------------------------------

-- As 20261006300000_item_sketches.sql, plus hasSketch.
CREATE OR REPLACE FUNCTION "public"."get_item_sketch_context"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'name', i.name,
    'description', i.description,
    'glass', g.name,
    'ice', x.name,
    'methods', coalesce((SELECT jsonb_agg(m.name ORDER BY im.sort_order NULLS LAST, m.name)
                         FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
                         WHERE im.item_id = i.id), '[]'::jsonb),
    'hasImage', EXISTS (SELECT 1 FROM public.item_images ii WHERE ii.item_id = i.id),
    'hasSketch', EXISTS (SELECT 1 FROM public.item_sketches s WHERE s.item_id = i.id),
    'ai', (SELECT jsonb_build_object('basis', a.basis, 'answer', a.answer) FROM private.item_sketch_ai a WHERE a.item_id = i.id)
  )
  FROM public.items i
  LEFT JOIN public.items g ON g.id = i.glassware_id
  LEFT JOIN public.items x ON x.id = i.ice_id
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- valid_glass_variant backs CHECK constraints on items and bar_glassware, which
-- run as whoever writes the row: it must stay executable by them.
REVOKE EXECUTE ON FUNCTION "private"."valid_glass_variant"("p_glass" "text", "p_variant" "text") FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "private"."valid_source_urls"("p_urls" "text"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."valid_source_urls"("p_urls" "text"[]) TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "private"."valid_glass_variant"("p_glass" "text", "p_variant" "text") TO "authenticated", "service_role";
REVOKE EXECUTE ON FUNCTION "private"."item_sketch_variant"("p_item_id" "uuid", "p_glass" "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_sketches_set_variant"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refresh_item_sketch_variants"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_bar_glassware_text"() FROM PUBLIC, "anon", "authenticated";
