-- What each ingredient is: a bottle, a house prep, or a style.
--
-- The "kind of" tree (generic_id) said Buffalo Trace is a kind of Bourbon,
-- but it couldn't say which rows are bottles you can buy, which are things a
-- bar makes, and which are just styles. So "Banana-Infused Michter's Bourbon"
-- sat beside Buffalo Trace as another "bourbon", and nothing tied it to the
-- Michter's it's made from.
--
--   items.ingredient_role   'product'  a bottle or packaged product you can buy
--                                      (Carpano Antica Formula, Fever-Tree Tonic)
--                           'prep'     made or changed in house (infusions,
--                                      fat-washes, house syrups and blends)
--                           'generic'  a style or plain ingredient (Bourbon,
--                                      Cask-Strength Bourbon, Lime Juice)
--                           NULL       not said yet (venue rows, new rows)
--   items.made_from_id      a prep's bottle: "Banana-Infused Michter's Bourbon"
--                           is made from Michter's US*1 Bourbon and stays a kind
--                           of Bourbon, so brand masking, spirit search and
--                           flavour rules keep reading a style, not a brand.
--
-- The shape, for shared ingredients: a kind of points at a style, never a
-- bottle. Saying a shared row is a kind of a bottle ("kind of Michter's")
-- stores it as made from that bottle and a kind of the bottle's style. A venue
-- keeps its own version of a bottle as a kind of it, as before. A row with a
-- maker and no role is a bottle; one made from something is a prep.
--
-- The data (roles, merges of copies of the same bottle, missing bottles and
-- the fixed parents) is the next migration.

ALTER TABLE "public"."items"
    ADD COLUMN "ingredient_role" "text",
    ADD COLUMN "made_from_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "items_ingredient_role" CHECK ("ingredient_role" IS NULL OR ("item_type" = 'ingredient' AND "ingredient_role" IN ('product', 'prep', 'generic'))),
    ADD CONSTRAINT "items_made_from_not_self" CHECK ("made_from_id" IS NULL OR "made_from_id" <> "id"),
    ADD CONSTRAINT "items_core_is_not_a_product" CHECK (NOT "is_core" OR "ingredient_role" IS DISTINCT FROM 'product');

COMMENT ON COLUMN "public"."items"."ingredient_role" IS
    'What an ingredient is: product (a bottle you can buy), prep (made in house), generic (a style or plain ingredient). NULL when not said.';
COMMENT ON COLUMN "public"."items"."made_from_id" IS
    'The bottle a prep is made from. Its generic_id stays the style, so masking and search read a style.';

CREATE INDEX "items_made_from_id_idx" ON "public"."items" ("made_from_id") WHERE "made_from_id" IS NOT NULL;
CREATE INDEX "items_products_by_generic_idx" ON "public"."items" ("generic_id", "name") WHERE "ingredient_role" = 'product';

-- ---------------------------------------------------------------------------
-- The shape
-- ---------------------------------------------------------------------------

-- Runs after guard_ingredient_name (which may set a generic from the name) and
-- guard_item_generic (which checks it): BEFORE triggers fire alphabetically.
CREATE FUNCTION "private"."shape_ingredient"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_parent public.items;
    v_hops integer := 0;
BEGIN
    IF NEW.item_type <> 'ingredient' THEN
        IF NEW.made_from_id IS NOT NULL THEN
            RAISE EXCEPTION 'Only an ingredient can be made from another.' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.made_from_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.items m
         WHERE m.id = NEW.made_from_id AND m.item_type = 'ingredient'
           AND (m.bar_id IS NULL OR m.bar_id = NEW.bar_id)
    ) THEN
        RAISE EXCEPTION 'A prep is made from a shared ingredient or one from its own venue.' USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NEW.bar_id IS NULL THEN
        -- A kind of a bottle is made from that bottle, and a kind of its style.
        LOOP
            SELECT * INTO v_parent FROM public.items WHERE id = NEW.generic_id;
            EXIT WHEN v_parent.id IS NULL OR v_parent.ingredient_role IS DISTINCT FROM 'product' OR v_hops > 4;
            IF NEW.ingredient_role IS DISTINCT FROM 'product' AND NEW.made_from_id IS NULL THEN
                NEW.made_from_id := v_parent.id;
            END IF;
            NEW.generic_id := CASE WHEN v_parent.generic_id = NEW.id THEN NULL ELSE v_parent.generic_id END;
            v_hops := v_hops + 1;
        END LOOP;

        IF NEW.ingredient_role IS NULL THEN
            NEW.ingredient_role := CASE
                WHEN NEW.made_from_id IS NOT NULL THEN 'prep'
                WHEN NULLIF(btrim(NEW.brand_maker), '') IS NOT NULL AND NOT NEW.is_core THEN 'product'
            END;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."shape_ingredient"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "shape_ingredient" BEFORE INSERT OR UPDATE OF "generic_id", "made_from_id", "ingredient_role", "brand_maker", "bar_id", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."shape_ingredient"();

-- ---------------------------------------------------------------------------
-- Merging keeps the shape
-- ---------------------------------------------------------------------------

-- 20261008100000's merge, plus: p_into can't end up made from itself, and it
-- takes the copy's role, maker, ABV, origin and description where it has none.
CREATE OR REPLACE FUNCTION "private"."merge_ingredient"("p_from" "uuid", "p_into" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from public.items;
    v_into public.items;
    v_fk record;
    v_ctid tid;
BEGIN
    SELECT * INTO v_from FROM public.items WHERE id = p_from;
    SELECT * INTO v_into FROM public.items WHERE id = p_into;
    IF v_from.id IS NULL OR v_into.id IS NULL OR p_from = p_into THEN
        RAISE EXCEPTION 'Pick two different ingredients.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_from.item_type <> 'ingredient' OR v_into.item_type <> 'ingredient' THEN
        RAISE EXCEPTION 'Only ingredients can be merged.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_into.bar_id IS NOT NULL AND v_from.bar_id IS DISTINCT FROM v_into.bar_id THEN
        RAISE EXCEPTION 'Merge into a shared ingredient, or one from the same venue.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    PERFORM set_config('app.ingredient_merge', 'on', true);
    -- Moving spec lines must not queue paid sketches for every drink.
    PERFORM set_config('app.image_worker', 'on', true);

    -- p_into can't end up a kind of itself, or made from itself.
    UPDATE public.items SET generic_id = CASE WHEN v_from.generic_id = p_into THEN NULL ELSE v_from.generic_id END
     WHERE id = p_into AND generic_id = p_from;
    UPDATE public.items SET made_from_id = CASE WHEN v_from.made_from_id = p_into THEN NULL ELSE v_from.made_from_id END
     WHERE id = p_into AND made_from_id = p_from;

    -- What the copy knew and p_into doesn't, p_into keeps.
    UPDATE public.items SET
        ingredient_role = COALESCE(ingredient_role, CASE WHEN is_core AND v_from.ingredient_role = 'product' THEN NULL ELSE v_from.ingredient_role END),
        brand_maker = COALESCE(NULLIF(btrim(brand_maker), ''), NULLIF(btrim(v_from.brand_maker), '')),
        abv = COALESCE(abv, v_from.abv),
        origin = COALESCE(NULLIF(btrim(origin), ''), NULLIF(btrim(v_from.origin), '')),
        description = COALESCE(NULLIF(btrim(description), ''), NULLIF(btrim(v_from.description), ''))
     WHERE id = p_into;

    -- A recipe, prep card or history belongs to one ingredient: when p_into has
    -- its own, the copy's goes rather than mixing into it.
    IF EXISTS (SELECT 1 FROM public.recipes WHERE recipe_item_id = p_into) THEN
        DELETE FROM public.recipes WHERE recipe_item_id = p_from;
    END IF;
    IF EXISTS (SELECT 1 FROM public.item_steps WHERE item_id = p_into) THEN
        DELETE FROM public.item_steps WHERE item_id = p_from;
    END IF;
    IF EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_into) THEN
        DELETE FROM public.item_versions WHERE item_id = p_from;
    END IF;

    FOR v_fk IN
        SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.contype = 'f' AND c.confrelid = 'public.items'::regclass AND array_length(c.conkey, 1) = 1
    LOOP
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
                    EXECUTE format('DELETE FROM %I.%I WHERE ctid = $1', v_fk.schema_name, v_fk.table_name) USING v_ctid;
                END;
            END LOOP;
        END;
    END LOOP;

    DELETE FROM public.items WHERE id = p_from;

    -- The copy's name now finds p_into (a venue's copy keeps its name private),
    -- unless another ingredient already goes by it ("Rosé" the wine, "Rose" the flower).
    IF v_from.bar_id IS NULL AND v_into.bar_id IS NULL
       AND public.ingredient_key(v_from.name) IS DISTINCT FROM public.ingredient_key(v_into.name)
       AND NOT EXISTS (
           SELECT 1 FROM public.items i
            WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
              AND public.ingredient_key(i.name) = public.ingredient_key(v_from.name)
       ) THEN
        INSERT INTO public.ingredient_aliases (key, item_id)
        VALUES (public.ingredient_key(v_from.name), p_into)
        ON CONFLICT (key) DO UPDATE SET item_id = EXCLUDED.item_id;
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."merge_ingredient"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- The app reads both
-- ---------------------------------------------------------------------------

-- 20261008140000's view, plus ingredient_role and made_from_id at the end.
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
    c.price,
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
    c.dilution_pct,
    c.serve_ml,
    c.serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    c.price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
