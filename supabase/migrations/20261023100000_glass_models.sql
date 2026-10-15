-- Glass models: the real glasses you can buy, one row per model and size
-- ("Nude Savage Coupe, 190 ml"), after 20261021100000. Kevin, 15 Oct 2026:
-- "let's definitely do" a model-level glass catalog (7 Oct jam: "every coupe
-- in existence that you can buy").
--
--   glass_models               a maker's glass: which maker page makes it, which
--                              catalog shape it is a kind of (the Coupe item),
--                              how it's drawn (glass + variant from
--                              lib/sketch/geometry.ts), and the maker's facts:
--                              capacity, height, rim, material, item code, page.
--                              Loaded from makers' own catalogs with the pages
--                              cited; no copied text or photos, drawings stay
--                              ours. Anyone reads it; only loads write it.
--   bar_glassware.model_id     a venue's glass names its model. Picking one fills
--                              what the row leaves empty (type, drawing, name,
--                              series, designer, maker and maker page); the
--                              bar's own words always win.
--   items.glass_model_id       a drink names the model it's served in. It keeps
--                              glassware_id as the shape (search, filters, My
--                              Bar read that), set from the model; picking
--                              another shape lets go of the model.
--   item_sketch_variant        a drink is drawn in its own pick, else its
--                              model's drawing, else its bar's glass.

CREATE TABLE "public"."glass_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    -- A maker's page that makes glassware (checked below).
    "maker_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    -- The catalog shape it is a kind of: a shared glassware item (checked below).
    "shape_item_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "glass" "text" NOT NULL CHECK ("glass" IN ('coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
                                               'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer')),
    -- How it's drawn; null is the default drawing of its type.
    "variant" "text" CHECK ("variant" IS NULL OR "private"."valid_glass_variant"("glass", "variant")),
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
    "series" "text" CHECK ("series" IS NULL OR char_length(btrim("series")) BETWEEN 1 AND 80),
    "designer" "text" CHECK ("designer" IS NULL OR char_length(btrim("designer")) BETWEEN 1 AND 80),
    -- The maker's own item number.
    "model_code" "text" CHECK ("model_code" IS NULL OR char_length(btrim("model_code")) BETWEEN 1 AND 40),
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL CHECK (cardinality("aliases") <= 10),
    -- To the brim, in ml, and the maker's own words for it ("7 1/2 oz").
    "capacity_ml" numeric CHECK ("capacity_ml" IS NULL OR ("capacity_ml" > 0 AND "capacity_ml" < 5000)),
    "capacity_as_stated" "text" CHECK ("capacity_as_stated" IS NULL OR char_length("capacity_as_stated") <= 40),
    "height_mm" numeric CHECK ("height_mm" IS NULL OR ("height_mm" > 0 AND "height_mm" < 1000)),
    "rim_mm" numeric CHECK ("rim_mm" IS NULL OR ("rim_mm" > 0 AND "rim_mm" < 500)),
    "material" "text" CHECK ("material" IS NULL OR "material" IN ('glass', 'crystal', 'lead-free crystal', 'ceramic', 'metal', 'plastic')),
    -- The maker's page for it, and where each fact was read: web pages only.
    "product_url" "text" CHECK ("product_url" IS NULL OR "private"."valid_source_urls"(ARRAY["product_url"])),
    "source_urls" "text"[] NOT NULL
        CHECK (cardinality("source_urls") BETWEEN 1 AND 10 AND "private"."valid_source_urls"("source_urls")),
    "discontinued" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON TABLE "public"."glass_models" IS
    'Real glasses you can buy: a maker''s model and size, a kind of a catalog shape, drawn as one of our glass variants. Facts from the maker''s own catalog, pages in source_urls.';

-- A load re-runs by maker, name and size.
CREATE UNIQUE INDEX "glass_models_key" ON "public"."glass_models"
    ("maker_profile_id", "public"."ingredient_key"("name"), coalesce("capacity_ml", 0));
CREATE INDEX "glass_models_glass_idx" ON "public"."glass_models" ("glass", "name");
-- ponytail: a name search is an ilike over a few thousand rows; add pg_trgm if the catalog grows past ~50k.

ALTER TABLE "public"."glass_models" ENABLE ROW LEVEL SECURITY;

-- Catalog facts, like maker pages: anyone reads them, signed in or not.
CREATE POLICY "glass_models_select" ON "public"."glass_models" FOR SELECT TO "anon", "authenticated" USING (true);

REVOKE ALL ON "public"."glass_models" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."glass_models" TO "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."glass_models" TO "service_role";

-- A model's maker makes glassware; its shape is a shared glassware item.
CREATE FUNCTION "private"."guard_glass_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.maker_profile_id AND kind = 'maker' AND 'glassware' = ANY (makes)
    ) THEN
        RAISE EXCEPTION 'A glass model''s maker must be a maker''s page that makes glassware.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.shape_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.items WHERE id = NEW.shape_item_id AND item_type = 'glassware' AND bar_id IS NULL
    ) THEN
        RAISE EXCEPTION 'A glass model''s shape must be a shared glassware item.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard" BEFORE INSERT OR UPDATE ON "public"."glass_models"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_glass_model"();

-- Find a glass: every word typed is somewhere in its maker, name, series,
-- designer, item code or other names ("libbey coupe", "fenwick 190"), and it
-- is of the type asked for, if any. Runs as the caller (anyone reads both).
CREATE FUNCTION "public"."search_glass_models"("p_query" "text", "p_glass" "text" DEFAULT NULL, "p_limit" integer DEFAULT 40)
    RETURNS SETOF "public"."glass_models"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT m.*
  FROM public.glass_models m
  JOIN public.profiles p ON p.id = m.maker_profile_id
  WHERE (p_glass IS NULL OR m.glass = p_glass)
    AND NOT EXISTS (
      SELECT 1 FROM regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') w
      WHERE w <> '' AND position(w IN lower(concat_ws(' ', p.display_name, m.name, m.series, m.designer, m.model_code,
                                                       array_to_string(m.aliases, ' '), m.capacity_ml::text))) = 0
    )
  ORDER BY m.discontinued, p.display_name, m.name, m.capacity_ml NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION "public"."search_glass_models"("p_query" "text", "p_glass" "text", "p_limit" integer) TO "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- A venue's glass names its model
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."bar_glassware"
    ADD COLUMN "model_id" "uuid" REFERENCES "public"."glass_models"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."bar_glassware"."model_id" IS
    'The real glass this is, when the bar has picked one. Fills what the row leaves empty; the row''s own words win.';

CREATE INDEX "bar_glassware_model_id_idx" ON "public"."bar_glassware" ("model_id") WHERE "model_id" IS NOT NULL;

-- Picking a model makes the row that glass: its type, and its drawing unless
-- the bar drew it its own way. Text the bar left empty comes from the model.
CREATE FUNCTION "private"."bar_glassware_fill_from_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    m public.glass_models;
BEGIN
    IF NEW.model_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.model_id IS NOT DISTINCT FROM OLD.model_id) THEN
        RETURN NEW;
    END IF;
    SELECT * INTO m FROM public.glass_models WHERE id = NEW.model_id;
    NEW.variant := CASE WHEN NEW.glass = m.glass AND NEW.variant IS NOT NULL THEN NEW.variant ELSE m.variant END;
    NEW.glass := m.glass;
    NEW.name := coalesce(NEW.name, m.name);
    NEW.series := coalesce(NEW.series, m.series);
    NEW.designer := coalesce(NEW.designer, m.designer);
    NEW.maker_profile_id := coalesce(NEW.maker_profile_id, m.maker_profile_id);
    NEW.maker := coalesce(NEW.maker, (SELECT p.display_name FROM public.profiles p WHERE p.id = m.maker_profile_id));
    RETURN NEW;
END;
$$;

-- Before guard_maker and screen_text (triggers fire by name).
CREATE TRIGGER "fill_from_model" BEFORE INSERT OR UPDATE OF "model_id" ON "public"."bar_glassware"
    FOR EACH ROW EXECUTE FUNCTION "private"."bar_glassware_fill_from_model"();

-- ---------------------------------------------------------------------------
-- A drink names its model
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."items"
    ADD COLUMN "glass_model_id" "uuid" REFERENCES "public"."glass_models"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."items"."glass_model_id" IS
    'Cocktails: the real glass it''s served in. glassware_id stays the shape, set from the model.';

CREATE INDEX "items_glass_model_id_idx" ON "public"."items" ("glass_model_id") WHERE "glass_model_id" IS NOT NULL;

-- Only drinks name a model. Picking one sets the drink's shape to the model's;
-- picking another shape (and no model) lets the model go.
CREATE FUNCTION "private"."items_glass_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_shape uuid;
BEGIN
    IF NEW.glass_model_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.item_type <> 'cocktail' THEN
        RAISE EXCEPTION 'Only a drink is served in a glass model.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT shape_item_id INTO v_shape FROM public.glass_models WHERE id = NEW.glass_model_id;
    IF TG_OP = 'INSERT' OR NEW.glass_model_id IS DISTINCT FROM OLD.glass_model_id THEN
        NEW.glassware_id := coalesce(v_shape, NEW.glassware_id);
    ELSIF NEW.glassware_id IS DISTINCT FROM OLD.glassware_id AND NEW.glassware_id IS DISTINCT FROM v_shape THEN
        NEW.glass_model_id := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "glass_model" BEFORE INSERT OR UPDATE OF "glass_model_id", "glassware_id", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."items_glass_model"();

-- ---------------------------------------------------------------------------
-- The drawing follows the model
-- ---------------------------------------------------------------------------

-- As 20261007100000: the drink's own pick for this glass, then (new) its
-- model's drawing, then its bar's default glass of it.
CREATE OR REPLACE FUNCTION "private"."item_sketch_variant"("p_item_id" "uuid", "p_glass" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT coalesce(
    CASE WHEN split_part(i.sketch_variant, '_', 1) = p_glass THEN i.sketch_variant END,
    (SELECT m.variant FROM public.glass_models m WHERE m.id = i.glass_model_id AND m.glass = p_glass),
    (SELECT g.variant FROM public.bar_glassware g
     WHERE g.profile_id = private.item_bar_profile(i.id) AND g.glass = p_glass AND g.is_default)
  )
  FROM public.items i
  WHERE i.id = p_item_id;
$$;

-- As 20261007100000, plus glass_model_id.
DROP TRIGGER "refresh_sketch_variant" ON "public"."items";
CREATE TRIGGER "refresh_sketch_variant" AFTER UPDATE OF "sketch_variant", "bar_id", "origin_bar_profile_id", "glass_model_id" ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."sketch_variant" IS DISTINCT FROM NEW."sketch_variant" OR OLD."bar_id" IS DISTINCT FROM NEW."bar_id"
          OR OLD."origin_bar_profile_id" IS DISTINCT FROM NEW."origin_bar_profile_id"
          OR OLD."glass_model_id" IS DISTINCT FROM NEW."glass_model_id")
    EXECUTE FUNCTION "private"."refresh_item_sketch_variants"();

REVOKE EXECUTE ON FUNCTION "private"."guard_glass_model"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."bar_glassware_fill_from_model"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."items_glass_model"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."item_sketch_variant"("p_item_id" "uuid", "p_glass" "text") FROM PUBLIC, "anon", "authenticated";
