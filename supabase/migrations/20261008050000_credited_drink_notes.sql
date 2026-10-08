-- Notes on a bar's credited drinks follow the bar's page. Local stack only
-- until Kevin's OK.
--
-- 20261007130000 keeps an unclaimed or non-open bar's spec (lines and
-- methods) from the public, but left items.notes readable: on the seeded
-- signatures it holds the spec's source and, for some, a one-line method. The
-- app hid it on a locked drink; a signed-in user could still select it from
-- items or app_item_presentation.
--
-- Postgres can't hide one column on some rows of a table, and column grants
-- on items would break every `select *` and make each future column need its
-- own grant. So the text moves: a shared drink credited to a bar keeps its
-- notes in credited_drink_notes, behind the same rule as its spec rows
-- (is_spec_locked), and items.notes stays NULL on those rows.
--
--   * A trigger keeps it that way: writing notes on such a drink stores them
--     in credited_drink_notes (an empty string clears them, NULL keeps them),
--     and a drink that stops being one gets its notes back on the row.
--   * app_item_presentation reads them back, so the drink page and the editor
--     still show them to catalog admins and the bar's team, and to everyone
--     once the bar's page is open.
--   * Versions snapshot and restore them as before.
--
-- Descriptions stay on the row. Unclaimed bars (every seeded one) show them by
-- design ('description'); only a claimed bar that picks Locked hides them, and
-- the app does that on the drink page.

-- --- Which drinks a bar's page can lock ---

-- A shared drink credited to a bar: not a venue drink, not a catalog classic,
-- not anyone's personal drink. The one copy of this rule; is_spec_locked and
-- the notes trigger both use it.
CREATE FUNCTION "private"."is_bar_credited_drink"("p_bar_id" "uuid", "p_is_catalog" boolean, "p_created_by" "uuid", "p_origin_bar_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_bar_id IS NULL AND NOT p_is_catalog AND p_created_by IS NULL AND p_origin_bar_profile_id IS NOT NULL;
$$;

-- Same result as 20261007130000, with the drink test above.
CREATE OR REPLACE FUNCTION "public"."is_spec_locked"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.items i
    JOIN public.profiles p ON p.id = i.origin_bar_profile_id
    LEFT JOIN public.bars b ON b.id = p.bar_id
    WHERE i.id = p_item_id
      AND private.is_bar_credited_drink(i.bar_id, i.is_catalog, i.created_by, i.origin_bar_profile_id)
      AND COALESCE(b.page_visibility, 'description') <> 'open'
      AND NOT EXISTS (SELECT 1 FROM private.app_admins aa WHERE aa.user_id = auth.uid())
      AND (b.id IS NULL OR b.id NOT IN (SELECT private.my_bar_ids(0)))
  );
$$;

-- --- Where the notes live ---

CREATE TABLE "public"."credited_drink_notes" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items" ("id") ON DELETE CASCADE,
    "notes" "text" NOT NULL
);

ALTER TABLE "public"."credited_drink_notes" ENABLE ROW LEVEL SECURITY;

-- Same rule as the drink's methods (item_methods_select). Writes only come
-- through the items trigger.
CREATE POLICY "credited_drink_notes_select" ON "public"."credited_drink_notes" FOR SELECT TO "authenticated"
    USING ("item_id" IN (SELECT "id" FROM "public"."items") AND NOT "public"."is_spec_locked"("item_id"));

REVOKE ALL ON TABLE "public"."credited_drink_notes" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON TABLE "public"."credited_drink_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."credited_drink_notes" TO "service_role";

-- Move what's there now.
INSERT INTO "public"."credited_drink_notes" ("item_id", "notes")
SELECT "id", "notes" FROM "public"."items"
WHERE "private"."is_bar_credited_drink"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
  AND "notes" IS NOT NULL AND btrim("notes") <> '';

UPDATE "public"."items" SET "notes" = NULL
WHERE "private"."is_bar_credited_drink"("bar_id", "is_catalog", "created_by", "origin_bar_profile_id")
  AND "notes" IS NOT NULL;

-- --- Keeping them there ---

-- Before an update: a credited drink's notes go to credited_drink_notes ('' or
-- blank clears them; NULL, which is also what an update that doesn't touch
-- notes carries, keeps them). A drink that stops being credited (moved to a
-- venue, made a classic) gets them back unless the update sets new ones.
-- Blank notes become NULL on every drink, so the editor can send '' to clear.
CREATE FUNCTION "private"."keep_credited_drink_notes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_kept text;
BEGIN
    IF private.is_bar_credited_drink(NEW.bar_id, NEW.is_catalog, NEW.created_by, NEW.origin_bar_profile_id) THEN
        IF TG_OP = 'UPDATE' AND NEW.notes IS NOT NULL THEN
            IF btrim(NEW.notes) = '' THEN
                DELETE FROM public.credited_drink_notes WHERE item_id = NEW.id;
            ELSE
                INSERT INTO public.credited_drink_notes (item_id, notes) VALUES (NEW.id, NEW.notes)
                ON CONFLICT (item_id) DO UPDATE SET notes = EXCLUDED.notes;
            END IF;
            NEW.notes := NULL;
        END IF;
        -- An insert keeps its notes until the AFTER INSERT trigger moves them:
        -- the row has to exist first.
    ELSIF TG_OP = 'UPDATE' AND private.is_bar_credited_drink(OLD.bar_id, OLD.is_catalog, OLD.created_by, OLD.origin_bar_profile_id) THEN
        DELETE FROM public.credited_drink_notes WHERE item_id = NEW.id RETURNING notes INTO v_kept;
        IF NEW.notes IS NULL THEN
            NEW.notes := v_kept;
        END IF;
    END IF;
    IF NEW.notes IS NOT NULL AND btrim(NEW.notes) = '' THEN
        NEW.notes := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "keep_credited_drink_notes" BEFORE INSERT OR UPDATE ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."keep_credited_drink_notes"();

-- After an insert: a new credited drink's notes move off the row. The UPDATE
-- carries NULL, which the trigger above reads as "keep".
CREATE FUNCTION "private"."move_new_credited_drink_notes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF private.is_bar_credited_drink(NEW.bar_id, NEW.is_catalog, NEW.created_by, NEW.origin_bar_profile_id) THEN
        INSERT INTO public.credited_drink_notes (item_id, notes) VALUES (NEW.id, NEW.notes)
        ON CONFLICT (item_id) DO UPDATE SET notes = EXCLUDED.notes;
        UPDATE public.items SET notes = NULL WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "move_new_credited_drink_notes" AFTER INSERT ON "public"."items"
    FOR EACH ROW
    WHEN ("new"."notes" IS NOT NULL)
    EXECUTE FUNCTION "private"."move_new_credited_drink_notes"();

-- --- Reading them back ---

-- Same columns and order as 20261001150000; notes come from
-- credited_drink_notes when the row has none. Security invoker, so its RLS
-- decides who gets them.
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
    c.price_minor
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);

-- --- Versions ---

-- Same as now, with the notes read from either place. Only editors read
-- versions (private.can_view_versions).
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
        'at_service', r.at_service) ORDER BY r.sort_order, r.created_at)
      FROM public.recipes r LEFT JOIN public.items ing ON ing.id = r.ingredient_item_id
      WHERE r.recipe_item_id = p_item), '[]'::jsonb),
    'methods', COALESCE((
      SELECT jsonb_agg(m.name ORDER BY im.sort_order)
      FROM public.item_methods im JOIN public.items m ON m.id = im.method_item_id
      WHERE im.item_id = p_item), '[]'::jsonb),
    'method_ids', COALESCE((
      SELECT jsonb_agg(im.method_item_id ORDER BY im.sort_order)
      FROM public.item_methods im WHERE im.item_id = p_item), '[]'::jsonb),
    'glass', (SELECT g.name FROM public.items i JOIN public.items g ON g.id = i.glassware_id WHERE i.id = p_item),
    'ice', (SELECT ic.name FROM public.items i JOIN public.items ic ON ic.id = i.ice_id WHERE i.id = p_item),
    'notes', (SELECT COALESCE(i.notes, n.notes) FROM public.items i LEFT JOIN public.credited_drink_notes n ON n.item_id = i.id WHERE i.id = p_item),
    'dilution_pct', (SELECT i.dilution_pct FROM public.items i WHERE i.id = p_item),
    'service_style', (SELECT i.service_style FROM public.items i WHERE i.id = p_item));
$$;

-- Same as now, except a version with no notes clears them (''), since NULL
-- keeps a credited drink's notes.
CREATE OR REPLACE FUNCTION "public"."restore_drink_version"("p_item" "uuid", "p_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_snapshot jsonb;
    v_line jsonb;
    v_index integer := 0;
    v_method uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT private.can_edit_item(p_item) THEN
        RAISE EXCEPTION 'You can''t edit this drink.' USING ERRCODE = '42501';
    END IF;
    SELECT snapshot INTO v_snapshot FROM public.item_versions WHERE item_id = p_item AND version = p_version;
    IF v_snapshot IS NULL THEN RAISE EXCEPTION 'No version % of this drink.', p_version; END IF;

    DELETE FROM public.recipes WHERE recipe_item_id = p_item;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'lines') LOOP
        INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, at_service, sort_order)
        VALUES (p_item, (v_line ->> 'ingredient_item_id')::uuid, NULLIF(v_line ->> 'amount', '')::numeric, NULLIF(v_line ->> 'unit', ''),
                NULLIF(v_line ->> 'note', ''), COALESCE((v_line ->> 'optional')::boolean, false), (v_line ->> 'at_service')::boolean, v_index);
        v_index := v_index + 1;
    END LOOP;
    DELETE FROM public.item_methods WHERE item_id = p_item;
    v_index := 0;
    FOR v_method IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(v_snapshot -> 'method_ids', '[]'::jsonb)) LOOP
        INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES (p_item, v_method, v_index);
        v_index := v_index + 1;
    END LOOP;
    UPDATE public.items
       SET notes = COALESCE(v_snapshot ->> 'notes', ''),
           dilution_pct = NULLIF(v_snapshot ->> 'dilution_pct', '')::numeric,
           service_style = NULLIF(v_snapshot ->> 'service_style', '')
     WHERE id = p_item;

    RETURN private.write_drink_version(p_item, 'Restored version ' || p_version);
END;
$$;

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."keep_credited_drink_notes"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."move_new_credited_drink_notes"() FROM PUBLIC, "anon", "authenticated";
-- is_spec_locked (a security definer) calls it; nobody else needs to.
REVOKE EXECUTE ON FUNCTION "private"."is_bar_credited_drink"("uuid", boolean, "uuid", "uuid") FROM PUBLIC, "anon", "authenticated";
