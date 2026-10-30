-- A spec line can be a float (Eddie, TestFlight note tf-060: "a 15ml float"):
-- recipes.is_float marks a measured line that's floated on top, so it keeps
-- its real amount and unit ("15 ml float of red wine") and still counts in the
-- drink's strength. The unit "float" stays for a float nobody measures.
--
-- save_drink_spec keeps a line's float when a save leaves it out (an app
-- from before this, a bulk bottle swap). save_drink_spec, drink_snapshot and restore_drink_version carry it (as
-- 20261123100000_drink_parts and 20261123300000_notes_by_role, plus is_float),
-- and app_recipe_presentation reads it last (as 20261123100000_drink_parts,
-- plus is_float).

ALTER TABLE "public"."recipes" ADD COLUMN "is_float" boolean DEFAULT false NOT NULL;

-- --- save ---

CREATE OR REPLACE FUNCTION "public"."save_drink_spec"("p_item" "uuid", "p_lines" "jsonb", "p_method_ids" "uuid"[], "p_note" "text", "p_method_parts" smallint[] DEFAULT NULL, "p_parts" "jsonb" DEFAULT NULL) RETURNS integer
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
        UPDATE public.items SET parts = CASE WHEN p_parts IN ('[]'::jsonb, 'null'::jsonb) THEN NULL ELSE p_parts END WHERE id = p_item;
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
                   -- Left out (an older app, a bulk bottle swap), a kept line stays as it was.
                   is_float = COALESCE((v_line ->> 'is_float')::boolean, is_float),
                   part = v_part,
                   sort_order = v_index
             WHERE id = v_id;
        ELSE
            INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, is_float, part, sort_order)
            VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                    NULLIF(v_line ->> 'preparation_notes', ''), COALESCE((v_line ->> 'is_optional')::boolean, false),
                    COALESCE((v_line ->> 'is_float')::boolean, false), v_part, v_index)
            RETURNING id INTO v_id;
        END IF;
        v_kept := v_kept || v_id;
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.recipes WHERE recipe_item_id = p_item AND NOT (id = ANY (v_kept));

    -- Methods in the order given, each in its part. Without parts, a method
    -- keeps every part it was in (Build in two parts stays in both). Unknown
    -- ids and repeats are skipped.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', method_item_id, 'part', part)), '[]'::jsonb) INTO v_old_methods
      FROM public.item_methods WHERE item_id = p_item;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    INSERT INTO public.item_methods (item_id, method_item_id, part, sort_order)
    SELECT p_item, m.id, u.part, (min(u.ord) - 1)::integer
      FROM (SELECT x.id, x.ord, COALESCE(p_method_parts[x.ord], o.part, 1) AS part
              FROM unnest(COALESCE(p_method_ids, '{}')) WITH ORDINALITY AS x(id, ord)
              LEFT JOIN jsonb_to_recordset(v_old_methods) AS o(id uuid, part smallint) ON p_method_parts IS NULL AND o.id = x.id) u
      JOIN public.items m ON m.id = u.id AND m.item_type = 'method'
     GROUP BY m.id, u.part;
    IF EXISTS (SELECT 1 FROM public.item_methods WHERE item_id = p_item AND part > v_count) THEN
        RAISE EXCEPTION 'A method is in a part the drink doesn''t have.';
    END IF;

    RETURN private.write_drink_version(p_item, p_note);
END;
$$;

-- --- versions ---

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
        'float', r.is_float,
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
    -- Only notes for everyone who sees the drink: version history reaches
    -- everyone with the spec, so notes for a role and up stay out of it.
    'notes', (SELECT n.body FROM public.item_notes n WHERE n.item_id = p_item AND n.read_level IS NULL),
    'dilution_pct', (SELECT COALESCE(i.dilution_pct, cd.dilution_pct) FROM public.items i LEFT JOIN public.credited_drink_details cd ON cd.item_id = i.id WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

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
        INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, is_float, at_service, part, sort_order)
        VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                NULLIF(v_line ->> 'note', ''), COALESCE((v_line ->> 'optional')::boolean, false), COALESCE((v_line ->> 'float')::boolean, false),
                (v_line ->> 'at_service')::boolean,
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
    -- Versions only hold notes for everyone (drink_snapshot), so notes for a
    -- role and up stay as they are.
    IF NOT EXISTS (SELECT 1 FROM public.item_notes WHERE item_id = p_item AND read_level IS NOT NULL) THEN
        IF NULLIF(btrim(v_snapshot ->> 'notes'), '') IS NULL THEN
            DELETE FROM public.item_notes WHERE item_id = p_item;
        ELSE
            INSERT INTO public.item_notes (item_id, body) VALUES (p_item, v_snapshot ->> 'notes')
            ON CONFLICT (item_id) DO UPDATE SET body = EXCLUDED.body;
        END IF;
    END IF;
    UPDATE public.items
       SET dilution_pct = NULLIF(v_snapshot ->> 'dilution_pct', '')::numeric,
           service_style = NULLIF(v_snapshot ->> 'service_style', '')
     WHERE id = p_item;

    RETURN private.write_drink_version(p_item, 'Restored version ' || p_version);
END;
$$;

-- --- read ---

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
    "r"."part",
    "r"."is_float"
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
