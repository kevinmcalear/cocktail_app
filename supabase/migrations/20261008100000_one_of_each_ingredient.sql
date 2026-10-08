-- One of each ingredient.
--
-- The shared ingredient list had grown copies of the same thing under other
-- names: "Simple Syrup", "Sugar Syrup", "1:1 Sugar Syrup", "Simple Syrup,
-- 1:1" and "Syrup" were five rows for one recipe. Every copy splits search,
-- the flavor rules and "what pairs with what". The rule from now on: one
-- row per thing. A different recipe is a different row (Rich Simple Syrup,
-- 2:1), and a house or flavoured version is its own row that says what it is
-- a kind of (generic_id), never a second "Simple Syrup".
--
--   ingredient_key(name)   one spelling of a name: lower case, no accents or
--                          punctuation, "&" as "and". "Simple Syrup, 1:1" and
--                          "simple syrup 1:1" share a key.
--   ingredient_aliases     other names for an ingredient ("1:1 sugar syrup" ->
--                          Simple Syrup), so typing one finds the other.
--   items.is_core          the curated list of plain, brand-free ingredients
--                          that pickers show first and pairings count.
--   guard                  a new shared ingredient can't take a name (or
--                          alias) that's already taken. A venue may keep its
--                          own version under the same name only as a kind of
--                          the shared one. A new shared ingredient whose name
--                          ends with a core one's ("Lavender Simple Syrup")
--                          becomes a kind of it.
--   merge_ingredients()    app admins fold a copy into the real one: every
--                          reference moves, the copy's name becomes an alias.
--   resolve_ingredient()   the shared ingredient a typed name means.
--
-- The cleanup of the existing rows is the next migration; the one-name index
-- is added after it (20261008100200).

-- ---------------------------------------------------------------------------
-- The key
-- ---------------------------------------------------------------------------

CREATE FUNCTION "public"."ingredient_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
    SELECT NULLIF(btrim(regexp_replace(regexp_replace(
        translate(lower(COALESCE(p_name, '')),
            'àáâãäåāçćčèéêëēěìíîïīñńòóôõöøōùúûüūýÿžšœæ''’‘`´',
            'aaaaaaa' || 'ccc' || 'eeeeee' || 'iiiii' || 'nn' || 'ooooooo' || 'uuuuu' || 'yy' || 'zs'),
        '&', ' and ', 'g'),
        '[^a-z0-9:]+', ' ', 'g')), '');
$$;

COMMENT ON FUNCTION "public"."ingredient_key"("text") IS
    'One spelling of an ingredient name: lower case, no accents or punctuation. Two names with the same key are the same ingredient.';

GRANT EXECUTE ON FUNCTION "public"."ingredient_key"("text") TO "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- Core ingredients
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."items"
    ADD COLUMN "is_core" boolean DEFAULT false NOT NULL,
    ADD CONSTRAINT "items_core_is_shared_ingredient" CHECK (NOT "is_core" OR ("item_type" = 'ingredient' AND "bar_id" IS NULL));

COMMENT ON COLUMN "public"."items"."is_core" IS
    'A curated, brand-free ingredient (Simple Syrup, Lime Juice, London Dry Gin). Pickers show these first; pairings count drinks at this level.';

CREATE INDEX "items_core_idx" ON "public"."items" ("name") WHERE "is_core";

-- Only app admins curate the core list (SQL and the service role run without a user).
CREATE FUNCTION "private"."guard_item_core"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF auth.uid() IS NULL OR private.is_app_admin() THEN
        RETURN NEW;
    END IF;
    IF (TG_OP = 'INSERT' AND NEW.is_core) OR (TG_OP = 'UPDATE' AND NEW.is_core IS DISTINCT FROM OLD.is_core) THEN
        RAISE EXCEPTION 'Only app admins can change the core ingredient list.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_item_core"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_item_core" BEFORE INSERT OR UPDATE OF "is_core" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_core"();

-- ---------------------------------------------------------------------------
-- Aliases
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."ingredient_aliases" (
    "key" "text" PRIMARY KEY CHECK ("key" = "public"."ingredient_key"("key")),
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON TABLE "public"."ingredient_aliases" IS
    'Other names for a shared ingredient, as ingredient_key()s: "1:1 sugar syrup" -> Simple Syrup. Typing an alias finds the ingredient; it can''t be made again.';

CREATE INDEX "ingredient_aliases_item_idx" ON "public"."ingredient_aliases" ("item_id");

ALTER TABLE "public"."ingredient_aliases" ENABLE ROW LEVEL SECURITY;

-- Names of shared ingredients are public; only app admins (and SQL) change them.
CREATE POLICY "Anyone reads ingredient aliases" ON "public"."ingredient_aliases"
    FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "App admins manage ingredient aliases" ON "public"."ingredient_aliases"
    FOR ALL TO "authenticated" USING ("private"."is_app_admin"()) WITH CHECK ("private"."is_app_admin"());

GRANT SELECT ON TABLE "public"."ingredient_aliases" TO "anon", "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."ingredient_aliases" TO "authenticated";

-- An alias points at a shared ingredient, never at a venue's own.
CREATE FUNCTION "private"."guard_ingredient_alias"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = NEW.item_id AND i.item_type = 'ingredient' AND i.bar_id IS NULL) THEN
        RAISE EXCEPTION 'An alias must name a shared ingredient.' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.id <> NEW.item_id
          AND public.ingredient_key(i.name) = NEW.key
    ) THEN
        RAISE EXCEPTION 'Another ingredient is already called that.' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_ingredient_alias"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "guard_ingredient_alias" BEFORE INSERT OR UPDATE ON "public"."ingredient_aliases"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_ingredient_alias"();

-- ---------------------------------------------------------------------------
-- What a name means
-- ---------------------------------------------------------------------------

-- The shared ingredient a name means: one with that key, else an alias's.
CREATE FUNCTION "public"."resolve_ingredient"("p_name" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT COALESCE(
        (SELECT i.id FROM public.items i
          WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
            AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
          ORDER BY i.is_core DESC, i.created_at LIMIT 1),
        (SELECT a.item_id FROM public.ingredient_aliases a WHERE a.key = public.ingredient_key(p_name)));
$$;

GRANT EXECUTE ON FUNCTION "public"."resolve_ingredient"("text") TO "anon", "authenticated";

-- The core ingredient a new name is a version of: the longest core name it
-- ends with, on a word boundary ("lavender simple syrup" -> Simple Syrup).
-- English puts the thing last, so "gin syrup" is a syrup, not a gin.
CREATE FUNCTION "private"."core_suffix_of"("p_key" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT c.id FROM public.items c
     WHERE c.is_core AND public.ingredient_key(c.name) <> p_key
       AND p_key LIKE '% ' || public.ingredient_key(c.name)
     ORDER BY length(c.name) DESC, c.created_at
     LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION "private"."core_suffix_of"("text") FROM PUBLIC, "anon", "authenticated";

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------

CREATE FUNCTION "private"."guard_ingredient_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_key text := public.ingredient_key(NEW.name);
    v_same uuid;
    v_same_name text;
BEGIN
    IF NEW.item_type <> 'ingredient' OR v_key IS NULL THEN RETURN NEW; END IF;
    -- Cleanups that rename on purpose say so.
    IF current_setting('app.ingredient_merge', true) = 'on' THEN RETURN NEW; END IF;
    -- Saving a row without touching its name, place or generic never trips this.
    IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.bar_id IS NOT DISTINCT FROM OLD.bar_id
       AND NEW.generic_id IS NOT DISTINCT FROM OLD.generic_id THEN
        RETURN NEW;
    END IF;

    SELECT i.id, i.name INTO v_same, v_same_name FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.id <> NEW.id
       AND public.ingredient_key(i.name) = v_key
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
    IF v_same IS NULL THEN
        SELECT a.item_id, i.name INTO v_same, v_same_name
          FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
         WHERE a.key = v_key AND a.item_id <> NEW.id;
    END IF;

    IF v_same IS NOT NULL THEN
        -- A venue's own version of a shared ingredient is fine, as long as it says so.
        IF NEW.bar_id IS NOT NULL AND NEW.generic_id = v_same THEN RETURN NEW; END IF;
        -- P0001 so the app shows the message as written; the hint is the one to use.
        RAISE EXCEPTION '% is already an ingredient. Use it, or make your own version of it.', v_same_name
            USING HINT = v_same::text;
    END IF;

    -- A new ingredient named after a core one is a version of it.
    IF TG_OP = 'INSERT' AND NEW.generic_id IS NULL AND NOT NEW.is_core THEN
        NEW.generic_id := private.core_suffix_of(v_key);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."guard_ingredient_name"() FROM PUBLIC, "anon", "authenticated";

-- Runs before guard_item_generic (alphabetical), which checks what it set.
CREATE TRIGGER "guard_ingredient_name" BEFORE INSERT OR UPDATE OF "name", "bar_id", "generic_id", "item_type" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_ingredient_name"();

-- ---------------------------------------------------------------------------
-- Merging a copy into the real one
-- ---------------------------------------------------------------------------

-- Moves every reference to p_from onto p_into, keeps p_from's name as an
-- alias of p_into, and deletes p_from. Rows that would then clash (p_into
-- already has a category, a flavor row, a cost) keep p_into's and drop the
-- copy's. Works off the catalog of foreign keys, so a table added later is
-- covered without changing this.
CREATE FUNCTION "private"."merge_ingredient"("p_from" "uuid", "p_into" "uuid") RETURNS "void"
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

    -- p_into can't end up a kind of itself.
    UPDATE public.items SET generic_id = CASE WHEN v_from.generic_id = p_into THEN NULL ELSE v_from.generic_id END
     WHERE id = p_into AND generic_id = p_from;

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

-- For the app: app admins only.
CREATE FUNCTION "public"."merge_ingredients"("p_from" "uuid", "p_into" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT private.is_app_admin() THEN
        RAISE EXCEPTION 'Only app admins can merge ingredients.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    PERFORM private.merge_ingredient(p_from, p_into);
END;
$$;
REVOKE EXECUTE ON FUNCTION "public"."merge_ingredients"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."merge_ingredients"("uuid", "uuid") TO "authenticated";

-- ---------------------------------------------------------------------------
-- The app reads is_core
-- ---------------------------------------------------------------------------

-- Same columns as 20261001150000, plus is_core at the end.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
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
    c.is_core
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
