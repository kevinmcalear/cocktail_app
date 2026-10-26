-- A drink made in parts (QA Q20b, 25 Oct 2026; approved by Kevin 26 Oct).
--
-- A tester added a Pelican, a drink made in two parts (a drink, then a cream
-- whipped and floated on it). Made in parts on the wizard's Method step gives
-- each part a name, the spec lines it uses, its own methods and, for a later
-- part, how it joins the first (Float on top, Pour in).
--
--   items.parts            the parts in order: [{"name": "The coffee"},
--                          {"name": "The cream", "join": "float"}]. Null is a
--                          drink in one part, as every drink so far.
--   recipes.part           which part a spec line belongs to (1 when one part)
--   item_methods.part      which part a method belongs to; its primary key
--                          gains the part, so Build can be in two parts
--   save_drink_spec        takes each line's part, the methods' parts and the
--                          parts; left out, each keeps what it had, so the
--                          drink editor keeps a drink's parts without knowing
--                          about them
--   drink_snapshot,        versions keep the parts and put them back
--   restore_drink_version
--   app_recipe_presentation  adds each line's part
--
-- Make mode, the run sheet and the public page still read one list; they
-- learn parts in a follow-up.

-- --- the columns ---

CREATE OR REPLACE FUNCTION "private"."drink_parts_ok"("p_parts" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_parts IS NULL OR (
    jsonb_typeof(p_parts) = 'array'
    AND jsonb_array_length(p_parts) BETWEEN 2 AND 9
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_parts) WITH ORDINALITY AS e(part, n)
       WHERE jsonb_typeof(e.part) <> 'object'
          OR jsonb_typeof(e.part -> 'name') IS DISTINCT FROM 'string'
          OR length(btrim(e.part ->> 'name')) NOT BETWEEN 1 AND 60
          OR (e.part ? 'join' AND jsonb_typeof(e.part -> 'join') <> 'null' AND (e.n = 1 OR (e.part ->> 'join') NOT IN ('float', 'pour')))
          OR EXISTS (SELECT 1 FROM jsonb_object_keys(e.part) k WHERE k NOT IN ('name', 'join'))));
$$;

ALTER TABLE "public"."items"
    ADD COLUMN "parts" "jsonb",
    ADD CONSTRAINT "items_parts_ok" CHECK ("private"."drink_parts_ok"("parts"));

ALTER TABLE "public"."recipes"
    ADD COLUMN "part" smallint DEFAULT 1 NOT NULL,
    ADD CONSTRAINT "recipes_part_range" CHECK ("part" BETWEEN 1 AND 9);

ALTER TABLE "public"."item_methods"
    ADD COLUMN "part" smallint DEFAULT 1 NOT NULL,
    ADD CONSTRAINT "item_methods_part_range" CHECK ("part" BETWEEN 1 AND 9),
    DROP CONSTRAINT "item_methods_pkey",
    ADD CONSTRAINT "item_methods_pkey" PRIMARY KEY ("item_id", "part", "method_item_id");

-- --- saving ---

-- As 20261007200000_drink_methods.sql, with the parts. A line's "part", the
-- methods' p_method_parts (one per method, in the same order) and p_parts
-- (the parts, or JSON null for one part) are each optional: left out, a line
-- kept by id keeps its part, a method keeps the part it had, and the drink
-- keeps its parts. A line or method in a part the drink doesn't have is
-- refused.
DROP FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid"[], "text");

CREATE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_ids" "uuid"[], "p_note" "text", "p_method_parts" smallint[] DEFAULT NULL, "p_parts" "jsonb" DEFAULT NULL) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_line jsonb;
    v_index integer := 0;
    v_kept uuid[] := '{}';
    v_id uuid;
    v_part smallint;
    v_had_versions boolean;
    v_old_methods jsonb;
    v_count integer;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'Lines must be a list.'; END IF;
    IF p_method_parts IS NOT NULL AND cardinality(p_method_parts) <> cardinality(COALESCE(p_method_ids, '{}')) THEN
        RAISE EXCEPTION 'Give each method its part.';
    END IF;

    -- The first save through here records how the drink was before it.
    SELECT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_item) INTO v_had_versions;
    IF NOT v_had_versions THEN
        PERFORM private.write_drink_version(p_item, 'As it was before versions were kept');
    END IF;

    IF p_parts IS NOT NULL THEN
        UPDATE public.items SET parts = CASE WHEN jsonb_typeof(p_parts) = 'null' THEN NULL ELSE p_parts END WHERE id = p_item;
    END IF;
    SELECT COALESCE(jsonb_array_length(parts), 1) INTO v_count FROM public.items WHERE id = p_item;

    -- Positions are unique per drink, so move the old rows out of the way first.
    UPDATE public.recipes SET sort_order = sort_order + 100000 WHERE recipe_item_id = p_item;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_id := NULLIF(v_line ->> 'id', '')::uuid;
        IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.recipes WHERE id = v_id AND recipe_item_id = p_item) THEN
            v_id := NULL;
        END IF;
        v_part := COALESCE(NULLIF(v_line ->> 'part', '')::smallint, (SELECT part FROM public.recipes WHERE id = v_id), 1);
        IF v_part > v_count THEN RAISE EXCEPTION 'A line is in part %, and the drink has %.', v_part, v_count; END IF;
        IF v_id IS NOT NULL THEN
            UPDATE public.recipes
               SET ingredient_item_id = (v_line ->> 'ingredient_item_id')::uuid,
                   amount = NULLIF(v_line ->> 'amount', '')::numeric,
                   unit = NULLIF(v_line ->> 'unit', ''),
                   preparation_notes = NULLIF(v_line ->> 'preparation_notes', ''),
                   is_optional = COALESCE((v_line ->> 'is_optional')::boolean, false),
                   part = v_part,
                   sort_order = v_index
             WHERE id = v_id;
        ELSE
            INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, part, sort_order)
            VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                    NULLIF(v_line ->> 'preparation_notes', ''), COALESCE((v_line ->> 'is_optional')::boolean, false), v_part, v_index)
            RETURNING id INTO v_id;
        END IF;
        v_kept := v_kept || v_id;
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item AND NOT (id = ANY (v_kept));

    -- Methods in the order given, each in its part (or the part it had). Unknown ids and repeats are skipped.
    SELECT jsonb_object_agg(method_item_id::text, part) INTO v_old_methods
      FROM (SELECT DISTINCT ON (method_item_id) method_item_id, part FROM public.item_methods WHERE item_id = p_item ORDER BY method_item_id, sort_order) o;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    INSERT INTO public.item_methods (item_id, method_item_id, part, sort_order)
    SELECT p_item, m.id, u.part, (min(u.ord) - 1)::integer
      FROM (SELECT x.id, x.ord, COALESCE(p_method_parts[x.ord], (v_old_methods ->> x.id::text)::smallint, 1) AS part
              FROM unnest(COALESCE(p_method_ids, '{}')) WITH ORDINALITY AS x(id, ord)) u
      JOIN public.items m ON m.id = u.id AND m.item_type = 'method'
     GROUP BY m.id, u.part;
    IF EXISTS (SELECT 1 FROM public.item_methods WHERE item_id = p_item AND part > v_count) THEN
        RAISE EXCEPTION 'A method is in a part the drink doesn''t have.';
    END IF;

    RETURN private.write_drink_version(p_item, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid"[], "text", smallint[], "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."save_drink_spec"("uuid", "jsonb", "uuid"[], "text", smallint[], "jsonb") TO "authenticated", "service_role";

-- --- versions ---

-- As 20261010100000_bar_page_direct_reads.sql, with each line's part, the
-- methods' parts and the parts.
CREATE OR REPLACE FUNCTION "private"."drink_snapshot"("p_item" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ingredient_item_id', r.ingredient_item_id,
        'name', ing.name,
        'amount', r.amount,
        'unit', r.unit,
        'note', r.preparation_notes,
        'optional', COALESCE(r.is_optional, false),
        'at_service', r.at_service,
        'part', r.part) ORDER BY r.sort_order, r.created_at)
      FROM public.recipes r LEFT JOIN public.items ing ON ing.id = r.ingredient_item_id
      WHERE r.recipe_item_id = p_item), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(m.name ORDER BY im.sort_order)
      FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
      WHERE im.item_id = p_item), '[]'::jsonb),
    'method_ids', COALESCE((
      SELECT jsonb_agg(im.method_item_id ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'method_parts', COALESCE((
      SELECT jsonb_agg(im.part ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'parts', (SELECT i.parts FROM public.items i WHERE i.id = p_item),
    'glass', (SELECT g.name FROM public.items i JOIN public.items g ON g.id = i.glassware_id WHERE i.id = p_item),
    'ice', (SELECT ic.name FROM public.items i JOIN public.items ic ON ic.id = i.ice_id WHERE i.id = p_item),
    'notes', (SELECT COALESCE(i.notes, n.notes) FROM public.items i LEFT JOIN public.credited_drink_notes n ON n.item_id = i.id WHERE i.id = p_item),
    'dilution_pct', (SELECT COALESCE(i.dilution_pct, cd.dilution_pct) FROM public.items i LEFT JOIN public.credited_drink_details cd ON cd.item_id = i.id WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

-- As 20261008050000_credited_drink_notes.sql, with the parts. A version from
-- before parts has none, so it comes back in one part.
CREATE OR REPLACE FUNCTION "public"."restore_drink_version"("p_item" "uuid", "p_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_snapshot jsonb;
    v_line jsonb;
    v_index integer := 0;
    v_method record;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    SELECT snapshot INTO v_snapshot FROM public.item_versions WHERE item_id = p_item AND version = p_version;
    IF v_snapshot IS NULL THEN RAISE EXCEPTION 'No version % of this drink.', p_version; END IF;

    UPDATE public.items SET parts = NULLIF(v_snapshot -> 'parts', 'null'::jsonb) WHERE id = p_item;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'lines') LOOP
        INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, at_service, part, sort_order)
        VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                NULLIF(v_line ->> 'note', ''), COALESCE((v_line ->> 'optional')::boolean, false), (v_line ->> 'at_service')::boolean,
                COALESCE(NULLIF(v_line ->> 'part', '')::smallint, 1), v_index);
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    FOR v_method IN
        SELECT (m.value #>> '{}')::uuid AS id, COALESCE((v_snapshot -> 'method_parts' ->> (m.ord - 1)::integer)::smallint, 1) AS part, m.ord
          FROM jsonb_array_elements(COALESCE(v_snapshot -> 'method_ids', '[]'::jsonb)) WITH ORDINALITY AS m(value, ord)
    LOOP
        INSERT INTO public.item_methods (item_id, method_item_id, part, sort_order) VALUES (p_item, v_method.id, v_method.part, (v_method.ord - 1)::integer)
        ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE public.items
       SET notes = COALESCE(v_snapshot ->> 'notes', ''),
           dilution_pct = NULLIF(v_snapshot ->> 'dilution_pct', '')::numeric,
           service_style = NULLIF(v_snapshot ->> 'service_style', '')
     WHERE id = p_item;

    RETURN private.write_drink_version(p_item, 'Restored version ' || p_version);
END;
$$;

-- --- reading ---

-- As 20261104200000_home_prep_recipes_private.sql, with each line's part last.
CREATE OR REPLACE VIEW "public"."app_recipe_presentation" WITH ("security_invoker" = false) AS
SELECT
    "r"."id",
    "r"."created_at",
    "r"."recipe_item_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE(COALESCE("r"."parent_ingredient_id", "s"."generic_id"), "r"."ingredient_item_id")
        ELSE NULL::"uuid"
    END AS "display_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."amount"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."amount"
        WHEN "ps"."id" IS NOT NULL THEN "r"."amount"
        ELSE NULL::numeric
    END AS "amount",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."unit"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."unit"
        WHEN "ps"."id" IS NOT NULL THEN "r"."unit"
        ELSE NULL::"text"
    END AS "unit",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."preparation_notes"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_prep_level", "b"."default_prep_level") THEN "r"."preparation_notes"
        ELSE NULL::"text"
    END AS "preparation_notes",
    "r"."is_optional",
    CASE
        WHEN "c"."bar_id" IS NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ub"."user_id" IS NOT NULL AND ("er"."role" >= COALESCE("c"."override_generic_ingredient_level", "b"."default_generic_ingredient_level") OR "ov"."specs") THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        WHEN "ps"."id" IS NOT NULL THEN COALESCE("r"."parent_ingredient_id", "s"."generic_id")
        ELSE NULL::"uuid"
    END AS "parent_ingredient_id",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."ingredient_item_id"
        WHEN "ub"."user_id" IS NOT NULL AND "er"."role" >= COALESCE("c"."override_specific_brand_level", "b"."default_specific_brand_level") THEN "r"."ingredient_item_id"
        ELSE NULL::"uuid"
    END AS "ingredient_item_id",
    "r"."sort_order",
    CASE
        WHEN "c"."bar_id" IS NULL THEN "r"."at_service"
        WHEN "ub"."user_id" IS NOT NULL AND "private"."cap_open"('specs', "er"."role" >= COALESCE("c"."override_measurement_level", "b"."default_measurement_level"), "ov"."granted", "ov"."revoked") THEN "r"."at_service"
        WHEN "ps"."id" IS NOT NULL THEN "r"."at_service"
        ELSE NULL::boolean
    END AS "at_service",
    "r"."part"
FROM "public"."recipes" "r"
JOIN "public"."items" "c" ON "r"."recipe_item_id" = "c"."id"
LEFT JOIN "public"."items" "s" ON "s"."id" = "r"."ingredient_item_id"
LEFT JOIN "public"."bars" "b" ON "c"."bar_id" = "b"."id"
LEFT JOIN "public"."user_bars" "ub" ON "ub"."bar_id" = "c"."bar_id" AND "ub"."user_id" = "auth"."uid"()
    AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "ub"."venue_role_id" AND "vr"."ends_at" <= "now"())
LEFT JOIN "public"."venue_roles" "mvr" ON "mvr"."id" = "ub"."venue_role_id"
LEFT JOIN "public"."venue_level_overrides" "mlo" ON "ub"."venue_role_id" IS NULL AND "mlo"."bar_id" = "ub"."bar_id" AND "mlo"."base_level" = "ub"."role_level"
LEFT JOIN (
    SELECT "l"."id" FROM "private"."published_listing" "l" WHERE "l"."effective_mode" = 'spec'
) "ps" ON "ps"."id" = "c"."id"
LEFT JOIN "public"."profiles" "op" ON "op"."id" = "c"."origin_bar_profile_id"
    AND "c"."bar_id" IS NULL AND NOT "c"."is_catalog" AND "c"."created_by" IS NULL
LEFT JOIN "public"."bars" "ob" ON "ob"."id" = "op"."bar_id"
-- effective_bar_role(ub.role_level), as a join (see 20261101200000).
LEFT JOIN "public"."user_prefs" "up" ON "up"."user_id" = "auth"."uid"()
CROSS JOIN LATERAL (
    SELECT LEAST(COALESCE("ub"."role_level", 10), COALESCE("up"."view_as_role_level", COALESCE("ub"."role_level", 10))) AS "role"
) "er"
-- The member's own grants and revokes, left out under View as.
CROSS JOIN LATERAL (
    SELECT "g"."granted", "g"."revoked", 'specs' = ANY ("g"."granted") AS "specs"
    FROM (SELECT
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."granted", "mlo"."granted", '{}') ELSE '{}' END AS "granted",
        CASE WHEN "er"."role" = "ub"."role_level" THEN COALESCE("mvr"."revoked", "mlo"."revoked", '{}') ELSE '{}' END AS "revoked"
    ) "g"
) "ov"
WHERE (
    "auth"."uid"() IS NOT NULL
    AND (
        (
            "c"."bar_id" IS NULL
            AND (
                "c"."created_by" IS NULL
                OR "c"."created_by" = "auth"."uid"()
                OR ("c"."item_type" <> ALL (ARRAY['cocktail'::"public"."entity_type", 'beer'::"public"."entity_type", 'wine'::"public"."entity_type"])
                    AND "c"."is_catalog")
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
            )
            AND (
                "op"."id" IS NULL
                OR COALESCE("ob"."page_visibility", 'description'::"public"."bar_page_visibility") = 'open'
                OR EXISTS (SELECT 1 FROM "private"."app_admins" "aa" WHERE "aa"."user_id" = "auth"."uid"())
                OR EXISTS (
                    SELECT 1 FROM "public"."user_bars" "tb"
                    WHERE "tb"."bar_id" = "ob"."id" AND "tb"."user_id" = "auth"."uid"()
                      AND NOT EXISTS (SELECT 1 FROM "public"."venue_roles" "vr" WHERE "vr"."id" = "tb"."venue_role_id" AND "vr"."ends_at" <= "now"()))
            )
        )
        OR ("ub"."user_id" IS NOT NULL
            AND "private"."cap_open"('menu', "er"."role" >= COALESCE("c"."override_visibility_level", "b"."default_visibility_level"), "ov"."granted", "ov"."revoked"))
    )
) OR "ps"."id" IS NOT NULL;
