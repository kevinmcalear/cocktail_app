-- Drawing inputs: what a drink looks like, for the sketch the app paints when
-- it has no photo.
--
--   item_sketches            one row per cocktail: glass, ice, method, the
--                            liquid's colour, foam, float, drizzle, bubbles
--                            and garnish, with where each guess came from.
--                            Enums, numbers and hex colours only (checked
--                            below), never names, so it is readable wherever
--                            the drink is. Signed-out pages read published
--                            snapshots, not items, so they don't see these yet.
--   private.item_sketch_ai   the AI fill's answer about a whole drink (glass,
--                            ice, colour...), cached against what it was asked
--                            from so it is asked once. Server only.
--
-- No new queue: the flavor-worker computes these in the same job as the
-- flavor profile (supabase/functions/_shared/sketch.ts), from the same spec.
-- The job's fingerprint now also covers the drink's name, description,
-- glassware, ice and methods, and changing any of them re-queues it.
--
-- The worker only asks the AI fill about how a drink looks when the drink has
-- no picture. Catalog drinks (no venue, no creator) stay rules-only unless
-- CATALOG_AI_FILL=on is set on the function, which bills nobody's quota.

-- ---------------------------------------------------------------------------
-- What may be stored
-- ---------------------------------------------------------------------------

CREATE FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_hex constant text := '^#[0-9a-f]{6}$';
BEGIN
    IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k
               WHERE k NOT IN ('v', 'glass', 'ice', 'method', 'liquid', 'foam', 'float', 'bleed', 'fizz', 'garnish', 'from', 'coverage')) THEN
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
    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."item_sketches" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "inputs" "jsonb" NOT NULL CHECK ("private"."valid_sketch_inputs"("inputs")),
    -- 'ai' when any AI answer went into it.
    "source" "text" NOT NULL CHECK ("source" IN ('rules', 'ai')),
    "spec_fingerprint" "text" NOT NULL,
    "rules_version" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."item_sketches" ENABLE ROW LEVEL SECURITY;

-- Wherever the drink is readable: the subquery runs under the items policy.
CREATE POLICY "item_sketches_select" ON "public"."item_sketches" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id"));

-- Only the worker (service role) writes them.
REVOKE ALL ON "public"."item_sketches" FROM PUBLIC, "anon";
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "public"."item_sketches" FROM "authenticated";

CREATE TABLE "private"."item_sketch_ai" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    -- A hash of what the model was shown (name, description, ingredient
    -- names); a drink whose basis changes is asked again.
    "basis" "text" NOT NULL,
    "answer" "jsonb" NOT NULL CHECK (jsonb_typeof("answer") = 'object'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "private"."item_sketch_ai" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The job's fingerprint and queue
-- ---------------------------------------------------------------------------

-- Version 2: everything the flavor profile and the drawing inputs are computed
-- from. The spec lines as 20260930960000_ingredient_generics left them (each
-- line's generic too), plus the drink's name, description, glassware, ice and
-- methods.
CREATE OR REPLACE FUNCTION "private"."item_flavor_fingerprint"("p_item_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT md5(jsonb_build_object(
    'v', 2,
    'parts', (
      SELECT jsonb_agg(jsonb_build_array(r.ingredient_item_id, coalesce(r.parent_ingredient_id, s.generic_id), r.amount, r.unit, s.name, g.name)
                       ORDER BY r.sort_order, r.id)
      FROM public.recipes r
      LEFT JOIN public.items s ON s.id = r.ingredient_item_id
      LEFT JOIN public.items g ON g.id = coalesce(r.parent_ingredient_id, s.generic_id)
      WHERE r.recipe_item_id = i.id
    ),
    'name', i.name,
    'description', i.description,
    'glass', i.glassware_id,
    'ice', i.ice_id,
    'methods', (SELECT jsonb_agg(m.method_item_id ORDER BY m.method_item_id) FROM public.item_methods m WHERE m.item_id = i.id)
  )::text)
  FROM public.items i
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- Re-queues a drink when how it's served changes: its glassware, ice,
-- description or methods. (Name and spec changes already queue it.)
CREATE FUNCTION "private"."queue_item_sketch_job"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'item_methods' THEN
        IF TG_OP <> 'DELETE' THEN PERFORM private.enqueue_item_flavor_job(NEW.item_id); END IF;
        IF TG_OP <> 'INSERT' THEN PERFORM private.enqueue_item_flavor_job(OLD.item_id); END IF;
    ELSE
        PERFORM private.enqueue_item_flavor_job(NEW.id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "queue_item_sketch_job" AFTER UPDATE OF "glassware_id", "ice_id", "description" ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."glassware_id" IS DISTINCT FROM NEW."glassware_id"
          OR OLD."ice_id" IS DISTINCT FROM NEW."ice_id"
          OR OLD."description" IS DISTINCT FROM NEW."description")
    EXECUTE FUNCTION "private"."queue_item_sketch_job"();
CREATE TRIGGER "queue_item_sketch_job" AFTER INSERT OR DELETE OR UPDATE ON "public"."item_methods"
    FOR EACH ROW EXECUTE FUNCTION "private"."queue_item_sketch_job"();

-- ---------------------------------------------------------------------------
-- Worker RPCs (service role only)
-- ---------------------------------------------------------------------------

-- What the drawing rules read beyond the spec: the drink's name, description,
-- glassware, ice and method names, whether it has a picture, and any cached
-- AI answer. Raw text: for the worker only, never the app.
CREATE FUNCTION "public"."get_item_sketch_context"("p_item_id" "uuid") RETURNS "jsonb"
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
    'ai', (SELECT jsonb_build_object('basis', a.basis, 'answer', a.answer) FROM private.item_sketch_ai a WHERE a.item_id = i.id)
  )
  FROM public.items i
  LEFT JOIN public.items g ON g.id = i.glassware_id
  LEFT JOIN public.items x ON x.id = i.ice_id
  WHERE i.id = p_item_id AND i.item_type = 'cocktail';
$$;

-- Saves a drink's drawing inputs, and the AI answer about the whole drink when
-- one was asked. Doesn't touch the job: save_item_flavor completes it.
CREATE FUNCTION "public"."save_item_sketch"(
    "p_item_id" "uuid",
    "p_inputs" "jsonb",
    "p_source" "text",
    "p_spec_fingerprint" "text",
    "p_rules_version" integer,
    "p_ai_basis" "text" DEFAULT NULL,
    "p_ai_answer" "jsonb" DEFAULT NULL
) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id AND item_type = 'cocktail') THEN
        RETURN;
    END IF;

    IF p_ai_basis IS NOT NULL AND p_ai_answer IS NOT NULL THEN
        INSERT INTO private.item_sketch_ai (item_id, basis, answer)
        VALUES (p_item_id, p_ai_basis, p_ai_answer)
        ON CONFLICT (item_id) DO UPDATE SET basis = excluded.basis, answer = excluded.answer, created_at = now();
    END IF;

    INSERT INTO public.item_sketches AS s (item_id, inputs, source, spec_fingerprint, rules_version, updated_at)
    VALUES (p_item_id, p_inputs, p_source, p_spec_fingerprint, p_rules_version, now())
    ON CONFLICT (item_id) DO UPDATE SET
        inputs = excluded.inputs, source = excluded.source, spec_fingerprint = excluded.spec_fingerprint,
        rules_version = excluded.rules_version, updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "private"."valid_sketch_inputs"("p" "jsonb") TO "service_role";
REVOKE EXECUTE ON FUNCTION "private"."queue_item_sketch_job"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."get_item_sketch_context"("p_item_id" "uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."save_item_sketch"("p_item_id" "uuid", "p_inputs" "jsonb", "p_source" "text", "p_spec_fingerprint" "text", "p_rules_version" integer, "p_ai_basis" "text", "p_ai_answer" "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_item_sketch_context"("p_item_id" "uuid") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."save_item_sketch"("p_item_id" "uuid", "p_inputs" "jsonb", "p_source" "text", "p_spec_fingerprint" "text", "p_rules_version" integer, "p_ai_basis" "text", "p_ai_answer" "jsonb") TO "service_role";

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Every cocktail gets drawing inputs once the worker is reachable. The rules
-- cost nothing; the AI fill only runs for drinks with no picture and a payer
-- (or CATALOG_AI_FILL=on), and only with FLAVOR_MODEL=live.
SELECT private.enqueue_item_flavors();
