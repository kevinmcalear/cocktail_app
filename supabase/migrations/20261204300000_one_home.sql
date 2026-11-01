-- One home for each fact (decision page, 1 Nov 2026: run-names,
-- amounts-rule, lineage-one-home, credit-model, had-want-one, glass-ice-one;
-- and Advanced options, the one venue switch kept).
--
--   1. Run names apart: the staff list of drinks not on a list is "Also
--      makes" (bar_off_menu renamed bar_also_makes; a view keeps the old
--      name for old builds).
--   2. Permissions decide amounts: role permissions alone say who sees a
--      venue drink's names, brands, amounts and prep notes, and
--      items.spec_hidden hides one drink's spec. The per-field levels are no
--      longer read.
--   3. Advanced options: bars.advanced_options, from enabled_features.
--   4. One based-on link and one family: items.based_on_* and items.family
--      fold riff_of_id, lineage_parent_id, lineage_style_id, spec_from_id,
--      lineage_family and family_id.
--   5. One credit relation: item_credits (drink, who, role, status, with a
--      dispute path) folds items.creator_profile_id, creator_names,
--      credit_status, item_co_creators and item_maker_credits.
--   6. One had record and one Want list: drinks_had and want_list fold
--      collected_items, made_drinks, rank_entries.had_on and loved bars not
--      yet been to.
--   7. One glass and one ice record per drink: drink_glass and drink_ice
--      fold the seven glass and ice columns on items.
--
-- Every new home is backfilled here. The old fields stay until 2.0 is on
-- every phone (old builds read and write them) and are kept in step by
-- triggers both ways, then drop in one PR, as 20261201200000 did for
-- accent_text. Database code that reads them moves in that PR. App code may
-- not gain reads of them (scripts/oldFields.check.ts).

-- --- 1. Run names apart: the staff list of drinks not on a list is "Also makes" ---

-- 'Off menu' clashed with Off tonight (a drink pulled for one night). The
-- table, its keys, rules and guard take the decided name; old builds keep
-- reading and writing bar_off_menu through a view of it until 2.0 is on
-- every phone. Run sheets keep "run"; a drink's time on a list is its
-- dates (drink_list_dates, 20261203100000).
ALTER TABLE "public"."bar_off_menu" RENAME TO "bar_also_makes";
ALTER INDEX "public"."bar_off_menu_pkey" RENAME TO "bar_also_makes_pkey";
ALTER INDEX "public"."bar_off_menu_rank_key" RENAME TO "bar_also_makes_rank_key";
ALTER TABLE "public"."bar_also_makes" RENAME CONSTRAINT "bar_off_menu_rank_range" TO "bar_also_makes_rank_range";
ALTER TABLE "public"."bar_also_makes" RENAME CONSTRAINT "bar_off_menu_bar_id_fkey" TO "bar_also_makes_bar_id_fkey";
ALTER TABLE "public"."bar_also_makes" RENAME CONSTRAINT "bar_off_menu_item_id_fkey" TO "bar_also_makes_item_id_fkey";
ALTER POLICY "bar_off_menu_select" ON "public"."bar_also_makes" RENAME TO "bar_also_makes_select";
ALTER POLICY "bar_off_menu_write" ON "public"."bar_also_makes" RENAME TO "bar_also_makes_write";
ALTER FUNCTION "private"."guard_bar_off_menu"() RENAME TO "guard_bar_also_makes";
ALTER TRIGGER "guard_bar_off_menu" ON "public"."bar_also_makes" RENAME TO "guard_bar_also_makes";
COMMENT ON TABLE "public"."bar_also_makes" IS
    'Also makes: drinks a bar makes that are not on its lists (its riffs on classics, catalog classics), with an optional top-50 order. Not Off tonight.';

-- For builds before 2.0 only; drops with the other old fields.
CREATE VIEW "public"."bar_off_menu" WITH ("security_invoker" = 'true') AS
    SELECT "bar_id", "item_id", "sort_rank" FROM "public"."bar_also_makes";
COMMENT ON VIEW "public"."bar_off_menu" IS 'Old name of bar_also_makes, for app builds before 2.0. Drops once 2.0 is on every phone.';
REVOKE ALL ON "public"."bar_off_menu" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."bar_off_menu" TO "authenticated";
GRANT ALL ON "public"."bar_off_menu" TO "service_role";

-- Its two readers, on the new name (as 20261001210000 and later).
CREATE OR REPLACE FUNCTION public.get_bar_classics(p_bar_id uuid)
 RETURNS TABLE(sort_rank smallint, ask_name text, classic_name text, open_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.bar_id = p_bar_id AND p.kind = 'bar' AND p.is_public AND p.moderated_at IS NULL
    ) THEN
        RETURN;
    END IF;

    -- Subquery columns are named away from the OUT params. Those names are
    -- variables in this function, and an unqualified match would read the
    -- variable instead of the column.
    RETURN QUERY
    SELECT s.sort_rank, s.shown_name, s.shown_classic, s.shown_open
    FROM (
        SELECT
            o.sort_rank,
            CASE
                WHEN i.is_catalog AND i.moderated_at IS NULL THEN i.name
                WHEN i.bar_id IS NOT NULL AND i.publish_mode <> 'private' AND i.moderated_at IS NULL THEN i.name
                WHEN c.id IS NOT NULL AND c.moderated_at IS NULL THEN c.name
                ELSE NULL
            END AS shown_name,
            CASE
                WHEN i.is_catalog AND i.moderated_at IS NULL THEN i.name
                WHEN c.id IS NOT NULL AND c.moderated_at IS NULL THEN c.name
                ELSE NULL
            END AS shown_classic,
            CASE
                WHEN i.bar_id IS NOT NULL AND i.publish_mode <> 'private' AND i.moderated_at IS NULL THEN i.id
                ELSE NULL
            END AS shown_open
        FROM public.bar_also_makes o
        JOIN public.items i ON i.id = o.item_id
        LEFT JOIN public.items c ON c.id = i.riff_of_id
        WHERE o.bar_id = p_bar_id
    ) s
    WHERE s.shown_name IS NOT NULL
    ORDER BY s.sort_rank NULLS LAST, s.shown_name;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.set_staff_list_order(p_bar_id uuid, p_item_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_count integer;
BEGIN
    IF NOT ("p_bar_id" IN (SELECT "private"."bars_with_capability"('menus'))) THEN
        RAISE EXCEPTION 'Ordering the staff list opens at Drink Creator.' USING ERRCODE = '42501';
    END IF;
    IF cardinality("p_item_ids") > 50 THEN
        RAISE EXCEPTION 'The staff list ranks up to 50 drinks.';
    END IF;
    IF cardinality("p_item_ids") <> (SELECT count(DISTINCT x) FROM unnest("p_item_ids") AS x) THEN
        RAISE EXCEPTION 'A drink can only be in the staff list once.';
    END IF;

    UPDATE public.bar_also_makes SET sort_rank = NULL WHERE bar_id = "p_bar_id" AND sort_rank IS NOT NULL;
    UPDATE public.bar_also_makes o
       SET sort_rank = t.n
      FROM unnest("p_item_ids") WITH ORDINALITY AS t(item_id, n)
     WHERE o.bar_id = "p_bar_id" AND o.item_id = t.item_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> coalesce(cardinality("p_item_ids"), 0) THEN
        RAISE EXCEPTION 'The staff list changed while you were ordering it. Reload and try again.';
    END IF;
END;
$function$

;

-- --- 2. Permissions decide amounts ---

-- One rule (amounts-rule): each role's permissions say what it sees of a
-- venue drink's spec, and a bar can still hide one drink's spec.
--   * names (generic ingredients): talking_points or specs
--   * brands, amounts, units, at service: specs
--   * prep notes: house_made
--   * items.spec_hidden: only those who edit that drink (edit_drinks, in
--     their department) see its brands, amounts and prep notes; names stay.
--     It also hides a house-made ingredient's method (item_steps), as
--     override_prep_level did (tf-087).
-- The per-field levels (bars.default_generic_ingredient_level,
-- default_specific_brand_level, default_measurement_level,
-- default_prep_level; items.override_generic_ingredient_level,
-- override_specific_brand_level, override_measurement_level,
-- override_prep_level) are no longer read. They stay until 2.0 is on every
-- phone; old builds' "Who can see the spec" picks keep working through a
-- trigger: a measurement pick above Bartender hides the spec. Whether the
-- drink is listed at all (default_visibility_level and
-- override_visibility_level) is drink visibility, not amounts, and is
-- unchanged. venue_level_overrides is how a built-in role's permissions are
-- switched, so it is read as before.
-- With default settings Guests, Employees, Bartenders and Admins see what
-- they saw; Drink Creators now see prep notes (house_made), as the drink's
-- Who sees what screen already said.

ALTER TABLE "public"."items" ADD COLUMN "spec_hidden" boolean DEFAULT false NOT NULL;
COMMENT ON COLUMN "public"."items"."spec_hidden" IS
    'This drink''s brands, amounts and prep notes (and a house-made ingredient''s method) are shown only to those who edit it. Names stay.';

-- A per-drink pick above Bartender for amounts or brands was a hide, and so
-- was a house-made ingredient's prep pick above Bartender (tf-087).
UPDATE "public"."items" SET "spec_hidden" = true
WHERE "override_measurement_level" > 30 OR "override_specific_brand_level" > 30
   OR ("item_type" = 'ingredient' AND "override_prep_level" > 30);

-- Old builds write the levels: keep the hide in step with them.
CREATE FUNCTION "private"."spec_hidden_from_levels"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT'
       OR NEW.override_measurement_level IS DISTINCT FROM OLD.override_measurement_level
       OR NEW.override_specific_brand_level IS DISTINCT FROM OLD.override_specific_brand_level
       OR NEW.override_prep_level IS DISTINCT FROM OLD.override_prep_level THEN
        IF TG_OP = 'UPDATE' OR coalesce(NEW.override_measurement_level, NEW.override_specific_brand_level, NEW.override_prep_level) IS NOT NULL THEN
            NEW.spec_hidden := coalesce(NEW.override_measurement_level, 0) > 30 OR coalesce(NEW.override_specific_brand_level, 0) > 30
                OR (NEW.item_type = 'ingredient' AND coalesce(NEW.override_prep_level, 0) > 30);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."spec_hidden_from_levels"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "spec_hidden_from_levels" BEFORE INSERT OR UPDATE OF "override_measurement_level", "override_specific_brand_level", "override_prep_level" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."spec_hidden_from_levels"();

-- A bar whose amounts level wasn't Bartender changed who holds specs: keep
-- that as a switch on its built-in roles, so nothing it set changes.
INSERT INTO "public"."venue_level_overrides" ("bar_id", "base_level", "granted", "revoked")
SELECT b."id", l.level,
       CASE WHEN l.level >= b."default_measurement_level" AND l.level < 30 THEN ARRAY['specs']::"public"."venue_capability"[] ELSE '{}' END,
       CASE WHEN l.level < b."default_measurement_level" AND l.level >= 30 THEN ARRAY['specs']::"public"."venue_capability"[] ELSE '{}' END
FROM "public"."bars" b
CROSS JOIN (VALUES (10), (20), (30), (35)) AS l(level)
WHERE b."default_measurement_level" <> 30
  AND ((l.level >= b."default_measurement_level" AND l.level < 30) OR (l.level < b."default_measurement_level" AND l.level >= 30))
ON CONFLICT ("bar_id", "base_level") DO UPDATE
SET "granted" = ARRAY(SELECT DISTINCT unnest("venue_level_overrides"."granted" || EXCLUDED."granted") EXCEPT SELECT unnest(EXCLUDED."revoked")),
    "revoked" = ARRAY(SELECT DISTINCT unnest("venue_level_overrides"."revoked" || EXCLUDED."revoked") EXCEPT SELECT unnest(EXCLUDED."granted"));

-- specs is a permission like the rest: from the role, then its switches.
-- The amounts level is no longer an input (the parameter stays for its
-- callers); whether the drink is listed (menu) still follows visibility.
CREATE OR REPLACE FUNCTION "private"."role_capabilities"("p_level" integer, "p_granted" "public"."venue_capability"[], "p_revoked" "public"."venue_capability"[], "p_visibility_level" integer, "p_measurement_level" integer) RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(array_agg(c ORDER BY c), '{}')
  FROM unnest(enum_range(NULL::public.venue_capability)) AS c
  WHERE (c = 'staff' AND p_level >= 40)
     OR private.cap_open(c, CASE
          WHEN c = 'menu' THEN p_level >= p_visibility_level
          ELSE c = ANY (private.base_capabilities(p_level))
        END, p_granted, p_revoked);
$$;

-- The spec, masked by permissions (as 20261130100000_spec_line_float.sql
-- otherwise): pm says what the viewer's permissions open. A signed-out
-- reader runs the view too, so its two pure helpers are theirs to call, as
-- private.cap_open already is.
GRANT EXECUTE ON FUNCTION "private"."base_capabilities"(integer) TO "anon";
GRANT EXECUTE ON FUNCTION "private"."department_kinds"("public"."entity_type"[]) TO "anon";
CREATE OR REPLACE VIEW public.app_recipe_presentation WITH (security_invoker = false) AS
 SELECT r.id,
    r.created_at,
    r.recipe_item_id,
        CASE
            WHEN c.bar_id IS NULL THEN r.ingredient_item_id
            WHEN pm.spec_open THEN r.ingredient_item_id
            WHEN pm.names_open THEN COALESCE(COALESCE(r.parent_ingredient_id, s.generic_id), r.ingredient_item_id)
            WHEN ps.id IS NOT NULL THEN COALESCE(COALESCE(r.parent_ingredient_id, s.generic_id), r.ingredient_item_id)
            ELSE NULL::uuid
        END AS display_ingredient_id,
        CASE
            WHEN c.bar_id IS NULL THEN r.amount
            WHEN pm.spec_open THEN r.amount
            WHEN ps.id IS NOT NULL THEN r.amount
            ELSE NULL::numeric
        END AS amount,
        CASE
            WHEN c.bar_id IS NULL THEN r.unit
            WHEN pm.spec_open THEN r.unit
            WHEN ps.id IS NOT NULL THEN r.unit
            ELSE NULL::text
        END AS unit,
        CASE
            WHEN c.bar_id IS NULL THEN r.preparation_notes
            WHEN pm.prep_open THEN r.preparation_notes
            ELSE NULL::text
        END AS preparation_notes,
    r.is_optional,
        CASE
            WHEN c.bar_id IS NULL THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            WHEN pm.names_open THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            WHEN ps.id IS NOT NULL THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            ELSE NULL::uuid
        END AS parent_ingredient_id,
        CASE
            WHEN c.bar_id IS NULL THEN r.ingredient_item_id
            WHEN pm.spec_open THEN r.ingredient_item_id
            ELSE NULL::uuid
        END AS ingredient_item_id,
    r.sort_order,
        CASE
            WHEN c.bar_id IS NULL THEN r.at_service
            WHEN pm.spec_open THEN r.at_service
            WHEN ps.id IS NOT NULL THEN r.at_service
            ELSE NULL::boolean
        END AS at_service,
    r.part,
    r.is_float
   FROM recipes r
     JOIN items c ON r.recipe_item_id = c.id
     LEFT JOIN items s ON s.id = r.ingredient_item_id
     LEFT JOIN bars b ON c.bar_id = b.id
     LEFT JOIN user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid() AND NOT (EXISTS ( SELECT 1
           FROM venue_roles vr
          WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now()))
     LEFT JOIN venue_roles mvr ON mvr.id = ub.venue_role_id
     LEFT JOIN venue_level_overrides mlo ON ub.venue_role_id IS NULL AND mlo.bar_id = ub.bar_id AND mlo.base_level = ub.role_level
     LEFT JOIN ( SELECT l.id
           FROM private.published_listing l
          WHERE l.effective_mode = 'spec'::item_publish_mode) ps ON ps.id = c.id
     LEFT JOIN profiles op ON op.id = c.origin_bar_profile_id AND c.bar_id IS NULL AND NOT c.is_catalog AND c.created_by IS NULL
     LEFT JOIN bars ob ON ob.id = op.bar_id
     LEFT JOIN user_prefs up ON up.user_id = auth.uid()
     CROSS JOIN LATERAL ( SELECT LEAST(COALESCE(ub.role_level, 10), COALESCE(up.view_as_role_level, COALESCE(ub.role_level, 10))) AS role) er
     CROSS JOIN LATERAL ( SELECT g.granted,
            g.revoked,
            'specs'::venue_capability = ANY (g.granted) AS specs
           FROM ( SELECT
                        CASE
                            WHEN er.role = ub.role_level THEN COALESCE(mvr.granted, mlo.granted, '{}'::venue_capability[])
                            ELSE '{}'::venue_capability[]
                        END AS granted,
                        CASE
                            WHEN er.role = ub.role_level THEN COALESCE(mvr.revoked, mlo.revoked, '{}'::venue_capability[])
                            ELSE '{}'::venue_capability[]
                        END AS revoked) g) ov
     CROSS JOIN LATERAL ( SELECT p.editor OR p.specs AND NOT c.spec_hidden AS spec_open,
            p.editor OR p.specs AND NOT c.spec_hidden OR p.names AS names_open,
            p.editor OR p.house_made AND NOT c.spec_hidden AS prep_open
           FROM ( SELECT ub.user_id IS NOT NULL AND private.cap_open('specs'::venue_capability, 'specs'::venue_capability = ANY (private.base_capabilities(er.role)), ov.granted, ov.revoked) AS specs,
                    ub.user_id IS NOT NULL AND private.cap_open('talking_points'::venue_capability, 'talking_points'::venue_capability = ANY (private.base_capabilities(er.role)), ov.granted, ov.revoked) AS names,
                    ub.user_id IS NOT NULL AND private.cap_open('house_made'::venue_capability, 'house_made'::venue_capability = ANY (private.base_capabilities(er.role)), ov.granted, ov.revoked) AS house_made,
                    ub.user_id IS NOT NULL AND private.cap_open('edit_drinks'::venue_capability, 'edit_drinks'::venue_capability = ANY (private.base_capabilities(er.role)), ov.granted, ov.revoked)
                      AND (mvr.drink_types IS NULL OR c.item_type = ANY (private.department_kinds(mvr.drink_types))) AS editor) p) pm
  WHERE auth.uid() IS NOT NULL AND (c.bar_id IS NULL AND (c.created_by IS NULL OR c.created_by = auth.uid() OR (c.item_type <> ALL (ARRAY['cocktail'::entity_type, 'beer'::entity_type, 'wine'::entity_type])) AND c.is_catalog OR (EXISTS ( SELECT 1
           FROM private.app_admins aa
          WHERE aa.user_id = auth.uid()))) AND (op.id IS NULL OR COALESCE(ob.page_visibility, 'description'::bar_page_visibility) = 'open'::bar_page_visibility OR (EXISTS ( SELECT 1
           FROM private.app_admins aa
          WHERE aa.user_id = auth.uid())) OR (EXISTS ( SELECT 1
           FROM user_bars tb
          WHERE tb.bar_id = ob.id AND tb.user_id = auth.uid() AND NOT (EXISTS ( SELECT 1
                   FROM venue_roles vr
                  WHERE vr.id = tb.venue_role_id AND vr.ends_at <= now()))))) OR ub.user_id IS NOT NULL AND private.cap_open('menu'::venue_capability, er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level), ov.granted, ov.revoked)) OR ps.id IS NOT NULL;


-- A house-made ingredient's method (tf-087): read and written by house_made
-- and prep holders unless its spec is hidden, and always by its editors.
ALTER POLICY "item_steps_select" ON "public"."item_steps"
    USING ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = item_steps.item_id) AND (((i.bar_id IS NULL) AND ((i.created_by IS NULL) OR i.is_catalog OR private.can_edit_item(i.id))) OR (((i.bar_id IN ( SELECT private.bars_with_capability('house_made'::public.venue_capability) AS bars_with_capability)) OR (i.bar_id IN ( SELECT private.bars_with_capability('prep'::public.venue_capability) AS bars_with_capability))) AND NOT i.spec_hidden) OR ((i.bar_id IS NOT NULL) AND private.can_edit_item(i.id)))))));
ALTER POLICY "item_steps_write" ON "public"."item_steps"
    USING ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = item_steps.item_id) AND (((i.bar_id IN ( SELECT private.bars_with_capability('prep'::public.venue_capability) AS bars_with_capability)) AND NOT i.spec_hidden) OR (private.can_edit_item(i.id) AND ((i.bar_id IS NULL) OR (i.bar_id IN ( SELECT private.bars_with_capability('house_made'::public.venue_capability) AS bars_with_capability)))))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = item_steps.item_id) AND (((i.bar_id IN ( SELECT private.bars_with_capability('prep'::public.venue_capability) AS bars_with_capability)) AND NOT i.spec_hidden) OR (private.can_edit_item(i.id) AND ((i.bar_id IS NULL) OR (i.bar_id IN ( SELECT private.bars_with_capability('house_made'::public.venue_capability) AS bars_with_capability)))))))));

-- Its only reader was the item_steps rule above.
DROP FUNCTION "private"."opens_level"("uuid", integer);

-- --- 3. Advanced options, one setting per venue ---

-- The venue feature switches are gone (Kevin, 1 Nov) but one: whether a
-- venue shows Advanced options (Ice and Tools, off by default; dec-24,
-- 29 Oct). Its home is bars.advanced_options, backfilled from
-- enabled_features. Written like any bars setting (its Admins, by the bars
-- update rule set_venue_feature also relies on). Old builds still switch it
-- through set_venue_feature(bar, 'advanced', on): the two stay in step both
-- ways until enabled_features and venue_feature_events drop with the other
-- old fields.
ALTER TABLE "public"."bars" ADD COLUMN "advanced_options" boolean DEFAULT false NOT NULL;
COMMENT ON COLUMN "public"."bars"."advanced_options" IS 'The venue shows Advanced options (Ice and Tools). Off by default.';

UPDATE "public"."bars" SET "advanced_options" = true WHERE "enabled_features" @> ARRAY['advanced'];

CREATE FUNCTION "private"."advanced_options_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.advanced_options IS DISTINCT FROM OLD.advanced_options
       AND NEW.enabled_features IS NOT DISTINCT FROM OLD.enabled_features THEN
        -- The new app: keep old builds' switch in step.
        NEW.enabled_features := CASE
            WHEN NEW.advanced_options THEN array_append(array_remove(coalesce(NEW.enabled_features, '{}'), 'advanced'), 'advanced')
            ELSE array_remove(NEW.enabled_features, 'advanced')
        END;
    ELSIF TG_OP = 'INSERT' OR NEW.enabled_features IS DISTINCT FROM OLD.enabled_features THEN
        -- An old build (set_venue_feature) or a new venue.
        NEW.advanced_options := coalesce('advanced' = ANY (NEW.enabled_features), false) OR (TG_OP = 'INSERT' AND NEW.advanced_options);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."advanced_options_sync"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "advanced_options_sync" BEFORE INSERT OR UPDATE OF "enabled_features", "advanced_options" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."advanced_options_sync"();

-- --- 4. One based-on link and one family ---

-- Kevin's decisions lineage-one-home and credit-model (1 Nov 2026): a drink
-- has one "based on" link and one family, so a house drink reads "Ours,
-- based on X", then the original.
--   * items.based_on_id + based_on_kind say what a drink is based on:
--     'riff' is a drink made from another (a bar's version, a house twist, a
--     home riff; it ranks as that drink when that drink is a classic),
--     'descends' a classic that came from another classic (history only),
--     'style' a classic straight from a historic style. A style is a
--     drink_styles row, not an item, so it has its own column,
--     based_on_style_id: one link, two possible targets, at most one set.
--     History ('descends', 'style') stays catalog only, as it is today.
--   * items.drink_family is the family's name as shown ("Sour", "Low ABV",
--     "Sipper"), on any drink.
-- They replace six old columns: riff_of_id, lineage_parent_id and
-- lineage_style_id (the parent, split by who the child is and what table
-- the parent is in), spec_from_id (always the riff_of_id; a copied spec is
-- now spec_source = 'classic', copied from based_on_id), lineage_family
-- (the history tree's family) and family_id (the editor's Family row, a
-- 'family' item). The old columns stay until old builds are gone: one
-- trigger, based_on_sync, keeps both sides in step both ways, and every
-- DB function, view and policy keeps reading the old ones until the drop
-- PR. generic_id (what a bottle is a kind of) and made_from_id (what a prep
-- is made from) are the ingredient taxonomy, not drink lineage, and stay
-- as they are.
--
-- The family is a name, not one of the eight history keys: venues file
-- drinks under families the history tree doesn't have (Sipper, Low ABV,
-- Aromatic), and each needs this one home. The history tree's key is read
-- from the name (private.family_key: "Sours" is sour, "Sipper" is none), so
-- lineage_family is family_key(family) on catalog drinks in the tree.

-- One link can only take the old columns if no drink has two parents, and a
-- copied spec only if it was copied from the drink's riff_of_id (all 256
-- seed rows). Stop rather than drop one.
DO $$
DECLARE
    v_two bigint;
    v_spec bigint;
BEGIN
    SELECT count(*) INTO v_two FROM public.items
     WHERE num_nonnulls(riff_of_id, lineage_parent_id, lineage_style_id) > 1;
    SELECT count(*) INTO v_spec FROM public.items
     WHERE spec_from_id IS NOT NULL AND spec_from_id IS DISTINCT FROM riff_of_id;
    IF v_two > 0 OR v_spec > 0 THEN
        RAISE EXCEPTION 'One based-on link can''t hold these: % drinks with two parents, % with a spec copied from a drink that isn''t their riff_of_id. Settle them first.', v_two, v_spec;
    END IF;
END;
$$;

-- The history tree's family key a family name stands for ("Old Fashioned",
-- "Sours"), or NULL for a name that isn't one of the eight ("Sipper").
CREATE FUNCTION "private"."family_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT v.k FROM (VALUES ('oldfashioned'), ('martini'), ('negroni'), ('sour'), ('sidecar'), ('highball'), ('tiki'), ('flip')) AS v(k)
  WHERE regexp_replace(lower(p_name), '[^a-z]', '', 'g') IN (v.k, v.k || 's');
$$;
REVOKE EXECUTE ON FUNCTION "private"."family_key"("text") FROM PUBLIC, "anon", "authenticated";

-- A key's name, for a drink whose family only the tree knew. The short
-- names, so family_key reads each back; lib/drinkTree.ts FAMILIES names are
-- the tree's headings ("Sour & Daiquiri"), which it wouldn't.
CREATE FUNCTION "private"."family_label"("p_key" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT CASE p_key WHEN 'oldfashioned' THEN 'Old Fashioned' WHEN 'martini' THEN 'Martini' WHEN 'negroni' THEN 'Negroni'
                    WHEN 'sour' THEN 'Sour' WHEN 'sidecar' THEN 'Sidecar' WHEN 'highball' THEN 'Highball'
                    WHEN 'tiki' THEN 'Tiki' WHEN 'flip' THEN 'Flip' END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."family_label"("text") FROM PUBLIC, "anon", "authenticated";

-- A family item's name as a family: trimmed, at most 40 characters.
CREATE FUNCTION "private"."family_name"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT NULLIF(btrim(left(btrim(p_name), 40)), '');
$$;
REVOKE EXECUTE ON FUNCTION "private"."family_name"("text") FROM PUBLIC, "anon", "authenticated";

-- The FKs are the check that nothing points nowhere: a link to a deleted
-- drink or style goes NULL, as the old ones do.
ALTER TABLE "public"."items"
    ADD COLUMN "based_on_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    ADD COLUMN "based_on_style_id" "uuid" REFERENCES "public"."drink_styles"("id") ON DELETE SET NULL,
    ADD COLUMN "based_on_kind" "text",
    ADD COLUMN "drink_family" "text",
    ADD CONSTRAINT "items_based_on_kind_check" CHECK ("based_on_kind" IN ('riff', 'descends', 'style')),
    ADD CONSTRAINT "items_based_on_not_self" CHECK ("based_on_id" <> "id"),
    -- One target at most, a kind exactly when there's a target, and 'style' exactly for a style.
    ADD CONSTRAINT "items_based_on_one" CHECK (
        num_nonnulls("based_on_id", "based_on_style_id") <= 1
        AND ("based_on_kind" IS NULL) = ("based_on_id" IS NULL AND "based_on_style_id" IS NULL)
        AND ("based_on_kind" = 'style') = ("based_on_style_id" IS NOT NULL)),
    -- History is catalog curation, as items_lineage_catalog_only says today.
    ADD CONSTRAINT "items_based_on_history_catalog_only" CHECK ("is_catalog" OR "based_on_kind" IS NULL OR "based_on_kind" = 'riff'),
    ADD CONSTRAINT "items_family_check" CHECK ("drink_family" = btrim("drink_family") AND char_length("drink_family") BETWEEN 1 AND 40);

CREATE INDEX "items_based_on_id_idx" ON "public"."items" ("based_on_id") WHERE "based_on_id" IS NOT NULL;
CREATE INDEX "items_based_on_style_id_idx" ON "public"."items" ("based_on_style_id") WHERE "based_on_style_id" IS NOT NULL;

COMMENT ON COLUMN "public"."items"."based_on_id" IS
    'The drink this one is based on; based_on_kind says how. The one parent link (riff_of_id, lineage_parent_id and spec_from_id before).';
COMMENT ON COLUMN "public"."items"."based_on_style_id" IS
    'The historic style a catalog classic comes straight from (based_on_kind = style). Styles are drink_styles, not items. At most one of this and based_on_id.';
COMMENT ON COLUMN "public"."items"."based_on_kind" IS
    'riff: made from based_on_id (a bar''s version, a house twist; ranks as it when it''s a classic). descends: a classic that came from the classic in based_on_id (history only, catalog). style: from the style in based_on_style_id (catalog). A link written without a kind is a riff.';
COMMENT ON COLUMN "public"."items"."drink_family" IS
    'The family it belongs to, by name as shown ("Sour", "Low ABV"), on any drink. The history tree reads its key with private.family_key. lineage_family and family_id before.';
COMMENT ON COLUMN "public"."items"."spec_source" IS
    'bar: the spec is the drink''s own. classic: copied from the drink it''s based on (based_on_id) because the bar published none.';
COMMENT ON COLUMN "public"."items"."riff_of_id" IS 'Old home of based_on_id (kind riff), kept in step by based_on_sync until old builds are gone.';
COMMENT ON COLUMN "public"."items"."lineage_parent_id" IS 'Old home of based_on_id (kind descends), kept in step by based_on_sync until old builds are gone.';
COMMENT ON COLUMN "public"."items"."lineage_style_id" IS 'Old home of based_on_style_id, kept in step by based_on_sync until old builds are gone.';
COMMENT ON COLUMN "public"."items"."spec_from_id" IS 'Old home of based_on_id while spec_source = classic, kept in step by based_on_sync until old builds are gone.';
COMMENT ON COLUMN "public"."items"."lineage_family" IS 'Old home of family_key(drink_family) for catalog drinks in the history tree, kept in step by based_on_sync until old builds are gone.';
COMMENT ON COLUMN "public"."items"."family_id" IS 'Old home of drink_family (a family item by that name), kept in step by based_on_sync until old builds are gone.';

-- Backfill, by SQL with no user, so no guard stops it:
--   riff_of_id        -> based_on_id, kind 'riff'
--   lineage_parent_id -> based_on_id, kind 'descends'
--   lineage_style_id  -> based_on_style_id, kind 'style'
--   spec_from_id      -> nothing new: it equals riff_of_id (checked above)
--   family_id         -> family, the family item's name (any name: Sour,
--                        Sipper, Low ABV)
--   lineage_family    -> family, the key's name (Sour for sour) where
--                        there's no family_id, or where the family_id's
--                        name stands for another key or none: on a catalog
--                        drink in the tree, the tree's family wins (that
--                        family_id then still names the other one for old
--                        builds until either is next changed)
-- Discover's marker is off for it: ~4,300 drinks would be queued to be
-- worked out again for a change Discover doesn't read.
ALTER TABLE "public"."items" DISABLE TRIGGER "discover_mark";
UPDATE "public"."items" i
   SET "based_on_id" = COALESCE(i."riff_of_id", i."lineage_parent_id"),
       "based_on_style_id" = i."lineage_style_id",
       "based_on_kind" = CASE WHEN i."riff_of_id" IS NOT NULL THEN 'riff'
                              WHEN i."lineage_parent_id" IS NOT NULL THEN 'descends'
                              WHEN i."lineage_style_id" IS NOT NULL THEN 'style' END,
       "drink_family" = CASE WHEN i."lineage_family" IS NOT NULL AND private.family_key(s."family_item_name") IS DISTINCT FROM i."lineage_family"
                       THEN private.family_label(i."lineage_family")
                       ELSE private.family_name(s."family_item_name") END
  FROM (SELECT d."id", f."name" AS "family_item_name"
          FROM "public"."items" d LEFT JOIN "public"."items" f ON f."id" = d."family_id"
         WHERE d."riff_of_id" IS NOT NULL OR d."lineage_parent_id" IS NOT NULL OR d."lineage_style_id" IS NOT NULL
            OR d."lineage_family" IS NOT NULL OR d."family_id" IS NOT NULL) s
 WHERE s."id" = i."id";
ALTER TABLE "public"."items" ENABLE TRIGGER "discover_mark";

-- Old and new say the same thing everywhere (but family_id on the tree
-- drinks above).
DO $$
DECLARE
    v_n bigint;
BEGIN
    SELECT count(*) INTO v_n FROM public.items i
     WHERE i.riff_of_id IS DISTINCT FROM CASE WHEN i.based_on_kind = 'riff' THEN i.based_on_id END
        OR i.lineage_parent_id IS DISTINCT FROM CASE WHEN i.based_on_kind = 'descends' THEN i.based_on_id END
        OR i.lineage_style_id IS DISTINCT FROM CASE WHEN i.based_on_kind = 'style' THEN i.based_on_style_id END
        OR (i.spec_from_id IS NOT NULL AND i.spec_from_id IS DISTINCT FROM i.based_on_id)
        OR (i.lineage_family IS NOT NULL AND i.lineage_family IS DISTINCT FROM private.family_key(i.drink_family))
        OR (i.lineage_family IS NULL AND i.family_id IS NOT NULL
            AND lower(i.drink_family) IS DISTINCT FROM (SELECT lower(private.family_name(f.name)) FROM public.items f WHERE f.id = i.family_id));
    IF v_n > 0 THEN
        RAISE EXCEPTION '% drinks came out of the backfill with old and new lineage out of step.', v_n;
    END IF;
END;
$$;

-- Keeps the old and new columns in step, both ways, until the drop PR. Old
-- builds write riff_of_id (useCreateDrink, useLinkClassic) and family_id
-- (the editor's Family row, sent on every save); new builds write
-- based_on_* and family; seeds and DB code write the old ones
-- (claim_spec_on_edit, merge_item, and each FK's ON DELETE SET NULL). Only
-- a real change counts, so an old build saving the family_id it loaded
-- leaves alone a family a new build set. A write that sets both sides must
-- have them agree. SECURITY DEFINER to read family items and past merges
-- whatever the writer can see; it only ever changes the row being written.
-- Named to fire before every other BEFORE trigger on items (they fire
-- alphabetically), so guard_item_lineage and guard_spec_source judge what
-- it settles.
CREATE FUNCTION "private"."based_on_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ins boolean := TG_OP = 'INSERT';
    v_riff boolean;          -- old side written: riff_of_id
    v_parent boolean;        -- lineage_parent_id
    v_style boolean;         -- lineage_style_id
    v_spec boolean;          -- spec_from_id, set to a drink
    v_spec_cleared boolean;  -- spec_from_id, cleared
    v_link boolean;          -- new side written: based_on_*
    v_family boolean;        -- new side written: family
    v_tree_family boolean;   -- lineage_family
    v_family_item boolean;   -- family_id
    v_spec_source boolean;
    v_kind text;
    v_id uuid;
    v_style_id uuid;
    v_named boolean := false;
    v_name text;
BEGIN
    IF v_ins THEN
        v_riff := NEW.riff_of_id IS NOT NULL;
        v_parent := NEW.lineage_parent_id IS NOT NULL;
        v_style := NEW.lineage_style_id IS NOT NULL;
        v_spec := NEW.spec_from_id IS NOT NULL;
        v_spec_cleared := false;
        v_link := num_nonnulls(NEW.based_on_id, NEW.based_on_style_id, NEW.based_on_kind) > 0;
        v_family := NEW.drink_family IS NOT NULL;
        v_tree_family := NEW.lineage_family IS NOT NULL;
        v_family_item := NEW.family_id IS NOT NULL;
        v_spec_source := NEW.spec_source = 'classic';
    ELSE
        v_riff := NEW.riff_of_id IS DISTINCT FROM OLD.riff_of_id;
        v_parent := NEW.lineage_parent_id IS DISTINCT FROM OLD.lineage_parent_id;
        v_style := NEW.lineage_style_id IS DISTINCT FROM OLD.lineage_style_id;
        -- Clearing spec_from_id says the spec is no longer copied, not that
        -- the drink lost its parent.
        v_spec := NEW.spec_from_id IS DISTINCT FROM OLD.spec_from_id AND NEW.spec_from_id IS NOT NULL;
        v_spec_cleared := NEW.spec_from_id IS NULL AND OLD.spec_from_id IS NOT NULL;
        v_link := NEW.based_on_id IS DISTINCT FROM OLD.based_on_id
               OR NEW.based_on_style_id IS DISTINCT FROM OLD.based_on_style_id
               OR NEW.based_on_kind IS DISTINCT FROM OLD.based_on_kind;
        v_family := NEW.drink_family IS DISTINCT FROM OLD.drink_family;
        v_tree_family := NEW.lineage_family IS DISTINCT FROM OLD.lineage_family;
        v_family_item := NEW.family_id IS DISTINCT FROM OLD.family_id;
        v_spec_source := NEW.spec_source IS DISTINCT FROM OLD.spec_source;
    END IF;
    IF NOT (v_riff OR v_parent OR v_style OR v_spec OR v_spec_cleared OR v_link OR v_spec_source
            OR v_family OR v_tree_family OR v_family_item) THEN
        RETURN NEW;
    END IF;

    -- --- The based-on link ---
    IF v_link THEN
        -- A link written without a kind is a riff; a style is always 'style'.
        IF NEW.based_on_id IS NULL AND NEW.based_on_style_id IS NULL THEN
            NEW.based_on_kind := NULL;
        ELSIF NEW.based_on_kind IS NULL OR (NEW.based_on_kind = 'style') <> (NEW.based_on_style_id IS NOT NULL) THEN
            NEW.based_on_kind := CASE WHEN NEW.based_on_style_id IS NOT NULL THEN 'style' ELSE 'riff' END;
        END IF;
    END IF;
    IF v_riff OR v_parent OR v_style OR v_spec OR v_spec_cleared THEN
        -- The link the old columns name now: the ones this write set win.
        IF v_riff AND NEW.riff_of_id IS NOT NULL THEN
            v_kind := 'riff'; v_id := NEW.riff_of_id; v_named := true;
        END IF;
        IF v_parent AND NEW.lineage_parent_id IS NOT NULL THEN
            IF v_named THEN
                RAISE EXCEPTION 'A drink has one based-on link: set riff_of_id or lineage_parent_id, not both.' USING ERRCODE = 'check_violation';
            END IF;
            v_kind := 'descends'; v_id := NEW.lineage_parent_id; v_named := true;
        END IF;
        IF v_style AND NEW.lineage_style_id IS NOT NULL THEN
            IF v_named THEN
                RAISE EXCEPTION 'A drink has one based-on link: a parent drink or a style, not both.' USING ERRCODE = 'check_violation';
            END IF;
            v_kind := 'style'; v_style_id := NEW.lineage_style_id; v_named := true;
        END IF;
        IF v_spec THEN
            -- A spec is copied from the drink it's based on. Naming another
            -- drink moves the link only with no link yet, or when merge_item
            -- is moving it from a merged copy to the drink it was merged into.
            IF NOT v_named AND (NEW.based_on_id IS NULL OR NEW.based_on_id = NEW.spec_from_id
                                OR EXISTS (SELECT 1 FROM private.item_merges m
                                            WHERE m.from_id = NEW.based_on_id AND m.into_id = NEW.spec_from_id)) THEN
                v_kind := CASE WHEN NEW.based_on_kind = 'descends' THEN 'descends' ELSE 'riff' END;
                v_id := NEW.spec_from_id; v_named := true;
            ELSIF v_id IS DISTINCT FROM NEW.spec_from_id THEN
                RAISE EXCEPTION 'A copied spec comes from the drink it''s based on: spec_from_id must name the same drink.' USING ERRCODE = 'check_violation';
            END IF;
        END IF;
        IF NOT v_named THEN
            -- This write only cleared old columns: what's left of them.
            v_kind := CASE WHEN NEW.riff_of_id IS NOT NULL THEN 'riff'
                           WHEN NEW.lineage_parent_id IS NOT NULL THEN 'descends'
                           WHEN NEW.lineage_style_id IS NOT NULL THEN 'style' END;
            v_id := COALESCE(NEW.riff_of_id, NEW.lineage_parent_id);
            v_style_id := NEW.lineage_style_id;
        END IF;
        IF v_link THEN
            IF (v_kind, v_id, v_style_id) IS DISTINCT FROM (NEW.based_on_kind, NEW.based_on_id, NEW.based_on_style_id) THEN
                RAISE EXCEPTION 'This write sets the based-on link two ways that disagree (based_on_* and the old lineage columns).' USING ERRCODE = 'check_violation';
            END IF;
        ELSE
            NEW.based_on_kind := v_kind;
            NEW.based_on_id := v_id;
            NEW.based_on_style_id := v_style_id;
        END IF;
    END IF;
    IF v_riff OR v_parent OR v_style OR v_spec OR v_spec_cleared OR v_link OR v_spec_source THEN
        NEW.riff_of_id := CASE WHEN NEW.based_on_kind = 'riff' THEN NEW.based_on_id END;
        NEW.lineage_parent_id := CASE WHEN NEW.based_on_kind = 'descends' THEN NEW.based_on_id END;
        NEW.lineage_style_id := CASE WHEN NEW.based_on_kind = 'style' THEN NEW.based_on_style_id END;
        -- A copied spec stops being the classic's when the drink is based on
        -- something else (its lines were copied from the old one), or when
        -- the drink it came from is deleted. A merge isn't something else:
        -- the copy and the drink it went into are one drink.
        IF NOT v_ins AND OLD.spec_source = 'classic' AND NEW.spec_source = 'classic'
           AND (v_spec_cleared
                OR (NEW.based_on_id IS DISTINCT FROM OLD.based_on_id
                    AND NOT EXISTS (SELECT 1 FROM private.item_merges m
                                     WHERE m.from_id = OLD.based_on_id AND m.into_id = NEW.based_on_id))) THEN
            NEW.spec_source := 'bar';
            v_spec := false;
        END IF;
        -- A spec_from_id written on a spec that isn't the classic's stays as
        -- written (it names the link, checked above), so guard_spec_source
        -- still refuses it from anyone but the catalog, as before.
        NEW.spec_from_id := CASE WHEN NEW.spec_source = 'classic' THEN NEW.based_on_id
                                 WHEN v_spec THEN NEW.spec_from_id END;
    END IF;

    -- --- The family ---
    IF v_family OR v_tree_family OR v_family_item THEN
        -- The name the old Family row picked, when it was written.
        IF v_family_item AND NEW.family_id IS NOT NULL THEN
            SELECT private.family_name(f.name) INTO v_name FROM public.items f WHERE f.id = NEW.family_id;
        END IF;
        IF v_family THEN
            IF (v_tree_family AND NEW.lineage_family IS DISTINCT FROM private.family_key(NEW.drink_family))
               OR (v_family_item AND lower(v_name) IS DISTINCT FROM lower(NEW.drink_family)) THEN
                RAISE EXCEPTION 'This write sets the family two ways that disagree (family and lineage_family or family_id).' USING ERRCODE = 'check_violation';
            END IF;
        ELSIF v_tree_family THEN
            -- The tree's family named: the Family row's name for it when this
            -- write gave one, the drink's own name when it already says it
            -- ("Sours"), else the key's name.
            IF NEW.lineage_family IS NULL THEN
                NEW.drink_family := CASE WHEN v_family_item THEN v_name END;
            ELSIF v_family_item AND private.family_key(v_name) = NEW.lineage_family THEN
                NEW.drink_family := v_name;
            ELSIF private.family_key(NEW.drink_family) IS DISTINCT FROM NEW.lineage_family THEN
                NEW.drink_family := private.family_label(NEW.lineage_family);
            END IF;
        ELSE
            -- The Family row: its item's name, or none.
            NEW.drink_family := v_name;
        END IF;

        -- Old builds' Family row shows a family item by that name: kept when
        -- it already says this family, else a shared one or the drink's own
        -- venue's (its venue's first), matched without case. None: empty.
        IF NOT v_family_item THEN
            v_name := NULL;
            IF NEW.family_id IS NOT NULL THEN
                SELECT private.family_name(f.name) INTO v_name FROM public.items f WHERE f.id = NEW.family_id;
            END IF;
            IF lower(v_name) IS DISTINCT FROM lower(NEW.drink_family) THEN
                -- ponytail: scans items for its few 'family' rows, only when a
                -- family changes; a partial index on lower(name) if it shows.
                NEW.family_id := (
                    SELECT f.id FROM public.items f
                     WHERE f.item_type = 'family' AND lower(private.family_name(f.name)) = lower(NEW.drink_family)
                       AND (f.bar_id IS NULL OR f.bar_id = NEW.bar_id)
                     ORDER BY (f.bar_id IS NOT NULL) DESC, f.is_catalog DESC,
                              (f.created_by IS NULL) DESC, f.created_at, f.id
                     LIMIT 1);
            END IF;
        END IF;
    END IF;
    -- The history tree's family (lineage_family) is the family's key, on
    -- catalog drinks in the tree only: with a history link, or a root that
    -- already has one. A catalog drink given a family by the Family row
    -- doesn't join old builds' tree as a root, and one in the tree given a
    -- family outside the eight leaves it.
    IF v_family OR v_tree_family OR v_family_item OR v_link OR v_riff OR v_parent OR v_style OR v_spec THEN
        NEW.lineage_family := CASE WHEN NEW.is_catalog AND (NEW.lineage_family IS NOT NULL OR NEW.based_on_kind IN ('descends', 'style'))
                                   THEN private.family_key(NEW.drink_family) END;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."based_on_sync"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "based_on_sync" BEFORE INSERT OR UPDATE OF
    "based_on_id", "based_on_style_id", "based_on_kind", "drink_family",
    "riff_of_id", "lineage_parent_id", "lineage_style_id", "spec_from_id", "spec_source", "lineage_family", "family_id"
    ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."based_on_sync"();

-- A trigger declared UPDATE OF fires only for the columns a statement sets,
-- not for ones another trigger copies in. So the triggers that watch the
-- old columns also watch the columns that, through based_on_sync, change
-- them. Their functions keep reading the old columns, which the sync has
-- settled by then.
--   guard_item_lineage: only catalog admins change the family tree. A new
--   based_on_* or family write, an old riff_of_id write (one link: it clears
--   a lineage parent) or an old Family row pick on a catalog drink in the
--   tree all change lineage_* now. Venue drinks are unaffected: there the
--   sync never touches lineage_*.
DROP TRIGGER "guard_item_lineage" ON "public"."items";
CREATE TRIGGER "guard_item_lineage" BEFORE UPDATE OF
    "lineage_parent_id", "lineage_style_id", "lineage_family", "lineage_note",
    "riff_of_id", "spec_from_id", "family_id", "based_on_id", "based_on_style_id", "based_on_kind", "drink_family"
    ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_lineage"();
--   guard_spec_source: only the catalog marks a spec as the classic's. A
--   new link moves spec_from_id with it (a merge) or clears it (anything
--   else), which the guard allows; listed so whatever the sync writes there
--   is judged too.
DROP TRIGGER "guard_spec_source" ON "public"."items";
CREATE TRIGGER "guard_spec_source" BEFORE INSERT OR UPDATE OF
    "spec_source", "spec_from_id", "riff_of_id", "based_on_id", "based_on_kind"
    ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_spec_source"();
--   spec_match_item_updated: a drink matched against a new classic. Its
--   WHEN still reads riff_of_id, which every link write now settles.
--   (spec_match_item_inserted needs nothing: its WHEN reads the row as
--   inserted, after the sync.)
DROP TRIGGER "spec_match_item_updated" ON "public"."items";
CREATE TRIGGER "spec_match_item_updated" AFTER UPDATE OF
    "riff_of_id", "name", "is_catalog",
    "lineage_parent_id", "lineage_style_id", "spec_from_id", "based_on_id", "based_on_style_id", "based_on_kind"
    ON "public"."items"
    FOR EACH ROW
    WHEN (OLD."riff_of_id" IS DISTINCT FROM NEW."riff_of_id" OR OLD."name" IS DISTINCT FROM NEW."name" OR OLD."is_catalog" IS DISTINCT FROM NEW."is_catalog")
    EXECUTE FUNCTION "private"."spec_match_item_changed"();
-- Not recreated: guard_item_credit (credit columns, not lineage),
-- discover_mark and guard_item_approval (no column list, so they see every
-- update), and the claim_spec_on_edit triggers (on recipes; they write
-- spec_source and spec_from_id, which the sync watches).

-- merge_item moves every link to a merged copy onto the drink it went
-- into. As 20261124200000, with based_on_id among the links p_into takes
-- from p_from when p_into was linked to the copy: p_from's own link, when
-- it's the same kind (a riff of a riff stays a riff; a riff of a classic
-- that descends from another isn't made a riff of that one), as the old
-- columns did one kind per column. The sync moves the old columns with it.
CREATE OR REPLACE FUNCTION "private"."merge_item"("p_from" "uuid", "p_into" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from public.items;
    v_into public.items;
    v_fk record;
    v_dup record;
    v_ctid tid;
    v_pin smallint;
    v_images uuid[];
    v_row jsonb;
    v_worker text := current_setting('app.image_worker', true);
BEGIN
    SELECT * INTO v_from FROM public.items WHERE id = p_from;
    SELECT * INTO v_into FROM public.items WHERE id = p_into;
    IF v_from.id IS NULL OR v_into.id IS NULL OR p_from = p_into THEN
        RAISE EXCEPTION 'Pick two different items.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_from.item_type <> v_into.item_type OR v_from.item_type = 'ingredient' THEN
        RAISE EXCEPTION 'Merge two items of the same kind (ingredients use merge_ingredient).' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_from.bar_id IS DISTINCT FROM v_into.bar_id THEN
        RAISE EXCEPTION 'Merge items from the same venue, or two shared ones.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Moving spec rows must not queue paid sketches. Put back at the end.
    PERFORM set_config('app.image_worker', 'on', true);

    INSERT INTO private.item_merges (from_id, into_id, snapshot)
    VALUES (p_from, p_into, jsonb_build_object(
        'item', to_jsonb(v_from),
        'recipes', (SELECT jsonb_agg(to_jsonb(r)) FROM public.recipes r WHERE r.recipe_item_id = p_from),
        'item_notes', (SELECT to_jsonb(n) FROM public.item_notes n WHERE n.item_id = p_from),
        'credited_drink_details', (SELECT to_jsonb(d) FROM public.credited_drink_details d WHERE d.item_id = p_from)))
    ON CONFLICT (from_id) DO NOTHING;

    -- A spec belongs to one drink: when p_into has its own, the copy's spec
    -- and everything worked out from it go rather than mixing into it.
    IF EXISTS (SELECT 1 FROM public.recipes WHERE recipe_item_id = p_into) THEN
        DELETE FROM public.recipes WHERE recipe_item_id = p_from;
        DELETE FROM public.item_methods WHERE item_id = p_from;
        DELETE FROM public.item_steps WHERE item_id = p_from;
        DELETE FROM public.item_versions WHERE item_id = p_from;
        DELETE FROM public.item_flavors WHERE item_id = p_from;
        DELETE FROM public.item_allergens WHERE item_id = p_from;
        DELETE FROM public.item_allergen_checks WHERE item_id = p_from;
        DELETE FROM public.item_sketches WHERE item_id = p_from;
        DELETE FROM private.item_sketch_ai WHERE item_id = p_from;
        DELETE FROM public.discover_drink_facts WHERE item_id = p_from;
        DELETE FROM private.item_spec_matches WHERE item_id = p_from;
        -- Sketches drawn from the copy's spec; photos move with the rest.
        WITH gone AS (
            DELETE FROM public.item_images WHERE item_id = p_from AND is_generated RETURNING image_id
        )
        SELECT array_agg(image_id) INTO v_images FROM gone;
        DELETE FROM public.images im
         WHERE im.id = ANY (COALESCE(v_images, '{}'))
           AND NOT EXISTS (SELECT 1 FROM public.item_images ii WHERE ii.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.drink_photos p WHERE p.image_id = im.id)
           AND NOT EXISTS (SELECT 1 FROM public.made_drinks m WHERE m.image_id = im.id);
    ELSE
        -- The copy's spec moves, with its parts (20261123100000): lines and
        -- methods keep their part, so p_into takes the parts' names too.
        UPDATE public.items SET parts = v_from.parts WHERE id = p_into AND parts IS NULL;
        -- The copy's spec moves; its steps and versions only when p_into has none.
        IF EXISTS (SELECT 1 FROM public.item_steps WHERE item_id = p_into) THEN
            DELETE FROM public.item_steps WHERE item_id = p_from;
        END IF;
        IF EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = p_into) THEN
            DELETE FROM public.item_versions WHERE item_id = p_from;
        END IF;
    END IF;
    -- Figures kept aside for a bar-credited drink (20261008050000) only
    -- follow onto another bar-credited drink, and so do its notes: any other
    -- copy's notes went with its row, as they did on items.notes.
    IF NOT private.is_bar_credited_drink(v_into.bar_id, v_into.is_catalog, v_into.created_by, v_into.origin_bar_profile_id) THEN
        DELETE FROM public.credited_drink_details WHERE item_id = p_from;
    END IF;
    IF NOT (private.is_bar_credited_drink(v_into.bar_id, v_into.is_catalog, v_into.created_by, v_into.origin_bar_profile_id)
            AND private.is_bar_credited_drink(v_from.bar_id, v_from.is_catalog, v_from.created_by, v_from.origin_bar_profile_id)) THEN
        DELETE FROM public.item_notes WHERE item_id = p_from;
    END IF;

    -- Someone who ranked both keeps one ranking. The one already on p_into
    -- stays; what hangs off the other (comparisons, photos, made drinks) moves
    -- onto it first, so nothing is dropped with it.
    FOR v_dup IN
        WITH m AS (
            SELECT e.id, e.user_id, e.venue_profile_id,
                   CASE WHEN e.item_id = p_from THEN p_into ELSE e.item_id END AS item_id,
                   CASE WHEN e.ranked_as_item_id = p_from THEN p_into ELSE e.ranked_as_item_id END AS ranked_as_item_id,
                   (e.item_id = p_from OR e.ranked_as_item_id IS NOT DISTINCT FROM p_from) AS moving
              FROM public.rank_entries e
             WHERE e.user_id IN (SELECT user_id FROM public.rank_entries WHERE item_id = p_from OR ranked_as_item_id = p_from)
        ), g AS (
            SELECT id, first_value(id) OVER (
                       PARTITION BY user_id, item_id, ranked_as_item_id, venue_profile_id
                       ORDER BY moving, id) AS keep_id
              FROM m
        )
        SELECT id AS drop_id, keep_id FROM g WHERE id <> keep_id
    LOOP
        DELETE FROM public.rank_comparisons
         WHERE (winner_entry_id = v_dup.drop_id AND loser_entry_id = v_dup.keep_id)
            OR (winner_entry_id = v_dup.keep_id AND loser_entry_id = v_dup.drop_id);
        FOR v_fk IN
            SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
              JOIN pg_namespace n ON n.oid = t.relnamespace
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
             WHERE c.contype = 'f' AND c.confrelid = 'public.rank_entries'::regclass
        LOOP
            EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2', v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name)
              USING v_dup.keep_id, v_dup.drop_id;
        END LOOP;
        DELETE FROM public.rank_entries WHERE id = v_dup.drop_id RETURNING profile_pin INTO v_pin;
        -- A pinned ranking stays pinned, so it stays shown (rank_entries_pin_shown).
        UPDATE public.rank_entries SET profile_pin = v_pin, on_profile = true
         WHERE id = v_dup.keep_id AND profile_pin IS NULL AND v_pin IS NOT NULL;
    END LOOP;

    -- Every foreign key to items, on the column that holds the item's id
    -- (release_items' key also carries bar_id, which the two share).
    FOR v_fk IN
        SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name,
               -- Rows elsewhere that a delete here would cascade to or clear.
               EXISTS (SELECT 1 FROM pg_constraint d WHERE d.contype = 'f' AND d.confrelid = c.conrelid
                         AND d.confdeltype IN ('c', 'n', 'd')) AS has_dependents
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          CROSS JOIN LATERAL unnest(c.conkey, c.confkey) AS k(attnum, refnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.refnum
         WHERE c.contype = 'f' AND c.confrelid = 'public.items'::regclass AND ra.attname = 'id'
    LOOP
        IF v_fk.schema_name = 'public' AND v_fk.table_name = 'items' THEN
            -- p_into can't end up linked to itself. A riff, copy or child
            -- takes p_from's own link instead (the based-on link only when
            -- it's the same kind); any other link is cleared.
            EXECUTE format('UPDATE public.items i SET %1$I = %2$s FROM public.items f WHERE f.id = $1 AND i.id = $2 AND i.%1$I = $1',
                           v_fk.column_name,
                           CASE WHEN v_fk.column_name IN ('riff_of_id', 'spec_from_id', 'lineage_parent_id')
                                THEN format('NULLIF(f.%I, $2)', v_fk.column_name)
                                WHEN v_fk.column_name = 'based_on_id'
                                THEN 'CASE WHEN f.based_on_kind = i.based_on_kind THEN NULLIF(f.based_on_id, $2) END'
                                ELSE 'NULL' END)
              USING p_from, p_into;
            -- Items are never deleted here: a clash stops the merge.
            EXECUTE format('UPDATE public.items SET %1$I = $1 WHERE %1$I = $2', v_fk.column_name)
              USING p_into, p_from;
            CONTINUE;
        END IF;
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
                    IF v_fk.has_dependents THEN
                        RAISE EXCEPTION 'Merging % into %: a %.% row clashes and other rows depend on it.', p_from, p_into, v_fk.schema_name, v_fk.table_name
                            USING ERRCODE = 'unique_violation';
                    END IF;
                    -- Kept in the merge record, so it can be put back.
                    EXECUTE format('DELETE FROM %I.%I t WHERE ctid = $1 RETURNING to_jsonb(t)', v_fk.schema_name, v_fk.table_name)
                      INTO v_row USING v_ctid;
                    UPDATE private.item_merges
                       SET snapshot = jsonb_set(snapshot, '{dropped}', COALESCE(snapshot -> 'dropped', '[]')
                                      || jsonb_build_array(jsonb_build_object('table', v_fk.schema_name || '.' || v_fk.table_name, 'row', v_row)))
                     WHERE from_id = p_from;
                    RAISE NOTICE 'merge_item %: dropped a %.% row that p_into already has', p_from, v_fk.schema_name, v_fk.table_name;
                END;
            END LOOP;
        END;
    END LOOP;
    -- A copy matched to p_into as its classic now reads as p_into matching itself.
    DELETE FROM private.item_spec_matches WHERE item_id = p_into AND classic_id = p_into;

    -- Ids held without a foreign key.
    DELETE FROM public.profile_picks p
     WHERE p.target_id = p_from
       AND EXISTS (SELECT 1 FROM public.profile_picks q WHERE q.profile_id = p.profile_id AND q.section = p.section AND q.target_id = p_into);
    UPDATE public.profile_picks SET target_id = p_into WHERE target_id = p_from;
    -- A bring-in's list is what Undo deletes: p_from leaves it, and p_into
    -- (which that bring-in didn't make) is never added.
    UPDATE public.bring_in_batches SET item_ids = array_remove(item_ids, p_from) WHERE p_from = ANY (item_ids);
    DELETE FROM private.item_flavor_jobs WHERE item_id = p_from;
    DELETE FROM private.item_image_jobs WHERE item_id = p_from;
    PERFORM private.discover_mark(ARRAY[p_into]);

    DELETE FROM public.items WHERE id = p_from;

    PERFORM set_config('app.image_worker', COALESCE(v_worker, ''), true);
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."merge_item"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";

-- --- 5. One credit relation ---

-- Credit has one home (decision credit-model, 1 Nov 2026): item_credits, a
-- row for each credit, as (drink, who, role, status), with a dispute path.
--   * Who: a page (profile_id) or a plain name (name: a maker with no page,
--     like "Harry Craddock").
--   * Role: creator (the lead with a page at sort_order 0, and plain names
--     at 1 to 5, as the drink names them), co_creator (others with a page
--     who made it with them), bar (the bar it was first made at) or maker
--     (who cut its ice or made its glass; what says which).
--   * One status set for every role: suggested (named, nobody has
--     answered), pending (waiting for the named person's or maker team's
--     yes), accepted, verified (a moderator checked it), declined (the
--     named party said no: it sticks and is hidden) and disputed (the named
--     party says something about it is wrong, with a note, until the drink's
--     editors or a moderator settle it). status_by and status_at say who set
--     it and when.
--   * Backfilled from the five old places: items.creator_profile_id,
--     creator_names, credit_status (one status the creator and the bar
--     shared) and origin_bar_profile_id, item_co_creators and
--     item_maker_credits. Mapping below.
--   * items.origin_bar_profile_id stays on items: it is also a shared
--     drink's home bar, an access key read by RLS and about 40 functions.
--     The bar row mirrors it.
--   * The old places stay in step for builds before 2.0 and the database
--     code that still reads them: triggers copy every old write into
--     item_credits, and the new functions write both. They drop with the
--     other old fields once 2.0 is on every phone.
--   * Reading: a drink's shown credits (suggested, accepted, verified, and
--     disputed with its flag) are read where the drink is; pending and
--     declined ones only by the party named, the drink's editors and
--     moderators. Unconfirmed maker credits were readable by anyone who
--     could see the drink (only the app hid them); now they aren't.
--     Signed out, credits are read through published_items, as before.
--   * Nobody writes item_credits directly. New: answer_item_credit (yes or
--     no, for any role), dispute_credit, resolve_credit_dispute and
--     set_maker_credit. set_drink_credits still saves who made it.

CREATE TABLE "public"."item_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "role" "text" NOT NULL,
    "what" "text" DEFAULT 'drink' NOT NULL,
    "profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "name" "text",
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'suggested' NOT NULL,
    "status_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "status_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disputed_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "disputed_at" timestamp with time zone,
    "dispute_note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_credits_role_check" CHECK ("role" IN ('creator', 'co_creator', 'bar', 'maker')),
    CONSTRAINT "item_credits_what_check" CHECK ("what" IN ('drink', 'ice', 'glassware') AND ("role" = 'maker') = ("what" <> 'drink')),
    CONSTRAINT "item_credits_status_check" CHECK ("status" IN ('suggested', 'pending', 'accepted', 'verified', 'declined', 'disputed')),
    CONSTRAINT "item_credits_page_or_name" CHECK (num_nonnulls("profile_id", "name") = 1),
    CONSTRAINT "item_credits_name_check" CHECK ("name" IS NULL OR ("role" = 'creator' AND "name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80)),
    -- A page's credit sorts first (0); plain names follow in the order given.
    CONSTRAINT "item_credits_sort_order_check" CHECK (CASE WHEN "name" IS NULL THEN "sort_order" = 0 ELSE "sort_order" BETWEEN 1 AND 5 END),
    CONSTRAINT "item_credits_dispute_check" CHECK (
        ("status" <> 'disputed' OR ("disputed_at" IS NOT NULL AND "disputed_by" IS NOT NULL))
        AND ("dispute_note" IS NULL OR char_length("dispute_note") BETWEEN 1 AND 500))
);

COMMENT ON TABLE "public"."item_credits" IS
    'Who made a drink, where it was first made, and who cut its ice or made its glass: one row per credit, with one status set and a dispute path. Written only through set_drink_credits, set_maker_credit, answer_item_credit, dispute_credit and resolve_credit_dispute (and the old places, kept in step until 2.0 is on every phone).';
COMMENT ON COLUMN "public"."item_credits"."role" IS
    'creator: the lead with a page (sort_order 0) or a plain name (1 to 5). co_creator: others with a page who made it with them. bar: the bar it was first made at (mirrors items.origin_bar_profile_id, the home bar). maker: who cut its ice or made its glass.';
COMMENT ON COLUMN "public"."item_credits"."what" IS 'drink, or for a maker: ice or glassware.';
COMMENT ON COLUMN "public"."item_credits"."status" IS
    'suggested: named, nobody has answered. pending: waiting for the named party''s yes. accepted. verified: a moderator checked it. declined: the named party said no (sticks, hidden). disputed: the named party says it''s wrong, until the drink''s editors or a moderator settle it.';
COMMENT ON COLUMN "public"."item_credits"."dispute_note" IS 'What the party disputing it says is wrong (up to 500 characters). Kept after the dispute is settled.';

-- One credit per page in each place. A no stays, so nobody names them
-- there again.
CREATE UNIQUE INDEX "item_credits_page_key" ON "public"."item_credits" ("item_id", "role", "what", "profile_id") WHERE "profile_id" IS NOT NULL;
-- One lead creator (0) and one name in each place (1 to 5), and one first
-- bar, as the old columns hold. A no doesn't take the place.
CREATE UNIQUE INDEX "item_credits_creator_place" ON "public"."item_credits" ("item_id", "sort_order") WHERE "role" = 'creator' AND "status" <> 'declined';
CREATE UNIQUE INDEX "item_credits_one_bar" ON "public"."item_credits" ("item_id") WHERE "role" = 'bar' AND "status" <> 'declined';
CREATE INDEX "item_credits_item_id_idx" ON "public"."item_credits" ("item_id");
CREATE INDEX "item_credits_profile_id_idx" ON "public"."item_credits" ("profile_id") WHERE "profile_id" IS NOT NULL;
CREATE INDEX "item_credits_pending_idx" ON "public"."item_credits" ("profile_id") WHERE "status" = 'pending';
CREATE INDEX "item_credits_status_by_idx" ON "public"."item_credits" ("status_by") WHERE "status_by" IS NOT NULL;
CREATE INDEX "item_credits_disputed_by_idx" ON "public"."item_credits" ("disputed_by") WHERE "disputed_by" IS NOT NULL;
CREATE INDEX "item_credits_created_by_idx" ON "public"."item_credits" ("created_by") WHERE "created_by" IS NOT NULL;

ALTER TABLE "public"."item_credits" ENABLE ROW LEVEL SECURITY;

-- The party a credit names: the person's own account, or the team of the
-- bar or maker page (edit_drinks for a bar's credit, as claiming it needed;
-- publish for a maker's, as confirming it needed).
CREATE FUNCTION "private"."is_credit_party"("p_role" "text", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_profile_id
          AND ((p.kind = 'person' AND p.user_id = auth.uid())
               OR (p.kind IN ('bar', 'maker') AND p.bar_id IN (
                   SELECT private.bars_with_capability(
                       CASE WHEN p_role = 'maker' THEN 'publish' ELSE 'edit_drinks' END::public.venue_capability)))));
$$;
REVOKE ALL ON FUNCTION "private"."is_credit_party"("text", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."is_credit_party"("text", "uuid") TO "authenticated", "service_role";

-- Read where the drink is read, with the page it names. Pending and
-- declined credits: only the party named, the drink's editors and
-- moderators (as item_co_creators_select; unconfirmed maker credits were
-- open to every reader of the drink). The party always sees its own, as a
-- maker team saw its credits. Disputed ones show with their flag: drop
-- 'disputed' from the list to hide them until they're settled.
CREATE POLICY "item_credits_select" ON "public"."item_credits" FOR SELECT TO "authenticated"
    USING (
        (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_credits"."item_id")
         AND ("profile_id" IS NULL OR EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "item_credits"."profile_id"))
         AND ("status" IN ('suggested', 'accepted', 'verified', 'disputed')
              OR (SELECT "private"."is_app_admin"())
              OR "private"."can_edit_item"("item_id")))
        OR "private"."is_credit_party"("role", "profile_id"));

-- No write policies: writes go through the functions below.
REVOKE ALL ON "public"."item_credits" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON "public"."item_credits" TO "authenticated";
GRANT ALL ON "public"."item_credits" TO "service_role";

-- Backfill, from each old place:
--   items.creator_profile_id  -> role creator, sort_order 0, status from
--                                credit_status (suggested or NULL:
--                                suggested; claimed: accepted; verified:
--                                verified)
--   items.creator_names       -> role creator, name, sort_order 1 to 5 in
--                                array order, suggested
--   items.origin_bar_profile_id -> role bar, status from credit_status, as
--                                the creator's
--   item_co_creators          -> role co_creator, status 1:1 (pending,
--                                accepted, declined)
--   item_maker_credits        -> role maker, what = makes, accepted at
--                                confirmed_at, or pending
-- private.run_sheet_credits stays as it is: the run sheet's own note of
-- which bar credits it gave, read only by move_run_drink_credit.
INSERT INTO "public"."item_credits" ("item_id", "role", "profile_id", "status", "status_at", "created_by", "created_at")
SELECT i.id, 'creator', i.creator_profile_id,
       CASE i.credit_status WHEN 'claimed' THEN 'accepted' WHEN 'verified' THEN 'verified' ELSE 'suggested' END,
       i.created_at, NULL, i.created_at
FROM public.items i
WHERE i.creator_profile_id IS NOT NULL;

INSERT INTO "public"."item_credits" ("item_id", "role", "name", "sort_order", "status", "status_at", "created_by", "created_at")
SELECT i.id, 'creator', n.name, n.ord::smallint, 'suggested', i.created_at, NULL, i.created_at
FROM public.items i
CROSS JOIN LATERAL unnest(i.creator_names) WITH ORDINALITY AS n(name, ord)
WHERE i.creator_names IS NOT NULL;

INSERT INTO "public"."item_credits" ("item_id", "role", "profile_id", "status", "status_at", "created_by", "created_at")
SELECT i.id, 'bar', i.origin_bar_profile_id,
       CASE i.credit_status WHEN 'claimed' THEN 'accepted' WHEN 'verified' THEN 'verified' ELSE 'suggested' END,
       i.created_at, NULL, i.created_at
FROM public.items i
WHERE i.origin_bar_profile_id IS NOT NULL;

INSERT INTO "public"."item_credits" ("item_id", "role", "profile_id", "status", "status_at", "created_by", "created_at")
SELECT c.item_id, 'co_creator', c.profile_id, c.status::text, c.created_at, NULL, c.created_at
FROM public.item_co_creators c;

INSERT INTO "public"."item_credits" ("item_id", "role", "what", "profile_id", "status", "status_at", "created_by", "created_at")
SELECT m.item_id, 'maker', m.makes, m.profile_id,
       CASE WHEN m.confirmed_at IS NULL THEN 'pending' ELSE 'accepted' END,
       coalesce(m.confirmed_at, m.created_at), NULL, m.created_at
FROM public.item_maker_credits m;

-- Every old credit has its row, and nothing else came in.
DO $$
DECLARE
    v_old bigint;
    v_new bigint;
BEGIN
    SELECT (SELECT count(*) FROM public.items WHERE creator_profile_id IS NOT NULL)
         + (SELECT coalesce(sum(cardinality(creator_names)), 0) FROM public.items)
         + (SELECT count(*) FROM public.items WHERE origin_bar_profile_id IS NOT NULL)
         + (SELECT count(*) FROM public.item_co_creators)
         + (SELECT count(*) FROM public.item_maker_credits)
      INTO v_old;
    SELECT count(*) INTO v_new FROM public.item_credits;
    IF v_old <> v_new THEN
        RAISE EXCEPTION 'item_credits backfill: % old credits, % rows', v_old, v_new;
    END IF;
END;
$$;

COMMENT ON COLUMN "public"."items"."creator_profile_id" IS
    'Old place of the lead creator, kept in step with item_credits (role creator, sort_order 0) for builds before 2.0. Read item_credits; drops once 2.0 is on every phone.';
COMMENT ON COLUMN "public"."items"."creator_names" IS
    'Old place of the makers with no page, kept in step with item_credits (role creator, name) for builds before 2.0. Read item_credits; drops once 2.0 is on every phone.';
COMMENT ON COLUMN "public"."items"."credit_status" IS
    'Old status the creator and first bar shared, kept in step with item_credits for builds before 2.0 (claimed is accepted there). Read item_credits; drops once 2.0 is on every phone.';
COMMENT ON COLUMN "public"."items"."origin_bar_profile_id" IS
    'The bar it was first made at, and a shared drink''s home bar (who edits it, whether it shows). Stays: item_credits'' bar row mirrors it.';
COMMENT ON TABLE "public"."item_co_creators" IS
    'Old place of co-creators, kept in step with item_credits (role co_creator) for builds before 2.0. Read item_credits; drops once 2.0 is on every phone.';
COMMENT ON TABLE "public"."item_maker_credits" IS
    'Old place of ice and glass credits, kept in step with item_credits (role maker) for builds before 2.0. Read item_credits; drops once 2.0 is on every phone.';

-- --- Old writes reach item_credits ---

-- Old builds and database code still write the old places: items
-- (useCreateDrink, useSaveCareerDrink, set_drink_credits, the run sheet's
-- guest credit, merge_person_profile, remove_venue, seeds), item_co_creators
-- (the wizard, set_drink_credits, answer_credit, stepping off) and
-- item_maker_credits (the glass sheet, confirm_maker_credit, a maker's no).
-- AFTER triggers copy each write. The new functions write item_credits and
-- the old place themselves, with app.credit_sync on so nothing is copied
-- back. A no the party gave sticks: naming them there again is refused when
-- it comes straight from the app, and otherwise (database code and SQL) the
-- no stays and the old place is cleared again.

-- A lead creator or a first bar, from items.
CREATE FUNCTION "private"."put_main_credit"("p_item_id" "uuid", "p_role" "text", "p_profile_id" "uuid", "p_status" "text") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_sync text;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.item_credits
        WHERE item_id = p_item_id AND role = p_role AND what = 'drink' AND profile_id = p_profile_id AND status = 'declined'
    ) THEN
        IF auth.uid() IS NOT NULL AND pg_trigger_depth() <= 1 AND NOT private.is_app_admin() THEN
            RAISE EXCEPTION 'They said this drink isn''t theirs.';
        END IF;
        v_sync := current_setting('app.credit_sync', true);
        PERFORM set_config('app.credit_sync', 'on', true);
        IF p_role = 'creator' THEN
            UPDATE public.items SET creator_profile_id = NULL WHERE id = p_item_id AND creator_profile_id = p_profile_id;
        ELSE
            UPDATE public.items SET origin_bar_profile_id = NULL WHERE id = p_item_id AND origin_bar_profile_id = p_profile_id;
        END IF;
        PERFORM set_config('app.credit_sync', coalesce(v_sync, ''), true);
        RETURN;
    END IF;
    -- The old column holds one: any other one there goes.
    DELETE FROM public.item_credits
     WHERE item_id = p_item_id AND role = p_role AND profile_id IS NOT NULL
       AND profile_id <> p_profile_id AND status <> 'declined';
    INSERT INTO public.item_credits (item_id, role, profile_id, status, status_by)
    VALUES (p_item_id, p_role, p_profile_id, p_status, auth.uid())
    ON CONFLICT (item_id, role, what, profile_id) WHERE profile_id IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status, status_by = EXCLUDED.status_by, status_at = now()
       WHERE item_credits.status IS DISTINCT FROM EXCLUDED.status;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."put_main_credit"("uuid", "text", "uuid", "text") FROM PUBLIC, "anon", "authenticated";

CREATE FUNCTION "private"."sync_item_credits_from_item"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_creator boolean;
    v_bar boolean;
    v_names boolean;
    v_status_changed boolean := false;
    v_status text := CASE NEW.credit_status WHEN 'claimed' THEN 'accepted' WHEN 'verified' THEN 'verified' ELSE 'suggested' END;
BEGIN
    IF current_setting('app.credit_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'INSERT' THEN
        v_creator := NEW.creator_profile_id IS NOT NULL;
        v_bar := NEW.origin_bar_profile_id IS NOT NULL;
        v_names := NEW.creator_names IS NOT NULL;
    ELSE
        v_creator := NEW.creator_profile_id IS DISTINCT FROM OLD.creator_profile_id;
        v_bar := NEW.origin_bar_profile_id IS DISTINCT FROM OLD.origin_bar_profile_id;
        v_names := NEW.creator_names IS DISTINCT FROM OLD.creator_names;
        v_status_changed := NEW.credit_status IS DISTINCT FROM OLD.credit_status;
        IF v_creator AND OLD.creator_profile_id IS NOT NULL THEN
            DELETE FROM public.item_credits
             WHERE item_id = NEW.id AND role = 'creator' AND profile_id = OLD.creator_profile_id AND status <> 'declined';
        END IF;
        IF v_bar AND OLD.origin_bar_profile_id IS NOT NULL THEN
            DELETE FROM public.item_credits
             WHERE item_id = NEW.id AND role = 'bar' AND profile_id = OLD.origin_bar_profile_id AND status <> 'declined';
        END IF;
    END IF;

    -- credit_status was one status for the creator and the bar. A change
    -- reaches both, except that one which came with a new creator or bar
    -- (guard_item_credit resets it then) reaches only the new one. A no or a
    -- dispute is settled through the new functions, not by this.
    IF v_creator AND NEW.creator_profile_id IS NOT NULL THEN
        PERFORM private.put_main_credit(NEW.id, 'creator', NEW.creator_profile_id, v_status);
    ELSIF v_status_changed AND NOT (v_bar AND NEW.origin_bar_profile_id IS NOT NULL) AND NEW.creator_profile_id IS NOT NULL THEN
        UPDATE public.item_credits SET status = v_status, status_by = auth.uid(), status_at = now()
         WHERE item_id = NEW.id AND role = 'creator' AND profile_id = NEW.creator_profile_id
           AND status NOT IN ('declined', 'disputed', v_status);
    END IF;
    IF v_bar AND NEW.origin_bar_profile_id IS NOT NULL THEN
        PERFORM private.put_main_credit(NEW.id, 'bar', NEW.origin_bar_profile_id, v_status);
    ELSIF v_status_changed AND NOT (v_creator AND NEW.creator_profile_id IS NOT NULL) AND NEW.origin_bar_profile_id IS NOT NULL THEN
        UPDATE public.item_credits SET status = v_status, status_by = auth.uid(), status_at = now()
         WHERE item_id = NEW.id AND role = 'bar' AND profile_id = NEW.origin_bar_profile_id
           AND status NOT IN ('declined', 'disputed', v_status);
    END IF;

    -- Plain names, in the order given.
    IF v_names THEN
        DELETE FROM public.item_credits WHERE item_id = NEW.id AND role = 'creator' AND name IS NOT NULL;
        INSERT INTO public.item_credits (item_id, role, name, sort_order, status_by)
        SELECT NEW.id, 'creator', n.name, n.ord::smallint, auth.uid()
          FROM unnest(NEW.creator_names) WITH ORDINALITY AS n(name, ord);
    END IF;
    RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."sync_item_credits_from_item"() FROM PUBLIC, "anon", "authenticated";

-- No column list on the update trigger: an UPDATE OF list fires only for
-- columns in the statement's SET, and guard_item_credit fills credit_status
-- itself. The WHEN reads the row as stored.
CREATE TRIGGER "sync_item_credits_inserted" AFTER INSERT ON "public"."items"
    FOR EACH ROW
    WHEN (NEW.creator_profile_id IS NOT NULL OR NEW.origin_bar_profile_id IS NOT NULL OR NEW.creator_names IS NOT NULL)
    EXECUTE FUNCTION "private"."sync_item_credits_from_item"();
CREATE TRIGGER "sync_item_credits_updated" AFTER UPDATE ON "public"."items"
    FOR EACH ROW
    WHEN (OLD.creator_profile_id IS DISTINCT FROM NEW.creator_profile_id
          OR OLD.origin_bar_profile_id IS DISTINCT FROM NEW.origin_bar_profile_id
          OR OLD.creator_names IS DISTINCT FROM NEW.creator_names
          OR OLD.credit_status IS DISTINCT FROM NEW.credit_status)
    EXECUTE FUNCTION "private"."sync_item_credits_from_item"();

CREATE FUNCTION "private"."sync_item_credits_from_co_creator"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_answered boolean := true;
BEGIN
    IF current_setting('app.credit_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.item_credits WHERE item_id = OLD.item_id AND role = 'co_creator' AND profile_id = OLD.profile_id;
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        v_answered := NEW.status IS DISTINCT FROM OLD.status;
    END IF;
    -- A merge moved it. Where the new place already has one, that one stays.
    IF TG_OP = 'UPDATE' AND (NEW.item_id <> OLD.item_id OR NEW.profile_id <> OLD.profile_id) THEN
        IF EXISTS (SELECT 1 FROM public.item_credits WHERE item_id = NEW.item_id AND role = 'co_creator' AND profile_id = NEW.profile_id) THEN
            DELETE FROM public.item_credits WHERE item_id = OLD.item_id AND role = 'co_creator' AND profile_id = OLD.profile_id;
        ELSE
            UPDATE public.item_credits SET item_id = NEW.item_id, profile_id = NEW.profile_id
             WHERE item_id = OLD.item_id AND role = 'co_creator' AND profile_id = OLD.profile_id;
        END IF;
    END IF;
    INSERT INTO public.item_credits (item_id, role, profile_id, status, status_by, created_at)
    VALUES (NEW.item_id, 'co_creator', NEW.profile_id, NEW.status::text, auth.uid(), NEW.created_at)
    ON CONFLICT (item_id, role, what, profile_id) WHERE profile_id IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status, status_by = EXCLUDED.status_by, status_at = now()
       WHERE v_answered AND item_credits.status IS DISTINCT FROM EXCLUDED.status;
    RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."sync_item_credits_from_co_creator"() FROM PUBLIC, "anon", "authenticated";
CREATE TRIGGER "sync_item_credits" AFTER INSERT OR UPDATE OR DELETE ON "public"."item_co_creators"
    FOR EACH ROW EXECUTE FUNCTION "private"."sync_item_credits_from_co_creator"();

CREATE FUNCTION "private"."sync_item_credits_from_maker_credit"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_sync text;
    v_answered boolean := true;
BEGIN
    IF current_setting('app.credit_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.item_credits
         WHERE item_id = OLD.item_id AND role = 'maker' AND what = OLD.makes AND profile_id = OLD.profile_id AND status <> 'declined';
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        v_answered := NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at;
    END IF;
    IF TG_OP = 'INSERT' AND EXISTS (
        SELECT 1 FROM public.item_credits
        WHERE item_id = NEW.item_id AND role = 'maker' AND what = NEW.makes AND profile_id = NEW.profile_id AND status = 'declined'
    ) THEN
        IF auth.uid() IS NOT NULL AND pg_trigger_depth() <= 1 AND NOT private.is_app_admin() THEN
            RAISE EXCEPTION 'That maker said no to this credit.';
        END IF;
        v_sync := current_setting('app.credit_sync', true);
        PERFORM set_config('app.credit_sync', 'on', true);
        DELETE FROM public.item_maker_credits WHERE item_id = NEW.item_id AND profile_id = NEW.profile_id AND makes = NEW.makes;
        PERFORM set_config('app.credit_sync', coalesce(v_sync, ''), true);
        RETURN NULL;
    END IF;
    -- A merge moved it. Where the new place already has one, that one stays.
    IF TG_OP = 'UPDATE' AND (NEW.item_id <> OLD.item_id OR NEW.profile_id <> OLD.profile_id OR NEW.makes <> OLD.makes) THEN
        IF EXISTS (SELECT 1 FROM public.item_credits WHERE item_id = NEW.item_id AND role = 'maker' AND what = NEW.makes AND profile_id = NEW.profile_id) THEN
            DELETE FROM public.item_credits WHERE item_id = OLD.item_id AND role = 'maker' AND what = OLD.makes AND profile_id = OLD.profile_id;
        ELSE
            UPDATE public.item_credits SET item_id = NEW.item_id, what = NEW.makes, profile_id = NEW.profile_id
             WHERE item_id = OLD.item_id AND role = 'maker' AND what = OLD.makes AND profile_id = OLD.profile_id;
        END IF;
    END IF;
    INSERT INTO public.item_credits (item_id, role, what, profile_id, status, status_by, status_at, created_at)
    VALUES (NEW.item_id, 'maker', NEW.makes, NEW.profile_id,
            CASE WHEN NEW.confirmed_at IS NULL THEN 'pending' ELSE 'accepted' END,
            auth.uid(), coalesce(NEW.confirmed_at, now()), NEW.created_at)
    ON CONFLICT (item_id, role, what, profile_id) WHERE profile_id IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status, status_by = EXCLUDED.status_by, status_at = EXCLUDED.status_at
       WHERE v_answered AND item_credits.status IS DISTINCT FROM EXCLUDED.status;
    RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."sync_item_credits_from_maker_credit"() FROM PUBLIC, "anon", "authenticated";
CREATE TRIGGER "sync_item_credits" AFTER INSERT OR UPDATE OR DELETE ON "public"."item_maker_credits"
    FOR EACH ROW EXECUTE FUNCTION "private"."sync_item_credits_from_maker_credit"();

-- merge_item moves every row that points at the drink it merges away. The
-- drink's own lead creator, plain names and first bar stay with it, as the
-- old columns on items do (the kept drink keeps its own), and go when it is
-- deleted; its co-creators and makers move, as their old tables' rows do.
CREATE FUNCTION "private"."keep_main_credit_on_its_drink"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.item_id <> OLD.item_id AND OLD.role IN ('creator', 'bar') THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."keep_main_credit_on_its_drink"() FROM PUBLIC, "anon", "authenticated";
CREATE TRIGGER "keep_main_credit_on_its_drink" BEFORE UPDATE OF "item_id" ON "public"."item_credits"
    FOR EACH ROW EXECUTE FUNCTION "private"."keep_main_credit_on_its_drink"();

-- --- Answering, disputing and settling a credit ---

-- One credit's status, written to its old place for builds before 2.0.
-- Callers set app.credit_sync. Old co-credits know pending, accepted and
-- declined (verified reads as accepted there); old maker credits know
-- confirmed or not, and a no deleted them; items.credit_status follows the
-- lead creator, or the bar when there is none (accepted is claimed there).
-- A dispute leaves an old co-credit or maker credit as it was.
CREATE FUNCTION "private"."mirror_credit"("p_credit_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_credit public.item_credits;
    v_old public.credit_status;
BEGIN
    SELECT * INTO v_credit FROM public.item_credits WHERE id = p_credit_id;
    v_old := CASE v_credit.status WHEN 'accepted' THEN 'claimed' WHEN 'verified' THEN 'verified' ELSE 'suggested' END::public.credit_status;
    IF v_credit.role = 'co_creator' THEN
        UPDATE public.item_co_creators
           SET status = CASE v_credit.status WHEN 'verified' THEN 'accepted' ELSE v_credit.status END::public.co_creator_status
         WHERE item_id = v_credit.item_id AND profile_id = v_credit.profile_id
           AND v_credit.status IN ('pending', 'accepted', 'verified', 'declined');
    ELSIF v_credit.role = 'maker' THEN
        IF v_credit.status = 'declined' THEN
            DELETE FROM public.item_maker_credits
             WHERE item_id = v_credit.item_id AND profile_id = v_credit.profile_id AND makes = v_credit.what;
        ELSE
            -- A yes after a no puts the row back.
            INSERT INTO public.item_maker_credits (item_id, profile_id, makes, created_at)
            VALUES (v_credit.item_id, v_credit.profile_id, v_credit.what, v_credit.created_at)
            ON CONFLICT (item_id, profile_id, makes) DO NOTHING;
            UPDATE public.item_maker_credits
               SET confirmed_at = CASE WHEN v_credit.status = 'pending' THEN NULL ELSE coalesce(confirmed_at, v_credit.status_at) END
             WHERE item_id = v_credit.item_id AND profile_id = v_credit.profile_id AND makes = v_credit.what
               AND v_credit.status IN ('pending', 'accepted', 'verified');
        END IF;
    ELSIF v_credit.role = 'creator' AND v_credit.profile_id IS NOT NULL THEN
        IF v_credit.status = 'declined' THEN
            UPDATE public.items SET creator_profile_id = NULL WHERE id = v_credit.item_id AND creator_profile_id = v_credit.profile_id;
        ELSE
            -- A yes after a no puts them back in the empty place.
            UPDATE public.items SET creator_profile_id = v_credit.profile_id, credit_status = v_old
             WHERE id = v_credit.item_id
               AND (creator_profile_id = v_credit.profile_id OR creator_profile_id IS NULL)
               AND (creator_profile_id IS NULL OR credit_status IS DISTINCT FROM v_old);
        END IF;
    ELSIF v_credit.role = 'bar' THEN
        IF v_credit.status = 'declined' THEN
            UPDATE public.items SET origin_bar_profile_id = NULL WHERE id = v_credit.item_id AND origin_bar_profile_id = v_credit.profile_id;
        ELSE
            UPDATE public.items SET origin_bar_profile_id = v_credit.profile_id
             WHERE id = v_credit.item_id AND origin_bar_profile_id IS NULL;
            UPDATE public.items SET credit_status = v_old
             WHERE id = v_credit.item_id AND origin_bar_profile_id = v_credit.profile_id AND creator_profile_id IS NULL
               AND credit_status IS DISTINCT FROM v_old;
        END IF;
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION "private"."mirror_credit"("uuid") FROM PUBLIC, "anon", "authenticated";

-- Yes or no from the party a credit names, for any role: the person named,
-- or the bar's or maker's team. Replaces answer_credit (co-creators) and
-- confirm_maker_credit plus deleting the row (makers), and gives a lead
-- creator and a first bar a say for the first time. A no sticks and hides
-- the credit; a yes later puts it back. A yes keeps a verified credit
-- verified. A shared drink lives on its bar's page, so that bar disputes
-- the credit instead of saying no.
CREATE FUNCTION "public"."answer_item_credit"("p_credit_id" "uuid", "p_accept" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_credit public.item_credits;
    v_status text;
    v_sync text := current_setting('app.credit_sync', true);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to answer a credit.' USING ERRCODE = '42501';
    END IF;
    IF p_accept IS NULL THEN
        RAISE EXCEPTION 'Say yes or no to the credit.';
    END IF;
    SELECT * INTO v_credit FROM public.item_credits WHERE id = p_credit_id FOR UPDATE;
    IF v_credit.id IS NULL OR v_credit.profile_id IS NULL OR NOT private.is_credit_party(v_credit.role, v_credit.profile_id) THEN
        RAISE EXCEPTION 'You aren''t named on that credit.';
    END IF;
    IF NOT p_accept AND v_credit.role = 'bar' AND EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = v_credit.item_id AND i.origin_bar_profile_id = v_credit.profile_id
          AND private.is_bar_credited_drink(i.bar_id, i.is_catalog, i.created_by, i.origin_bar_profile_id)
    ) THEN
        RAISE EXCEPTION 'This drink lives on your bar''s page. Dispute the credit instead, and a moderator will move it.';
    END IF;

    IF p_accept AND v_credit.status = 'declined' AND v_credit.role IN ('creator', 'bar') AND EXISTS (
        SELECT 1 FROM public.item_credits c
        WHERE c.item_id = v_credit.item_id AND c.role = v_credit.role AND c.sort_order = 0
          AND c.profile_id IS NOT NULL AND c.status <> 'declined'
    ) THEN
        RAISE EXCEPTION 'Someone else is credited there now. Ask the drink''s editors.';
    END IF;

    v_status := CASE WHEN NOT p_accept THEN 'declined' WHEN v_credit.status = 'verified' THEN 'verified' ELSE 'accepted' END;
    IF v_status = v_credit.status THEN
        RETURN v_status;
    END IF;
    PERFORM set_config('app.credit_sync', 'on', true);
    UPDATE public.item_credits SET status = v_status, status_by = auth.uid(), status_at = now() WHERE id = v_credit.id;
    PERFORM private.mirror_credit(v_credit.id);
    PERFORM set_config('app.credit_sync', coalesce(v_sync, ''), true);
    RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION "public"."answer_item_credit"("uuid", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."answer_item_credit"("uuid", boolean) TO "authenticated", "service_role";

-- The party a credit names says something about it is wrong (the bar,
-- the year, who else made it), with a note. It stays shown, flagged, until
-- the drink's editors or a moderator settle it. Someone who isn't theirs
-- says no instead (answer_item_credit); a credit still waiting for an
-- answer is answered, not disputed.
CREATE FUNCTION "public"."dispute_credit"("p_credit_id" "uuid", "p_note" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_credit public.item_credits;
    v_note text := nullif(btrim(p_note), '');
    v_sync text := current_setting('app.credit_sync', true);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to dispute a credit.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_credit FROM public.item_credits WHERE id = p_credit_id FOR UPDATE;
    IF v_credit.id IS NULL OR v_credit.profile_id IS NULL OR NOT private.is_credit_party(v_credit.role, v_credit.profile_id) THEN
        RAISE EXCEPTION 'Only the person, bar or maker a credit names can dispute it.' USING ERRCODE = '42501';
    END IF;
    IF v_note IS NULL THEN
        RAISE EXCEPTION 'Say what''s wrong with the credit.';
    END IF;
    IF char_length(v_note) > 500 THEN
        RAISE EXCEPTION 'Keep the note to 500 characters.';
    END IF;
    IF v_credit.status = 'pending' THEN
        RAISE EXCEPTION 'Say yes or no to it instead.';
    ELSIF v_credit.status = 'declined' THEN
        RAISE EXCEPTION 'You said no to it. Say yes to put it back first.';
    ELSIF v_credit.status = 'disputed' THEN
        RAISE EXCEPTION 'That credit is already disputed.';
    END IF;

    PERFORM set_config('app.credit_sync', 'on', true);
    UPDATE public.item_credits
       SET status = 'disputed', status_by = auth.uid(), status_at = now(),
           disputed_by = auth.uid(), disputed_at = now(), dispute_note = v_note
     WHERE id = v_credit.id;
    PERFORM private.mirror_credit(v_credit.id);
    PERFORM set_config('app.credit_sync', coalesce(v_sync, ''), true);
    RETURN 'disputed';
END;
$$;
REVOKE ALL ON FUNCTION "public"."dispute_credit"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."dispute_credit"("uuid", "text") TO "authenticated", "service_role";

-- The drink's editors or a moderator settle a dispute. Kept: a moderator
-- verifies it; an editor puts it back to its party (a lead or bar credit is
-- suggested again, a co-creator's or maker's waits for their yes). Not
-- kept: it is declined, hidden, and nobody names them there again. Only a
-- moderator takes a shared drink off the bar whose page it lives on. The
-- dispute's note stays on the row as the record.
CREATE FUNCTION "public"."resolve_credit_dispute"("p_credit_id" "uuid", "p_keep" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_credit public.item_credits;
    v_admin boolean := private.is_app_admin();
    v_status text;
    v_sync text := current_setting('app.credit_sync', true);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to settle a dispute.' USING ERRCODE = '42501';
    END IF;
    IF p_keep IS NULL THEN
        RAISE EXCEPTION 'Say whether the credit stays.';
    END IF;
    SELECT * INTO v_credit FROM public.item_credits WHERE id = p_credit_id FOR UPDATE;
    IF v_credit.id IS NULL OR NOT (v_admin OR private.can_edit_item(v_credit.item_id)) THEN
        RAISE EXCEPTION 'Only the drink''s editors or a moderator can settle a dispute.' USING ERRCODE = '42501';
    END IF;
    IF v_credit.status <> 'disputed' THEN
        RAISE EXCEPTION 'That credit isn''t disputed.';
    END IF;
    IF NOT p_keep AND NOT v_admin AND v_credit.role = 'bar' AND EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = v_credit.item_id AND i.origin_bar_profile_id = v_credit.profile_id
          AND private.is_bar_credited_drink(i.bar_id, i.is_catalog, i.created_by, i.origin_bar_profile_id)
    ) THEN
        RAISE EXCEPTION 'Only a moderator can take a drink off the bar it lives on.';
    END IF;

    v_status := CASE
        WHEN NOT p_keep THEN 'declined'
        WHEN v_admin THEN 'verified'
        WHEN v_credit.role IN ('co_creator', 'maker') THEN 'pending'
        ELSE 'suggested'
    END;
    PERFORM set_config('app.credit_sync', 'on', true);
    UPDATE public.item_credits SET status = v_status, status_by = auth.uid(), status_at = now() WHERE id = v_credit.id;
    PERFORM private.mirror_credit(v_credit.id);
    PERFORM set_config('app.credit_sync', coalesce(v_sync, ''), true);
    RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION "public"."resolve_credit_dispute"("uuid", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."resolve_credit_dispute"("uuid", boolean) TO "authenticated", "service_role";

-- Credit a maker with a drink's ice or glass, or take the credit off, with
-- the caller's own rights (the drink's editors; the maker's team takes its
-- own off). It writes item_maker_credits, which item_credits copies, so the
-- app has one call for it now and the drop changes only this body.
CREATE FUNCTION "public"."set_maker_credit"("p_item_id" "uuid", "p_profile_id" "uuid", "p_what" "text", "p_credited" boolean) RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF p_credited IS NULL THEN
        RAISE EXCEPTION 'Say whether they made it.';
    END IF;
    IF p_credited THEN
        INSERT INTO public.item_maker_credits (item_id, profile_id, makes) VALUES (p_item_id, p_profile_id, p_what);
    ELSE
        DELETE FROM public.item_maker_credits WHERE item_id = p_item_id AND profile_id = p_profile_id AND makes = p_what;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION "public"."set_maker_credit"("uuid", "uuid", "text", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."set_maker_credit"("uuid", "uuid", "text", boolean) TO "authenticated", "service_role";

-- --- Asking for a yes reads item_credits ---

-- Credits waiting for the signed-in person's yes, now with the credit's id
-- for answer_item_credit. Same rows as before (pending co-credits; a lead
-- credit could wait too).
DROP FUNCTION "public"."credits_to_check"();
CREATE FUNCTION "public"."credits_to_check"()
    RETURNS TABLE("item_id" "uuid", "name" "text", "item_type" "public"."entity_type", "creator_name" "text", "bar_name" "text", "named_at" timestamp with time zone, "bar_place" "text", "credit_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT i.id, i.name, i.item_type, cp.display_name, COALESCE(bp.display_name, b.name), c.created_at,
           CASE WHEN bp.id IS NOT NULL THEN COALESCE(bp.locality, bp.city) ELSE COALESCE(vp.locality, vp.city) END,
           c.id
      FROM public.item_credits c
      JOIN public.profiles me ON me.id = c.profile_id AND me.user_id = auth.uid() AND me.kind = 'person'
      JOIN public.items i ON i.id = c.item_id
      LEFT JOIN public.item_credits l ON l.item_id = i.id AND l.role = 'creator' AND l.sort_order = 0
           AND l.profile_id IS NOT NULL AND l.status <> 'declined'
      LEFT JOIN public.profiles cp ON cp.id = l.profile_id
      LEFT JOIN public.profiles bp ON bp.id = i.origin_bar_profile_id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN LATERAL (
          SELECT p.locality, p.city FROM public.profiles p WHERE p.bar_id = b.id AND p.kind = 'bar' ORDER BY p.created_at LIMIT 1
      ) vp ON true
     WHERE c.status = 'pending' AND c.role IN ('creator', 'co_creator')
     ORDER BY c.created_at DESC
     LIMIT 200;
$$;
REVOKE ALL ON FUNCTION "public"."credits_to_check"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."credits_to_check"() TO "authenticated", "service_role";

-- A maker team's inbox, with the credit's id. A bar page that makes
-- glassware (20261116200000) could be credited but never saw the request or
-- confirmed it: now it does both.
DROP FUNCTION "public"."maker_credit_requests"("uuid");
CREATE FUNCTION "public"."maker_credit_requests"("p_bar_id" "uuid")
    RETURNS TABLE("item_id" "uuid", "profile_id" "uuid", "makes" "text", "drink_name" "text", "credited_by" "text", "created_at" timestamp with time zone, "credit_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT c.item_id, c.profile_id, c.what, i.name,
           COALESCE(bp.display_name, b.name, op.display_name),
           c.created_at, c.id
      FROM public.item_credits c
      JOIN public.profiles m ON m.id = c.profile_id AND m.kind IN ('maker', 'bar') AND m.bar_id = p_bar_id
      JOIN public.items i ON i.id = c.item_id
      LEFT JOIN public.bars b ON b.id = i.bar_id
      LEFT JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.kind = 'bar'
      LEFT JOIN public.profiles op ON op.id = i.origin_bar_profile_id
     WHERE c.role = 'maker' AND c.status = 'pending'
       AND p_bar_id IN (SELECT private.bars_with_capability('publish'))
     ORDER BY c.created_at DESC
     LIMIT 200;
$$;
REVOKE ALL ON FUNCTION "public"."maker_credit_requests"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."maker_credit_requests"("uuid") TO "authenticated", "service_role";

-- For builds before 2.0: as before, and a bar page's team confirms too.
CREATE OR REPLACE FUNCTION "public"."confirm_maker_credit"("p_item_id" "uuid", "p_profile_id" "uuid", "p_makes" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_at timestamp with time zone;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = p_profile_id AND kind IN ('maker', 'bar') AND bar_id IN (SELECT private.bars_with_capability('publish'))
    ) THEN
        RAISE EXCEPTION 'Only the maker''s own team can confirm its credit.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.item_maker_credits SET confirmed_at = COALESCE(confirmed_at, now())
     WHERE item_id = p_item_id AND profile_id = p_profile_id AND makes = p_makes
    RETURNING confirmed_at INTO v_at;
    IF v_at IS NULL THEN
        RAISE EXCEPTION 'There''s no such credit to confirm.' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_at;
END;
$$;

-- Find-yourself: co-credits not declined, on drinks the reader could open.
CREATE OR REPLACE FUNCTION "public"."waiting_co_credits"("p_profile_ids" "uuid"[]) RETURNS TABLE("item_id" "uuid", "profile_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT c.item_id, c.profile_id
      FROM public.item_credits c
     WHERE c.role = 'co_creator'
       AND c.profile_id = ANY (p_profile_ids[1:100])
       AND c.status <> 'declined'
       AND CASE WHEN auth.uid() IS NULL
                THEN EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = c.item_id AND NOT pi.is_reference)
                ELSE private.can_view_item(c.item_id)
           END
     LIMIT 1000;
$$;

-- --- Claiming a page moves its item_credits ---

-- merge_person_profile stops while anything still points at the page.
-- The triggers above move what items and item_co_creators hold; this moves
-- the rest (a no only item_credits keeps). Where the claimant already has a
-- credit in that place, theirs stays and the page's is kept in dropped.
-- Otherwise as 20261030100000 left it.
CREATE OR REPLACE FUNCTION private.merge_person_profile(p_from uuid, p_into uuid, p_claim_id uuid, p_reviewer uuid)
 RETURNS public.profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_from public.profiles;
    v_into public.profiles;
    v_dropped jsonb := '{}'::jsonb;
    v_rows jsonb;
    v_ref record;
    v_left boolean;
    v_headline uuid;
BEGIN
    -- Already merged: nothing to do.
    IF EXISTS (SELECT 1 FROM private.profile_merges WHERE from_profile_id = p_from AND into_profile_id = p_into)
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_from) THEN
        SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
        RETURN v_into;
    END IF;

    -- Lock both, in a fixed order so two merges can't deadlock.
    PERFORM 1 FROM public.profiles WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
    SELECT * INTO v_from FROM public.profiles WHERE id = p_from;
    SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
    IF v_from.id IS NULL OR v_into.id IS NULL OR p_from = p_into THEN
        RAISE EXCEPTION 'Merging profiles needs two different profiles.';
    END IF;
    IF v_from.kind <> 'person' OR v_from.user_id IS NOT NULL OR v_from.bar_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only an unclaimed person''s page can be merged into a profile.';
    END IF;
    IF v_into.kind <> 'person' OR v_into.user_id IS NULL THEN
        RAISE EXCEPTION 'A page can only be merged into someone''s own profile.';
    END IF;

    -- Drinks.
    UPDATE public.items SET creator_profile_id = p_into WHERE creator_profile_id = p_from;

    WITH gone AS (
        DELETE FROM public.item_co_creators f
        WHERE f.profile_id = p_from
          AND (EXISTS (SELECT 1 FROM public.item_co_creators t WHERE t.item_id = f.item_id AND t.profile_id = p_into)
               OR EXISTS (SELECT 1 FROM public.items i WHERE i.id = f.item_id AND i.creator_profile_id = p_into))
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('item_co_creators', v_rows) END;
    UPDATE public.item_co_creators SET profile_id = p_into WHERE profile_id = p_from;

    -- Credits (item_credits): the triggers moved what the two above hold;
    -- this moves the rest. Where the claimant already has that credit,
    -- theirs stays and the page's is kept in dropped.
    WITH gone AS (
        DELETE FROM public.item_credits f
        WHERE f.profile_id = p_from
          AND EXISTS (SELECT 1 FROM public.item_credits t
                      WHERE t.item_id = f.item_id AND t.role = f.role AND t.what = f.what AND t.profile_id = p_into)
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('item_credits', v_rows) END;
    UPDATE public.item_credits SET profile_id = p_into WHERE profile_id = p_from;

    -- Jobs. The same job twice keeps the claimant's row: it takes the page's
    -- dates when it has none (an end only if it isn't current), its link, and
    -- the bar's yes from either. Dates that don't fit stay off; the page's row
    -- is kept in dropped.
    BEGIN
        UPDATE public.profile_positions t SET
            start_year = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL THEN f.start_year ELSE t.start_year END,
            start_month = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL THEN f.start_month ELSE t.start_month END,
            end_year = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL AND NOT t.is_current THEN f.end_year ELSE t.end_year END,
            end_month = CASE WHEN t.start_year IS NULL AND t.end_year IS NULL AND NOT t.is_current THEN f.end_month ELSE t.end_month END,
            source_url = coalesce(t.source_url, f.source_url),
            bar_accepted = t.bar_accepted OR f.bar_accepted
        FROM public.profile_positions f
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title;
    EXCEPTION WHEN check_violation THEN
        UPDATE public.profile_positions t SET
            source_url = coalesce(t.source_url, f.source_url),
            bar_accepted = t.bar_accepted OR f.bar_accepted
        FROM public.profile_positions f
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title;
    END;
    -- The page's headline job, as the claimant's row when they have the same one.
    IF v_into.headline_position_id IS NULL AND v_from.headline_position_id IS NOT NULL THEN
        v_headline := coalesce(
            (SELECT t.id FROM public.profile_positions t
             JOIN public.profile_positions f ON f.id = v_from.headline_position_id
                 AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title
             WHERE t.person_profile_id = p_into),
            v_from.headline_position_id);
    END IF;
    WITH gone AS (
        DELETE FROM public.profile_positions f
        USING public.profile_positions t
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into
          AND t.bar_profile_id = f.bar_profile_id AND t.title = f.title
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_positions', v_rows) END;
    UPDATE public.profile_positions SET person_profile_id = p_into WHERE person_profile_id = p_from;

    -- Menu credits. A duplicate hands its drinks to the claimant's row first.
    INSERT INTO public.profile_worked_menu_drinks (worked_menu_id, item_id, created_at)
    SELECT t.id, d.item_id, d.created_at
    FROM public.profile_worked_menus f
    JOIN public.profile_worked_menus t ON t.person_profile_id = p_into AND t.bar_profile_id IS NOT DISTINCT FROM f.bar_profile_id
        AND t.name IS NOT DISTINCT FROM f.name AND t.year IS NOT DISTINCT FROM f.year
    JOIN public.profile_worked_menu_drinks d ON d.worked_menu_id = f.id
    WHERE f.person_profile_id = p_from
    ON CONFLICT DO NOTHING;
    WITH gone AS (
        DELETE FROM public.profile_worked_menus f
        USING public.profile_worked_menus t
        WHERE f.person_profile_id = p_from AND t.person_profile_id = p_into AND t.bar_profile_id IS NOT DISTINCT FROM f.bar_profile_id
          AND t.name IS NOT DISTINCT FROM f.name AND t.year IS NOT DISTINCT FROM f.year
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_worked_menus', v_rows) END;
    UPDATE public.profile_worked_menus SET person_profile_id = p_into WHERE person_profile_id = p_from;

    -- Awards.
    WITH gone AS (
        DELETE FROM public.profile_awards f
        USING public.profile_awards t
        WHERE f.profile_id = p_from AND t.profile_id = p_into
          AND t.award = f.award AND t.year = f.year AND coalesce(t.title, '') = coalesce(f.title, '')
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_awards', v_rows) END;
    UPDATE public.profile_awards SET profile_id = p_into WHERE profile_id = p_from;

    -- Events they worked.
    UPDATE public.event_staff SET profile_id = p_into WHERE profile_id = p_from;

    -- What the page picked to show.
    WITH gone AS (
        DELETE FROM public.profile_picks f
        USING public.profile_picks t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.section = f.section AND t.target_id = f.target_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_picks', v_rows) END;
    UPDATE public.profile_picks SET profile_id = p_into WHERE profile_id = p_from;

    -- People who loved or hid the page.
    WITH gone AS (
        DELETE FROM public.loved_bars f USING public.loved_bars t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('loved_bars', v_rows) END;
    UPDATE public.loved_bars SET profile_id = p_into WHERE profile_id = p_from;
    WITH gone AS (
        DELETE FROM public.hidden_bars f USING public.hidden_bars t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('hidden_bars', v_rows) END;
    UPDATE public.hidden_bars SET profile_id = p_into WHERE profile_id = p_from;

    -- Who wants to go, and who had a drink there (drinks_had and want_list,
    -- section 6). The moves above already keep old builds' loved_bars, so
    -- the had and want sync stays out of it.
    PERFORM set_config('app.had_want_sync', 'on', true);
    WITH gone AS (
        DELETE FROM public.want_list f USING public.want_list t
        WHERE f.venue_profile_id = p_from AND t.venue_profile_id = p_into AND t.user_id = f.user_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('want_list', v_rows) END;
    UPDATE public.want_list SET venue_profile_id = p_into WHERE venue_profile_id = p_from;
    UPDATE public.drinks_had SET venue_profile_id = p_into WHERE venue_profile_id = p_from;
    PERFORM set_config('app.had_want_sync', 'off', true);

    -- Reports about the page.
    WITH gone AS (
        DELETE FROM public.reports f USING public.reports t
        WHERE f.profile_id = p_from AND t.profile_id = p_into AND f.status = 'open' AND t.status = 'open'
          AND t.reporter_id = f.reporter_id AND t.target_kind = f.target_kind
          AND t.item_id IS NOT DISTINCT FROM f.item_id AND t.release_id IS NOT DISTINCT FROM f.release_id
          AND t.comment_id IS NOT DISTINCT FROM f.comment_id AND t.photo_id IS NOT DISTINCT FROM f.photo_id
        RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('reports', v_rows) END;
    UPDATE public.reports SET profile_id = p_into WHERE profile_id = p_from;

    -- A hidden city waiting on the page: the claimant's own wins.
    INSERT INTO private.profile_hidden_places (profile_id, locality, city)
    SELECT p_into, h.locality, h.city FROM private.profile_hidden_places h WHERE h.profile_id = p_from
    ON CONFLICT (profile_id) DO NOTHING;
    WITH gone AS (
        DELETE FROM private.profile_hidden_places f WHERE f.profile_id = p_from RETURNING f.*
    ) SELECT jsonb_agg(to_jsonb(gone)) INTO v_rows FROM gone;
    v_dropped := v_dropped || CASE WHEN v_rows IS NULL THEN '{}' ELSE jsonb_build_object('profile_hidden_places', v_rows) END;

    -- Claims on the page, so the claimant still sees theirs.
    UPDATE public.profile_claims
    SET profile_id = p_into,
        evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object('merged_from', jsonb_build_object('id', p_from, 'handle', v_from.handle))
    WHERE profile_id = p_from;

    -- The page's words fill the claimant's blanks.
    UPDATE public.profiles SET
        bio = coalesce(nullif(btrim(bio), ''), v_from.bio),
        tagline = coalesce(nullif(btrim(tagline), ''), v_from.tagline),
        instagram = coalesce(nullif(btrim(instagram), ''), v_from.instagram),
        website = coalesce(nullif(btrim(website), ''), v_from.website),
        social_links = CASE WHEN coalesce(cardinality(social_links), 0) = 0 THEN v_from.social_links ELSE social_links END,
        headline_position_id = coalesce(headline_position_id, v_headline)
    WHERE id = p_into;

    -- Anything still pointing at the page stops the merge: nothing is lost.
    FOR v_ref IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = 'public.profiles'::regclass AND cardinality(c.conkey) = 1
    LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_ref.tbl, v_ref.col) INTO v_left USING p_from;
        IF v_left THEN
            RAISE EXCEPTION 'Can''t merge: %.% still points at the page. Nothing was changed.', v_ref.tbl, v_ref.col;
        END IF;
    END LOOP;

    INSERT INTO private.profile_merges (from_profile_id, into_profile_id, claim_id, merged_by, snapshot, dropped)
    VALUES (p_from, p_into, p_claim_id, p_reviewer, to_jsonb(v_from), v_dropped);
    DELETE FROM public.profiles WHERE id = p_from;

    SELECT * INTO v_into FROM public.profiles WHERE id = p_into;
    RETURN v_into;
END;
$function$;

-- --- 6. One had record and one Want list ---

-- Kevin's decisions had-want-one and keep-collection (1 Nov 2026): every time
-- someone had a drink is one row in drinks_had, whether they ranked it, made
-- it at home or only remembered it; everything they mean to get to (a drink
-- to make or try, a bar to go to) is one row in want_list. Whether a want is
-- done is read from drinks_had (a drink made or had, a bar been to), never
-- stored, as "To make minus made" and "loved minus been" are read today. A
-- ranking stays in rank_entries (its score, list and profile pick), and every
-- ranking writes a had. Collection folds in: had and ranked show in You, to
-- make in the Want list.
--   collected_items (a drink kept to make)  -> want_list, kind 'drink'
--   collected_items.had_on, note            -> drinks_had, source 'memory'
--   made_drinks (each make at home)         -> drinks_had, source 'made'
--   rank_entries (each ranking, its day)    -> drinks_had, source 'rank'
--   loved_bars not yet been to, not hidden  -> want_list, kind 'bar'
-- loved_bars stays, as following a bar (alerts, the week, Discover's loved
-- first); wanting to go is want_list. A collected release and a saved menu
-- stay where they are: neither is a drink or a bar.
--
-- Old builds keep writing the old tables until 2.0 is on every phone, so
-- triggers copy each write across, both ways. Each copy runs with
-- app.had_want_sync on (for this transaction only), so the copy it makes
-- isn't copied back, and writes only what differs, so a missed guard ends
-- after one round. The old fields drop in a later PR; until then
-- rank_entries.had_on is the last day of its hads, kept for old builds.
--
-- Nobody reads another person's hads or wants from these tables. A
-- profile's shown makes are read through get_profile_made, which applies
-- the profile's settings (had_mode, shows_dates, public, blocks, age), as
-- rankings are read through get_profile_drinks. made_drinks becomes the
-- owner's own in the same way.

-- --- The two tables ---

CREATE TABLE "public"."drinks_had" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "item_id" "uuid",
    "name" "text",
    "had_on" "date",
    "at_home" boolean NOT NULL,
    "venue_profile_id" "uuid",
    "bar_name" "text",
    "rank_entry_id" "uuid",
    "note" "text",
    "image_id" "uuid",
    "compared" "text",
    "swaps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "on_profile" boolean DEFAULT false NOT NULL,
    "source" "text" NOT NULL,
    "made_drink_id" "uuid",
    "collected_item_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drinks_had_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "drinks_had_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- The had outlives the drink, the bar and the ranking: name and bar_name keep them.
    CONSTRAINT "drinks_had_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL,
    CONSTRAINT "drinks_had_venue_profile_id_fkey" FOREIGN KEY ("venue_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    CONSTRAINT "drinks_had_rank_entry_id_fkey" FOREIGN KEY ("rank_entry_id") REFERENCES "public"."rank_entries"("id") ON DELETE SET NULL,
    CONSTRAINT "drinks_had_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE SET NULL,
    CONSTRAINT "drinks_had_made_drink_once" UNIQUE ("made_drink_id"),
    CONSTRAINT "drinks_had_collected_item_once" UNIQUE ("collected_item_id"),
    CONSTRAINT "drinks_had_source" CHECK ("source" = ANY (ARRAY['rank'::"text", 'made'::"text", 'memory'::"text"])),
    CONSTRAINT "drinks_had_compared" CHECK ("compared" = ANY (ARRAY['better'::"text", 'same'::"text", 'worse'::"text"])),
    CONSTRAINT "drinks_had_note_length" CHECK ("char_length"("note") <= 1000),
    CONSTRAINT "drinks_had_swaps" CHECK ("private"."valid_swaps"("swaps")),
    CONSTRAINT "drinks_had_home_or_bar" CHECK (NOT ("at_home" AND "venue_profile_id" IS NOT NULL)),
    CONSTRAINT "drinks_had_named" CHECK ("item_id" IS NOT NULL OR "name" IS NOT NULL),
    CONSTRAINT "drinks_had_made_at_home" CHECK ("source" <> 'made' OR ("at_home" AND "had_on" IS NOT NULL)),
    CONSTRAINT "drinks_had_home_details" CHECK ("at_home" OR ("compared" IS NULL AND "swaps" = '[]'::"jsonb")),
    -- Only a make shows on a profile as its own row, as today.
    CONSTRAINT "drinks_had_shown_make" CHECK (NOT "on_profile" OR "source" = 'made')
);

COMMENT ON TABLE "public"."drinks_had" IS
    'Each time someone had a drink: ranked it (source rank), made it at home (made) or remembered it (memory). Owner only; a profile''s shown makes are read through get_profile_made.';
COMMENT ON COLUMN "public"."drinks_had"."name" IS 'The drink as remembered when the had was saved; shown once the drink is gone or no longer readable.';
COMMENT ON COLUMN "public"."drinks_had"."had_on" IS 'The day they had it. Null: they don''t know.';
COMMENT ON COLUMN "public"."drinks_had"."at_home" IS 'Had at home (a make, or a ranking with no bar). False with no venue_profile_id: out, at a bar with no page here.';
COMMENT ON COLUMN "public"."drinks_had"."bar_name" IS 'Where they had it as remembered: the bar''s page name, or for a memory the drink''s own bar.';
COMMENT ON COLUMN "public"."drinks_had"."rank_entry_id" IS 'The ranking this had placed. The score lives there.';
COMMENT ON COLUMN "public"."drinks_had"."on_profile" IS 'A make shown on their profile as its own row ("Show on my profile").';
COMMENT ON COLUMN "public"."drinks_had"."made_drink_id" IS 'The made_drinks row this mirrors for old builds. Goes with made_drinks.';
COMMENT ON COLUMN "public"."drinks_had"."collected_item_id" IS 'The collected_items row whose date and note this holds for old builds. Goes with collected_items.';

CREATE INDEX "drinks_had_user_day_idx" ON "public"."drinks_had" USING "btree" ("user_id", "had_on" DESC);
CREATE INDEX "drinks_had_item_id_idx" ON "public"."drinks_had" USING "btree" ("item_id");
CREATE INDEX "drinks_had_venue_profile_id_idx" ON "public"."drinks_had" USING "btree" ("venue_profile_id");
CREATE INDEX "drinks_had_rank_entry_id_idx" ON "public"."drinks_had" USING "btree" ("rank_entry_id");
CREATE INDEX "drinks_had_image_id_idx" ON "public"."drinks_had" USING "btree" ("image_id");

CREATE TABLE "public"."want_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "kind" "text" NOT NULL,
    "item_id" "uuid",
    "release_id" "uuid",
    "venue_profile_id" "uuid",
    "name" "text",
    "bar_name" "text",
    "image_url" "text",
    "source" "text" DEFAULT 'save'::"text" NOT NULL,
    "wanted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "collected_item_id" "uuid",
    CONSTRAINT "want_list_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "want_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- A drink kept outlives the drink (name keeps it), as collected_items does.
    CONSTRAINT "want_list_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL,
    CONSTRAINT "want_list_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL,
    CONSTRAINT "want_list_venue_profile_id_fkey" FOREIGN KEY ("venue_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    -- Plain unique keys (not partial), so the app can insert with on_conflict and ignoreDuplicates.
    CONSTRAINT "want_list_drink_once" UNIQUE ("user_id", "item_id"),
    CONSTRAINT "want_list_bar_once" UNIQUE ("user_id", "venue_profile_id"),
    CONSTRAINT "want_list_collected_item_once" UNIQUE ("collected_item_id"),
    CONSTRAINT "want_list_kind" CHECK (
        ("kind" = 'drink' AND "venue_profile_id" IS NULL AND ("item_id" IS NOT NULL OR "name" IS NOT NULL))
        OR ("kind" = 'bar' AND "venue_profile_id" IS NOT NULL AND "item_id" IS NULL AND "release_id" IS NULL)),
    CONSTRAINT "want_list_source" CHECK ("source" = ANY (ARRAY['save'::"text", 'love'::"text", 'swipe'::"text", 'import'::"text"]))
);

COMMENT ON TABLE "public"."want_list" IS
    'Drinks and bars someone means to get to. Done is read from drinks_had (a drink had, a bar been to), never stored. Owner only.';
COMMENT ON COLUMN "public"."want_list"."name" IS 'A drink as remembered when kept (name, bar_name, image_url), shown once it is gone or no longer readable.';
COMMENT ON COLUMN "public"."want_list"."source" IS 'How it got here: save (kept it), love (an old build''s heart on a bar), swipe (the swipe deck), import (Google Maps saved places).';
COMMENT ON COLUMN "public"."want_list"."collected_item_id" IS 'The collected_items row this mirrors for old builds. Goes with collected_items.';

CREATE INDEX "want_list_item_id_idx" ON "public"."want_list" USING "btree" ("item_id");
CREATE INDEX "want_list_release_id_idx" ON "public"."want_list" USING "btree" ("release_id");
CREATE INDEX "want_list_venue_profile_id_idx" ON "public"."want_list" USING "btree" ("venue_profile_id");

-- --- Who reads and writes them ---
-- The owner only. A had is saved by the person for a drink they may read
-- (as made_drinks), with their own ranking, their own upload and a public
-- bar page; a ranking's had is written by the ranking itself (below), so a
-- person saves only makes and memories. A want is a drink they may read
-- (and, from a release, one the release holds), or a bar page they haven't
-- hidden, after the age check.

ALTER TABLE "public"."drinks_had" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drinks_had_select_own" ON "public"."drinks_had" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

CREATE POLICY "drinks_had_insert_own" ON "public"."drinks_had" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND "source" = ANY (ARRAY['made'::"text", 'memory'::"text"])
        AND (EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "drinks_had"."item_id" AND NOT "p"."is_reference")
             OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "drinks_had"."item_id"))
        AND ("rank_entry_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "drinks_had"."rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())))
        AND ("image_id" IS NULL OR "private"."is_my_drinks_upload"("image_id"))
        AND ("venue_profile_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."profiles" "v" WHERE "v"."id" = "drinks_had"."venue_profile_id" AND "v"."kind" = 'bar' AND "v"."is_public"))
    );

CREATE POLICY "drinks_had_update_own" ON "public"."drinks_had" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("rank_entry_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "drinks_had"."rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())))
        AND ("image_id" IS NULL OR "private"."is_my_drinks_upload"("image_id"))
    );

CREATE POLICY "drinks_had_delete_own" ON "public"."drinks_had" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."drinks_had" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, DELETE ON "public"."drinks_had" TO "authenticated";
GRANT INSERT ("item_id", "had_on", "at_home", "venue_profile_id", "rank_entry_id", "note", "image_id", "compared", "swaps", "on_profile", "source")
    ON "public"."drinks_had" TO "authenticated";
GRANT UPDATE ("had_on", "note", "image_id", "on_profile", "compared", "swaps", "rank_entry_id") ON "public"."drinks_had" TO "authenticated";
GRANT ALL ON "public"."drinks_had" TO "service_role";

ALTER TABLE "public"."want_list" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "want_list_select_own" ON "public"."want_list" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

CREATE POLICY "want_list_insert_own" ON "public"."want_list" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND CASE "kind"
            WHEN 'drink' THEN
                (EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "want_list"."item_id" AND NOT "p"."is_reference")
                 OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "want_list"."item_id"))
                AND ("release_id" IS NULL
                     OR EXISTS (SELECT 1 FROM "public"."release_items" "ri" WHERE "ri"."release_id" = "want_list"."release_id" AND "ri"."item_id" = "want_list"."item_id"))
            WHEN 'bar' THEN
                EXISTS (SELECT 1 FROM "public"."profiles" "v" WHERE "v"."id" = "want_list"."venue_profile_id" AND "v"."kind" = 'bar')
                AND NOT EXISTS (SELECT 1 FROM "public"."hidden_bars" "h" WHERE "h"."user_id" = (SELECT "auth"."uid"()) AND "h"."profile_id" = "want_list"."venue_profile_id")
        END
    );

CREATE POLICY "want_list_delete_own" ON "public"."want_list" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."want_list" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, DELETE ON "public"."want_list" TO "authenticated";
GRANT INSERT ("kind", "item_id", "release_id", "venue_profile_id", "source") ON "public"."want_list" TO "authenticated";
GRANT ALL ON "public"."want_list" TO "service_role";

-- --- What a new row remembers ---

-- A drink as remembered: its published name, else its own; the bar it comes
-- from; its picture. The lookup fill_collected_memory makes, so a want and
-- the Collection row it mirrors remember the same thing.
CREATE FUNCTION "private"."remembered_drink"("p_item_id" "uuid")
    RETURNS TABLE("name" "text", "bar_name" "text", "image_url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT COALESCE(p.name, i.name),
           COALESCE(CASE WHEN p.id IS NOT NULL THEN COALESCE(bp.display_name, b.name, cp.display_name) END, op.display_name),
           p.image_url
    FROM public.items i
    LEFT JOIN LATERAL (
        SELECT pi.id, pi.name, pi.image_url FROM public.published_items pi
        WHERE pi.id = i.id AND NOT pi.is_reference LIMIT 1
    ) p ON true
    LEFT JOIN public.bars b ON b.id = i.bar_id
    LEFT JOIN public.profiles bp ON bp.bar_id = i.bar_id AND bp.is_public
    LEFT JOIN public.profiles cp ON cp.user_id = i.created_by AND cp.is_public
    LEFT JOIN public.profiles op ON op.id = i.origin_bar_profile_id AND op.is_public
    WHERE i.id = p_item_id;
$$;

REVOKE ALL ON FUNCTION "private"."remembered_drink"("uuid") FROM PUBLIC, "anon", "authenticated";

-- A had's name, and where they had it: the bar's page when at a bar, the
-- drink's own bar for a memory out, nothing at home. What a person sends is
-- replaced. A copy from the old tables brings what they remembered.
CREATE FUNCTION "private"."fill_had_memory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_name text;
    v_bar text;
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' AND NEW.name IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT d.name, d.bar_name INTO v_name, v_bar FROM private.remembered_drink(NEW.item_id) d;
    NEW.name := COALESCE(v_name, NEW.name);
    NEW.bar_name := CASE
        WHEN NEW.venue_profile_id IS NOT NULL THEN (SELECT v.display_name FROM public.profiles v WHERE v.id = NEW.venue_profile_id)
        WHEN NOT NEW.at_home THEN v_bar
    END;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."fill_had_memory"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "fill_memory" BEFORE INSERT ON "public"."drinks_had"
    FOR EACH ROW EXECUTE FUNCTION "private"."fill_had_memory"();

-- A wanted drink's name, bar and picture, as a Collection row fills them.
CREATE FUNCTION "private"."fill_want_memory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.kind = 'bar' THEN
        NEW.name := NULL;
        NEW.bar_name := NULL;
        NEW.image_url := NULL;
        RETURN NEW;
    END IF;
    IF current_setting('app.had_want_sync', true) = 'on' AND NEW.name IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT d.name, d.bar_name, d.image_url INTO NEW.name, NEW.bar_name, NEW.image_url
    FROM private.remembered_drink(NEW.item_id) d;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."fill_want_memory"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "fill_memory" BEFORE INSERT ON "public"."want_list"
    FOR EACH ROW EXECUTE FUNCTION "private"."fill_want_memory"();

-- --- Limits and screening, as on made_drinks ---
-- 50 makes and memories a day, counted on the same lock as made_drinks. A
-- copy from the old tables was already counted (or is a ranking, which has
-- its own limit), so only what a person saves here is counted.
CREATE FUNCTION "private"."limit_drinks_had"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('made:' || NEW.user_id::text, 0));
    IF (SELECT count(*) FROM public.drinks_had h
         WHERE h.user_id = NEW.user_id AND h.source IN ('made', 'memory')
           AND h.created_at > now() - interval '1 day') >= 50 THEN
        RAISE EXCEPTION 'You''ve logged 50 drinks today. Try again tomorrow.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."limit_drinks_had"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "limit_drinks_had" BEFORE INSERT ON "public"."drinks_had"
    FOR EACH ROW
    WHEN (current_setting('app.had_want_sync', true) IS DISTINCT FROM 'on')
    EXECUTE FUNCTION "private"."limit_drinks_had"();

-- A shown make's note and swaps are screened (screen_made_text, as on
-- made_drinks). A copy from made_drinks was screened there.
CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "note", "swaps", "on_profile" ON "public"."drinks_had"
    FOR EACH ROW
    WHEN (current_setting('app.had_want_sync', true) IS DISTINCT FROM 'on')
    EXECUTE FUNCTION "private"."screen_made_text"();

-- --- Old builds write the old tables: copy to the new ones ---

-- A ranking is a had. A new ranking writes one; a re-rank on another day
-- (had_on moves on) is another visit and writes another. A ranking moved to
-- another drink or bar takes its hads with it. Deleting a ranking leaves its
-- hads (rank_entry_id clears).
CREATE FUNCTION "private"."rank_entry_to_had"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_new_day boolean := TG_OP = 'INSERT';
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'UPDATE' THEN
        v_new_day := NEW.had_on IS NOT NULL AND NEW.had_on IS DISTINCT FROM OLD.had_on;
        IF (NEW.item_id, NEW.venue_profile_id) IS DISTINCT FROM (OLD.item_id, OLD.venue_profile_id) THEN
            UPDATE public.drinks_had h
               SET item_id = NEW.item_id,
                   venue_profile_id = NEW.venue_profile_id,
                   at_home = NEW.venue_profile_id IS NULL,
                   bar_name = (SELECT v.display_name FROM public.profiles v WHERE v.id = NEW.venue_profile_id)
             WHERE h.rank_entry_id = NEW.id AND h.source = 'rank'
               AND (h.item_id, h.venue_profile_id) IS DISTINCT FROM (NEW.item_id, NEW.venue_profile_id);
        END IF;
    END IF;

    -- One had per ranking, day and place: a make at home that day already is it.
    IF v_new_day AND NOT EXISTS (
        SELECT 1 FROM public.drinks_had h
        WHERE h.rank_entry_id = NEW.id AND h.had_on IS NOT DISTINCT FROM NEW.had_on
          AND h.at_home = (NEW.venue_profile_id IS NULL)
    ) THEN
        INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, venue_profile_id, bar_name, rank_entry_id, source)
        SELECT NEW.user_id, NEW.item_id, i.name, NEW.had_on, NEW.venue_profile_id IS NULL, NEW.venue_profile_id, v.display_name, NEW.id, 'rank'
        FROM public.items i
        LEFT JOIN public.profiles v ON v.id = NEW.venue_profile_id
        WHERE i.id = NEW.item_id;
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."rank_entry_to_had"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_drinks_had" AFTER INSERT OR UPDATE OF "had_on", "item_id", "venue_profile_id" ON "public"."rank_entries"
    FOR EACH ROW EXECUTE FUNCTION "private"."rank_entry_to_had"();

-- A make is a had. An old build ranks the make at home first (had_on the
-- day it was made), then logs it: the make takes over the had that ranking
-- just wrote (if nothing was added to it), so one evening is one had.
-- Deleting a make deletes its had,
-- except that a had the ranking still dates stays as the ranking's, and a
-- had whose drink was deleted stays as a memory of it.
CREATE FUNCTION "private"."made_drink_to_had"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
    v_had public.drinks_had;
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'INSERT' THEN
        SELECT h.id INTO v_id FROM public.drinks_had h
        WHERE h.user_id = NEW.user_id AND h.rank_entry_id = NEW.rank_entry_id AND h.had_on = NEW.made_on
          AND h.source = 'rank' AND h.at_home AND h.made_drink_id IS NULL AND h.note IS NULL AND h.image_id IS NULL
        ORDER BY h.created_at DESC
        LIMIT 1;
        IF v_id IS NOT NULL THEN
            UPDATE public.drinks_had
               SET source = 'made', item_id = NEW.item_id, made_drink_id = NEW.id, note = NEW.note, image_id = NEW.image_id,
                   compared = NEW.compared, swaps = NEW.swaps, on_profile = NEW.on_profile
             WHERE id = v_id;
        ELSE
            INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, rank_entry_id, note, image_id,
                                           compared, swaps, on_profile, source, made_drink_id, created_at)
            SELECT NEW.user_id, NEW.item_id, i.name, NEW.made_on, true, NEW.rank_entry_id, NEW.note, NEW.image_id,
                   NEW.compared, NEW.swaps, NEW.on_profile, 'made', NEW.id, NEW.created_at
            FROM public.items i WHERE i.id = NEW.item_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.drinks_had h
           SET item_id = NEW.item_id, had_on = NEW.made_on, rank_entry_id = NEW.rank_entry_id, note = NEW.note,
               image_id = NEW.image_id, compared = NEW.compared, swaps = NEW.swaps, on_profile = NEW.on_profile
         WHERE h.made_drink_id = NEW.id
           AND (h.item_id, h.had_on, h.rank_entry_id, h.note, h.image_id, h.compared, h.swaps, h.on_profile)
               IS DISTINCT FROM (NEW.item_id, NEW.made_on, NEW.rank_entry_id, NEW.note, NEW.image_id, NEW.compared, NEW.swaps, NEW.on_profile);

    ELSE
        SELECT * INTO v_had FROM public.drinks_had WHERE made_drink_id = OLD.id;
        IF v_had.id IS NULL THEN
            NULL;
        ELSIF NOT EXISTS (SELECT 1 FROM public.items WHERE id = OLD.item_id) THEN
            UPDATE public.drinks_had SET made_drink_id = NULL WHERE id = v_had.id;
        ELSIF v_had.rank_entry_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.rank_entries e WHERE e.id = v_had.rank_entry_id AND e.had_on = v_had.had_on)
              AND NOT EXISTS (SELECT 1 FROM public.drinks_had o
                              WHERE o.rank_entry_id = v_had.rank_entry_id AND o.had_on = v_had.had_on AND o.id <> v_had.id) THEN
            UPDATE public.drinks_had
               SET source = 'rank', made_drink_id = NULL, note = NULL, image_id = NULL, compared = NULL,
                   swaps = '[]'::jsonb, on_profile = false
             WHERE id = v_had.id;
        ELSE
            DELETE FROM public.drinks_had WHERE id = v_had.id;
        END IF;
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."made_drink_to_had"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_drinks_had" AFTER INSERT OR UPDATE OR DELETE ON "public"."made_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."made_drink_to_had"();

-- A drink kept in Collection is a want; its date and note are a remembered
-- had. Removing it in an old build removes both, as that build promises
-- ("Your date and note go with it"), except when the row goes because its
-- drink was merged into another: the memory then moves with the merge.
CREATE FUNCTION "private"."collected_item_to_want"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.want_list WHERE collected_item_id = OLD.id;
        IF EXISTS (SELECT 1 FROM private.item_merges m WHERE m.from_id = OLD.item_id) THEN
            UPDATE public.drinks_had SET collected_item_id = NULL WHERE collected_item_id = OLD.id;
        ELSE
            DELETE FROM public.drinks_had WHERE collected_item_id = OLD.id;
        END IF;
    ELSE
        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.want_list (user_id, kind, item_id, release_id, name, bar_name, image_url, source, wanted_at, collected_item_id)
            VALUES (NEW.user_id, 'drink', NEW.item_id, NEW.release_id, NEW.name, NEW.bar_name, NEW.image_url, 'save', NEW.collected_at, NEW.id)
            ON CONFLICT ON CONSTRAINT want_list_drink_once DO UPDATE SET collected_item_id = EXCLUDED.collected_item_id
               WHERE want_list.collected_item_id IS NULL;
        END IF;
        IF NEW.had_on IS NULL AND NEW.note IS NULL THEN
            DELETE FROM public.drinks_had WHERE collected_item_id = NEW.id;
        ELSIF NEW.item_id IS NOT NULL OR NEW.name IS NOT NULL THEN
            INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, bar_name, note, source, collected_item_id)
            VALUES (NEW.user_id, NEW.item_id, NEW.name, NEW.had_on, false, NEW.bar_name, NEW.note, 'memory', NEW.id)
            ON CONFLICT ON CONSTRAINT drinks_had_collected_item_once DO UPDATE SET had_on = EXCLUDED.had_on, note = EXCLUDED.note
               WHERE (drinks_had.had_on, drinks_had.note) IS DISTINCT FROM (EXCLUDED.had_on, EXCLUDED.note);
        END IF;
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."collected_item_to_want"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_want_list" AFTER INSERT OR UPDATE OF "had_on", "note" OR DELETE ON "public"."collected_items"
    FOR EACH ROW EXECUTE FUNCTION "private"."collected_item_to_want"();

-- An old build's heart on a bar meant "want to go" until been: a bar loved
-- and not yet been to (no had there) or hidden is wanted. Unloving it, or
-- hiding it, takes the want away, as it leaves an old build's Want to go.
CREATE FUNCTION "private"."loved_bar_to_want"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'loved_bars' THEN
        INSERT INTO public.want_list (user_id, kind, venue_profile_id, source, wanted_at)
        SELECT NEW.user_id, 'bar', NEW.profile_id, 'love', NEW.loved_at
        WHERE NOT EXISTS (SELECT 1 FROM public.drinks_had h WHERE h.user_id = NEW.user_id AND h.venue_profile_id = NEW.profile_id)
          AND NOT EXISTS (SELECT 1 FROM public.hidden_bars x WHERE x.user_id = NEW.user_id AND x.profile_id = NEW.profile_id)
        ON CONFLICT ON CONSTRAINT want_list_bar_once DO NOTHING;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.want_list WHERE user_id = OLD.user_id AND kind = 'bar' AND venue_profile_id = OLD.profile_id;
    ELSE
        -- hidden_bars INSERT
        DELETE FROM public.want_list WHERE user_id = NEW.user_id AND kind = 'bar' AND venue_profile_id = NEW.profile_id;
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."loved_bar_to_want"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_want_list" AFTER INSERT OR DELETE ON "public"."loved_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."loved_bar_to_want"();

CREATE TRIGGER "sync_want_list" AFTER INSERT ON "public"."hidden_bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."loved_bar_to_want"();

-- --- The new app writes the new tables: copy back for old builds ---

-- A make saved here is logged in made_drinks too; when its ranking already
-- wrote a had for that day (the app ranks it first, as old builds do), the
-- make is that had. A change or delete of a make, or of a memory from
-- Collection, is copied back. And rank_entries.had_on, which old builds
-- show, moves on to the newest day a ranking was had.
CREATE FUNCTION "private"."had_to_old_tables"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'INSERT' THEN
        IF NEW.source = 'made' AND NEW.made_drink_id IS NULL AND NEW.item_id IS NOT NULL THEN
            INSERT INTO public.made_drinks (user_id, item_id, made_on, compared, swaps, note, rank_entry_id, image_id, on_profile, created_at)
            VALUES (NEW.user_id, NEW.item_id, NEW.had_on, NEW.compared, NEW.swaps, NEW.note, NEW.rank_entry_id, NEW.image_id, NEW.on_profile, NEW.created_at)
            RETURNING id INTO v_id;
            UPDATE public.drinks_had SET made_drink_id = v_id WHERE id = NEW.id;
            IF NEW.rank_entry_id IS NOT NULL THEN
                DELETE FROM public.drinks_had t
                WHERE t.user_id = NEW.user_id AND t.rank_entry_id = NEW.rank_entry_id AND t.had_on = NEW.had_on
                  AND t.source = 'rank' AND t.at_home AND t.id <> NEW.id AND t.note IS NULL AND t.image_id IS NULL;
            END IF;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.made_drink_id IS NOT NULL THEN
            UPDATE public.made_drinks m
               SET item_id = COALESCE(NEW.item_id, m.item_id), made_on = NEW.had_on, compared = NEW.compared, swaps = NEW.swaps,
                   note = NEW.note, rank_entry_id = NEW.rank_entry_id, image_id = NEW.image_id, on_profile = NEW.on_profile
             WHERE m.id = NEW.made_drink_id
               AND (m.item_id, m.made_on, m.compared, m.swaps, m.note, m.rank_entry_id, m.image_id, m.on_profile)
                   IS DISTINCT FROM (COALESCE(NEW.item_id, m.item_id), NEW.had_on, NEW.compared, NEW.swaps, NEW.note, NEW.rank_entry_id, NEW.image_id, NEW.on_profile);
        END IF;
        IF NEW.collected_item_id IS NOT NULL THEN
            UPDATE public.collected_items c SET had_on = NEW.had_on, note = NEW.note
             WHERE c.id = NEW.collected_item_id AND (c.had_on, c.note) IS DISTINCT FROM (NEW.had_on, NEW.note);
        END IF;

    ELSE
        IF OLD.made_drink_id IS NOT NULL THEN
            DELETE FROM public.made_drinks WHERE id = OLD.made_drink_id;
        END IF;
        IF OLD.collected_item_id IS NOT NULL THEN
            UPDATE public.collected_items SET had_on = NULL, note = NULL
             WHERE id = OLD.collected_item_id AND (had_on IS NOT NULL OR note IS NOT NULL);
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' AND NEW.rank_entry_id IS NOT NULL AND NEW.had_on IS NOT NULL THEN
        UPDATE public.rank_entries e SET had_on = NEW.had_on
         WHERE e.id = NEW.rank_entry_id AND (e.had_on IS NULL OR e.had_on < NEW.had_on);
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."had_to_old_tables"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_old_tables" AFTER INSERT OR UPDATE OR DELETE ON "public"."drinks_had"
    FOR EACH ROW EXECUTE FUNCTION "private"."had_to_old_tables"();

-- A drink wanted here is kept in Collection too, and removing it removes
-- that row; the memory of having had it stays in drinks_had (only old
-- builds lose sight of it). A bar wanted here is loved for old builds, with
-- alerts off so it adds no notifications; removing the want unloves it only
-- if it still has alerts off (a bar followed with alerts stays followed).
CREATE FUNCTION "private"."want_to_old_tables"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_id uuid;
BEGIN
    IF current_setting('app.had_want_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.had_want_sync', 'on', true);

    IF TG_OP = 'INSERT' THEN
        IF NEW.kind = 'drink' AND NEW.collected_item_id IS NULL AND NEW.item_id IS NOT NULL THEN
            INSERT INTO public.collected_items (user_id, item_id, release_id, collected_at)
            VALUES (NEW.user_id, NEW.item_id, NEW.release_id, NEW.wanted_at)
            ON CONFLICT ON CONSTRAINT collected_items_once DO NOTHING
            RETURNING id INTO v_id;
            IF v_id IS NULL THEN
                SELECT c.id INTO v_id FROM public.collected_items c WHERE c.user_id = NEW.user_id AND c.item_id = NEW.item_id;
            END IF;
            UPDATE public.want_list SET collected_item_id = v_id WHERE id = NEW.id;
        ELSIF NEW.kind = 'bar' THEN
            INSERT INTO public.loved_bars (user_id, profile_id, alerts, loved_at)
            VALUES (NEW.user_id, NEW.venue_profile_id, 'none', NEW.wanted_at)
            ON CONFLICT ON CONSTRAINT loved_bars_pkey DO NOTHING;
        END IF;
    ELSIF OLD.kind = 'drink' THEN
        IF OLD.collected_item_id IS NOT NULL THEN
            DELETE FROM public.collected_items WHERE id = OLD.collected_item_id;
            UPDATE public.drinks_had SET collected_item_id = NULL WHERE collected_item_id = OLD.collected_item_id;
        END IF;
    ELSE
        DELETE FROM public.loved_bars WHERE user_id = OLD.user_id AND profile_id = OLD.venue_profile_id AND alerts = 'none';
    END IF;

    PERFORM set_config('app.had_want_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."want_to_old_tables"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "sync_old_tables" AFTER INSERT OR DELETE ON "public"."want_list"
    FOR EACH ROW EXECUTE FUNCTION "private"."want_to_old_tables"();

-- --- Backfill ---
-- Idempotent: it adds only what is missing, so it also serves as a check
-- before the old tables drop (run it in a transaction you roll back; every
-- step should add 0). Runs with the copy guard on, so nothing it adds is
-- copied back, limited or screened again.
--   1. Every make is a had (made_drinks -> source 'made', 1:1).
--   2. Every ranking is a had on its had_on, unless a make at the same place
--      already records that day (rank_entries -> source 'rank').
--   3. A collected drink with a date or a note is a remembered had
--      (collected_items.had_on, note -> source 'memory'); it stays a want.
--   4. Every collected drink is a want (collected_items -> kind 'drink').
--   5. Every loved bar not yet been to (no had there) and not hidden is a
--      want (loved_bars -> kind 'bar', source 'love').
CREATE FUNCTION "private"."backfill_had_and_want"() RETURNS TABLE("step" "text", "added" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    n bigint;
BEGIN
    PERFORM set_config('app.had_want_sync', 'on', true);

    INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, rank_entry_id, note, image_id,
                                   compared, swaps, on_profile, source, made_drink_id, created_at)
    SELECT m.user_id, m.item_id, i.name, m.made_on, true, m.rank_entry_id, m.note, m.image_id,
           m.compared, m.swaps, m.on_profile, 'made', m.id, m.created_at
    FROM public.made_drinks m
    JOIN public.items i ON i.id = m.item_id
    WHERE NOT EXISTS (SELECT 1 FROM public.drinks_had h WHERE h.made_drink_id = m.id);
    GET DIAGNOSTICS n = ROW_COUNT;
    step := '1 made'; added := n; RETURN NEXT;

    INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, venue_profile_id, bar_name,
                                   rank_entry_id, source, created_at)
    SELECT e.user_id, e.item_id, i.name, e.had_on, e.venue_profile_id IS NULL, e.venue_profile_id, v.display_name,
           e.id, 'rank', e.created_at
    FROM public.rank_entries e
    JOIN public.items i ON i.id = e.item_id
    LEFT JOIN public.profiles v ON v.id = e.venue_profile_id
    WHERE NOT EXISTS (SELECT 1 FROM public.drinks_had h
                      WHERE h.rank_entry_id = e.id AND h.had_on IS NOT DISTINCT FROM e.had_on
                        AND h.at_home = (e.venue_profile_id IS NULL));
    GET DIAGNOSTICS n = ROW_COUNT;
    step := '2 rank'; added := n; RETURN NEXT;

    INSERT INTO public.drinks_had (user_id, item_id, name, had_on, at_home, bar_name, note, source,
                                   collected_item_id, created_at)
    SELECT c.user_id, c.item_id, COALESCE(c.name, i.name), c.had_on, false, c.bar_name, c.note, 'memory',
           c.id, c.collected_at
    FROM public.collected_items c
    LEFT JOIN public.items i ON i.id = c.item_id
    WHERE (c.had_on IS NOT NULL OR c.note IS NOT NULL)
      AND (c.item_id IS NOT NULL OR c.name IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.drinks_had h WHERE h.collected_item_id = c.id);
    GET DIAGNOSTICS n = ROW_COUNT;
    step := '3 memory'; added := n; RETURN NEXT;

    INSERT INTO public.want_list (user_id, kind, item_id, release_id, name, bar_name, image_url, source,
                                  wanted_at, collected_item_id)
    SELECT c.user_id, 'drink', c.item_id, c.release_id, COALESCE(c.name, i.name), c.bar_name, c.image_url, 'save',
           c.collected_at, c.id
    FROM public.collected_items c
    LEFT JOIN public.items i ON i.id = c.item_id
    WHERE (c.item_id IS NOT NULL OR c.name IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.want_list w WHERE w.collected_item_id = c.id)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    step := '4 want drink'; added := n; RETURN NEXT;

    INSERT INTO public.want_list (user_id, kind, venue_profile_id, source, wanted_at)
    SELECT l.user_id, 'bar', l.profile_id, 'love', l.loved_at
    FROM public.loved_bars l
    WHERE NOT EXISTS (SELECT 1 FROM public.drinks_had h WHERE h.user_id = l.user_id AND h.venue_profile_id = l.profile_id)
      AND NOT EXISTS (SELECT 1 FROM public.hidden_bars x WHERE x.user_id = l.user_id AND x.profile_id = l.profile_id)
      AND NOT EXISTS (SELECT 1 FROM public.want_list w WHERE w.user_id = l.user_id AND w.venue_profile_id = l.profile_id)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    step := '5 want bar'; added := n; RETURN NEXT;

    PERFORM set_config('app.had_want_sync', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION "private"."backfill_had_and_want"() FROM PUBLIC, "anon", "authenticated";

SELECT * FROM "private"."backfill_had_and_want"();

-- --- Shown makes are read through get_profile_made only ---
-- get_profile_made reads drinks_had, with the rules is_made_log_shown held
-- (a public, unmoderated person profile showing drinks had, age checked, no
-- block either way, a drink anyone may be told the name of) and the day only
-- when the profile shows dates. id stays the made_drinks id, which old builds
-- hide a make by; had_id is the new row's.
DROP POLICY "made_drinks_select_shared" ON "public"."made_drinks";
REVOKE ALL ON "public"."made_drinks" FROM "anon";

DROP FUNCTION "public"."get_profile_made"("uuid");

CREATE FUNCTION "public"."get_profile_made"("p_profile_id" "uuid")
    RETURNS TABLE("id" "uuid", "item_id" "uuid", "name" "text", "image_url" "text", "image_is_generated" boolean,
                  "photo_url" "text", "made_on" "date", "note" "text", "had_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(h.made_drink_id, h.id), h.item_id, i.name, img.url, img.is_generated, photo.url,
         CASE WHEN p.shows_dates THEN h.had_on END,
         h.note, h.id
  FROM public.profiles p
  JOIN public.drinks_had h ON h.user_id = p.user_id AND h.on_profile AND h.source = 'made'
  JOIN public.items i ON i.id = h.item_id
  LEFT JOIN public.images photo ON photo.id = h.image_id
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = i.id AND ii.angle = 'hero'
    ORDER BY ii.is_generated, ii.sort_order NULLS LAST, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE p.id = p_profile_id AND p.kind = 'person' AND p.user_id IS NOT NULL
    AND p.is_public AND p.moderated_at IS NULL AND p.had_mode <> 'none'
    AND p.user_id NOT IN (SELECT private.blocked_user_ids())
    AND EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = p.user_id AND a.confirmed_at IS NOT NULL)
    AND i.moderated_at IS NULL
    AND (
      (i.bar_id IS NULL AND i.created_by IS NULL)
      OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
    )
  ORDER BY h.had_on DESC, h.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION "public"."get_profile_made"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_profile_made"("uuid") TO "anon", "authenticated", "service_role";

-- Its rules now live in get_profile_made alone.
DROP FUNCTION "public"."is_made_log_shown"("uuid");

-- --- Left for the drop PR, safe until then ---
-- private.merge_item and private.remove_venue keep a picture a make still
-- uses by checking made_drinks: every make here has its made_drinks row, so
-- that still holds. merge_item only removes generated pictures, which no had
-- can use (a had's photo is always the person's own upload). A had's photo
-- on a ranking or a memory, which only the new app adds, could lose its
-- picture when remove_venue deletes the drink it's of; today the whole make
-- goes with that drink. Both learn drinks_had when made_drinks drops.
-- merge_item's own loops already move drinks_had.item_id, rank_entry_id and
-- want_list.item_id; a want both drinks had is kept in the merge record, as
-- collected_items is.
-- private.storage_paths_in_use keeps collected_items.image_url, the same
-- picture each wanted drink remembers, so want_list.image_url joins it when
-- collected_items drops.
-- private.merge_person_profile merges person pages only; drinks_had and
-- want_list point at bar pages only, so its check that nothing still points
-- at the page never meets them.
COMMENT ON COLUMN "public"."rank_entries"."had_on" IS
    'The last day this ranking was had, for old builds: kept from drinks_had by trigger. Drops with them; read drinks_had.';

-- --- 7. One glass and one ice record per drink ---

-- Kevin's decision glass-ice-one (1 Nov 2026): a drink's glass and its ice
-- each have one home. drink_glass holds the glass a drink is served in (the
-- shape, the real glass, how it's drawn) and drink_ice the ice (served over,
-- made with, the layers, grams per serve), one row per drink, with the same
-- column names they had on items:
--   items.glassware_id, glass_model_id, sketch_variant -> drink_glass
--   items.ice_id, method_ice_id, ice_build, ice_per_serve_g -> drink_ice
-- items.glass, items.ice_kind and item_ice stay where they are: they describe
-- the glass and ice items themselves (Kit), not a drink. The new rows check
-- what today's columns never did: a drink's glass is a glassware item, and
-- its ice, the ice it's made with and every layer of its build are ice
-- items. Old builds keep writing items; a trigger copies each change across,
-- and a write to the new tables is copied back to items as a real UPDATE of
-- those columns, so every drawing, redraw and job trigger on items fires
-- exactly as it does today. Drawings keep reading items (equal to the new
-- rows by trigger) until the drop PR moves them, so they read one place at
-- any time. The items columns drop once 2.0 is on every phone.

-- Refuse to start if a drink names the wrong kind of item as its glass or
-- ice: the new rows would refuse it, so it needs a person to look first.
-- A layer naming an item that no longer exists (an ice deleted, or merged
-- before merges rewrote layers) is copied as it is, as items holds it today:
-- the drawing already skips it.
DO $$
DECLARE
    v_glass integer;
    v_ice integer;
    v_gone integer;
BEGIN
    SELECT count(*) INTO v_glass
    FROM public.items d
    JOIN public.items g ON g.id = d.glassware_id
    WHERE g.item_type <> 'glassware';

    SELECT count(*) INTO v_ice
    FROM public.items d
    WHERE EXISTS (SELECT 1 FROM public.items x
                  WHERE x.id IN (d.ice_id, d.method_ice_id) AND x.item_type <> 'ice')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(d.ice_build) l
                  JOIN public.items x ON x.id = (l ->> 'ice')::uuid
                  WHERE x.item_type <> 'ice');

    IF v_glass + v_ice > 0 THEN
        RAISE EXCEPTION 'Glass and ice: % drinks name a glass that is not a glassware item and % name ice that is not an ice item. Fix them before this migration.', v_glass, v_ice
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) INTO v_gone
    FROM public.items d
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(d.ice_build) l
                  WHERE NOT EXISTS (SELECT 1 FROM public.items x WHERE x.id = (l ->> 'ice')::uuid));
    IF v_gone > 0 THEN
        RAISE NOTICE 'Glass and ice: % drinks have an ice layer naming an item that no longer exists; copied as they are.', v_gone;
    END IF;
END;
$$;

-- --- The two tables ---

CREATE TABLE "public"."drink_glass" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "glassware_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "glass_model_id" "uuid" REFERENCES "public"."glass_models"("id") ON DELETE SET NULL,
    "sketch_variant" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drink_glass_sketch_variant_check"
        CHECK ("sketch_variant" IS NULL OR "private"."valid_glass_variant"(split_part("sketch_variant", '_', 1), "sketch_variant"))
);

COMMENT ON TABLE "public"."drink_glass" IS
    'The glass a drink is served in, one row per drink. The type and size are the glassware item''s (items.glass, capacity_ml). Old builds write items.glassware_id, glass_model_id and sketch_variant; a trigger keeps both in step until those columns drop.';
COMMENT ON COLUMN "public"."drink_glass"."glassware_id" IS
    'The glass shape: a glassware item. Its items.glass is how drinks in it are drawn.';
COMMENT ON COLUMN "public"."drink_glass"."glass_model_id" IS
    'Cocktails: the real glass it''s served in. When set, glassware_id is its shape.';
COMMENT ON COLUMN "public"."drink_glass"."sketch_variant" IS
    'How the glass is drawn, ''<glass>_<name>'' such as ''nick_tulip''. Null is the real glass''s or the bar''s default.';

CREATE INDEX "drink_glass_glassware_id_idx" ON "public"."drink_glass" ("glassware_id") WHERE "glassware_id" IS NOT NULL;
CREATE INDEX "drink_glass_glass_model_id_idx" ON "public"."drink_glass" ("glass_model_id") WHERE "glass_model_id" IS NOT NULL;

CREATE TABLE "public"."drink_ice" (
    "item_id" "uuid" PRIMARY KEY REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "ice_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "method_ice_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL,
    "ice_build" "jsonb",
    "ice_per_serve_g" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drink_ice_ice_build_check" CHECK ("private"."valid_ice_build"("ice_build")),
    CONSTRAINT "drink_ice_ice_per_serve_g_check"
        CHECK ("ice_per_serve_g" IS NULL OR ("ice_per_serve_g" >= 0 AND "ice_per_serve_g" < 5000))
);

COMMENT ON TABLE "public"."drink_ice" IS
    'A drink''s ice, one row per drink. How an ice is drawn is the ice item''s (items.ice_kind, item_ice). Old builds write items.ice_id, method_ice_id, ice_build and ice_per_serve_g; a trigger keeps both in step until those columns drop.';
COMMENT ON COLUMN "public"."drink_ice"."ice_id" IS
    'The ice it''s served over: an ice item, and the top layer of ice_build when there is one.';
COMMENT ON COLUMN "public"."drink_ice"."method_ice_id" IS
    'The ice it''s made with (shaken with, blended with): an ice item.';
COMMENT ON COLUMN "public"."drink_ice"."ice_build" IS
    'How the ice sits in the glass, bottom layer first ([{"ice": id, "n": 4}, {"ice": id, "to": "mound"}]); each ice an ice item. Null is one plain ice.';
COMMENT ON COLUMN "public"."drink_ice"."ice_per_serve_g" IS
    'Grams of ice in the glass per serve, so an event''s prep list can add up the ice order.';

CREATE INDEX "drink_ice_ice_id_idx" ON "public"."drink_ice" ("ice_id") WHERE "ice_id" IS NOT NULL;
CREATE INDEX "drink_ice_method_ice_id_idx" ON "public"."drink_ice" ("method_ice_id") WHERE "method_ice_id" IS NOT NULL;
-- Which drinks build with an ice (its ids are in the JSON, not foreign keys).
CREATE INDEX "drink_ice_ice_build_idx" ON "public"."drink_ice" USING gin ("ice_build" jsonb_path_ops) WHERE "ice_build" IS NOT NULL;

-- The old homes, until they drop.
COMMENT ON COLUMN "public"."items"."glassware_id" IS 'Old home of drink_glass.glassware_id, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."glass_model_id" IS 'Old home of drink_glass.glass_model_id, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."sketch_variant" IS 'Old home of drink_glass.sketch_variant, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."ice_id" IS 'Old home of drink_ice.ice_id, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."method_ice_id" IS 'Old home of drink_ice.method_ice_id, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."ice_build" IS 'Old home of drink_ice.ice_build, kept in step by trigger for builds before 2.0. Drops then.';
COMMENT ON COLUMN "public"."items"."ice_per_serve_g" IS 'Old home of drink_ice.ice_per_serve_g, kept in step by trigger for builds before 2.0. Drops then.';

-- --- Who reads and writes them ---

-- As item_methods: whoever reads the drink reads its glass and ice (as they
-- read today's columns; glass and ice aren't under the spec lock), and
-- whoever may edit the drink writes them (private.can_edit_item is
-- items_update's rule). Signed-out readers keep going through
-- published_items. Nothing for anon.
ALTER TABLE "public"."drink_glass" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drink_glass_select" ON "public"."drink_glass" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "drink_glass"."item_id"));
CREATE POLICY "drink_glass_insert" ON "public"."drink_glass" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "drink_glass_update" ON "public"."drink_glass" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "drink_glass_delete" ON "public"."drink_glass" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

REVOKE ALL ON "public"."drink_glass" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."drink_glass" TO "authenticated";
GRANT ALL ON "public"."drink_glass" TO "service_role";

ALTER TABLE "public"."drink_ice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drink_ice_select" ON "public"."drink_ice" FOR SELECT TO "authenticated"
    USING (EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "drink_ice"."item_id"));
CREATE POLICY "drink_ice_insert" ON "public"."drink_ice" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "drink_ice_update" ON "public"."drink_ice" FOR UPDATE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"))
    WITH CHECK ("private"."can_edit_item"("item_id"));
CREATE POLICY "drink_ice_delete" ON "public"."drink_ice" FOR DELETE TO "authenticated"
    USING ("private"."can_edit_item"("item_id"));

REVOKE ALL ON "public"."drink_ice" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."drink_ice" TO "authenticated";
GRANT ALL ON "public"."drink_ice" TO "service_role";

-- --- Backfill ---

-- Every drink's glass and ice as items holds them now (local stack: 224
-- glass rows, no ice). Only the new tables are written, before any trigger
-- on them or on items exists, so nothing is redrawn and no image or sketch
-- job is queued; app.image_worker is set as other backfills set it.
SET "app.image_worker" = 'on';

INSERT INTO "public"."drink_glass" ("item_id", "glassware_id", "glass_model_id", "sketch_variant")
SELECT "id", "glassware_id", "glass_model_id", "sketch_variant"
FROM "public"."items"
WHERE num_nonnulls("glassware_id", "glass_model_id", "sketch_variant") > 0;

INSERT INTO "public"."drink_ice" ("item_id", "ice_id", "method_ice_id", "ice_build", "ice_per_serve_g")
SELECT "id", "ice_id", "method_ice_id", "ice_build", "ice_per_serve_g"
FROM "public"."items"
WHERE num_nonnulls("ice_id", "method_ice_id", "ice_build", "ice_per_serve_g") > 0;

RESET "app.image_worker";

-- --- Rules on the new rows ---

-- The glass: a real glass names its shape (as items_glass_model does on
-- items, so the copy back to items lands unchanged), only a cocktail is
-- served in a real glass, and the shape is a glassware item. Each is
-- checked when it's set or changed, so a row is never refused over
-- something it already held. A row stays with its drink.
CREATE FUNCTION "private"."drink_glass_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_shape uuid;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.item_id IS DISTINCT FROM OLD.item_id THEN
        RAISE EXCEPTION 'A drink''s glass stays with its drink.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.glass_model_id IS NOT NULL THEN
        SELECT m.shape_item_id INTO v_shape FROM public.glass_models m WHERE m.id = NEW.glass_model_id;
        IF TG_OP = 'INSERT' OR NEW.glass_model_id IS DISTINCT FROM OLD.glass_model_id THEN
            NEW.glassware_id := coalesce(v_shape, NEW.glassware_id);
            IF NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = NEW.item_id AND i.item_type = 'cocktail') THEN
                RAISE EXCEPTION 'Only a drink is served in a glass model.' USING ERRCODE = 'check_violation';
            END IF;
        ELSIF NEW.glassware_id IS DISTINCT FROM OLD.glassware_id AND NEW.glassware_id IS DISTINCT FROM v_shape THEN
            NEW.glass_model_id := NULL;
        END IF;
    END IF;
    IF NEW.glassware_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.glassware_id IS DISTINCT FROM OLD.glassware_id)
       AND NOT EXISTS (SELECT 1 FROM public.items g WHERE g.id = NEW.glassware_id AND g.item_type = 'glassware') THEN
        RAISE EXCEPTION 'A drink''s glass is a glassware item.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."drink_glass_rules"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "rules" BEFORE INSERT OR UPDATE ON "public"."drink_glass"
    FOR EACH ROW EXECUTE FUNCTION "private"."drink_glass_rules"();

-- The ice: ice_id stays the build's top layer (the same function items
-- uses, so both land alike; it runs first, by name), then every ice the row
-- newly names is an ice item. A build that fails its own check is left to
-- drink_ice_ice_build_check.
CREATE TRIGGER "keep_ice_top_layer" BEFORE INSERT OR UPDATE OF "ice_id", "ice_build" ON "public"."drink_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."keep_ice_top_layer"();

CREATE FUNCTION "private"."drink_ice_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_had uuid[] := '{}';
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.item_id IS DISTINCT FROM OLD.item_id THEN
            RAISE EXCEPTION 'A drink''s ice stays with its drink.' USING ERRCODE = 'check_violation';
        END IF;
        v_had := array_remove(ARRAY[OLD.ice_id, OLD.method_ice_id]
                 || ARRAY(SELECT (l ->> 'ice')::uuid
                          FROM jsonb_array_elements(CASE WHEN private.valid_ice_build(OLD.ice_build) THEN OLD.ice_build END) l), NULL);
    END IF;
    IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY[NEW.ice_id, NEW.method_ice_id]
                    || ARRAY(SELECT (l ->> 'ice')::uuid
                             FROM jsonb_array_elements(CASE WHEN private.valid_ice_build(NEW.ice_build) THEN NEW.ice_build END) l)) AS n(id)
        WHERE n.id IS NOT NULL
          AND n.id <> ALL (v_had)
          AND NOT EXISTS (SELECT 1 FROM public.items x WHERE x.id = n.id AND x.item_type = 'ice')
    ) THEN
        RAISE EXCEPTION 'A drink''s ice, the ice it''s made with and each layer of its build are ice items.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."drink_ice_rules"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "rules" BEFORE INSERT OR UPDATE ON "public"."drink_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."drink_ice_rules"();

-- --- Kept in step both ways until the items columns drop ---

-- Each copy runs with app.glass_ice_sync on (for this transaction only), so
-- the copy it makes isn't copied back; each writes only what differs, so a
-- missed guard ends after one round. The rules above run on every copy.

-- Old builds write items: copy a change to the new rows (an empty glass or
-- ice deletes its row). This runs after items' own BEFORE triggers, so it
-- copies the shape set from the real glass and the top layer as items keeps
-- them. UPDATE then INSERT, not an upsert: an upsert runs the INSERT rules
-- first, which would recheck what a row already holds.
CREATE FUNCTION "private"."items_to_drink_glass_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF current_setting('app.glass_ice_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('app.glass_ice_sync', 'on', true);

    IF TG_OP = 'INSERT'
       OR (OLD.glassware_id, OLD.glass_model_id, OLD.sketch_variant)
          IS DISTINCT FROM (NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant) THEN
        IF num_nonnulls(NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant) = 0 THEN
            DELETE FROM public.drink_glass WHERE item_id = NEW.id;
        ELSIF EXISTS (SELECT 1 FROM public.drink_glass WHERE item_id = NEW.id) THEN
            UPDATE public.drink_glass
               SET glassware_id = NEW.glassware_id, glass_model_id = NEW.glass_model_id, sketch_variant = NEW.sketch_variant
             WHERE item_id = NEW.id
               AND (glassware_id, glass_model_id, sketch_variant)
                   IS DISTINCT FROM (NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant);
        ELSE
            INSERT INTO public.drink_glass (item_id, glassware_id, glass_model_id, sketch_variant)
            VALUES (NEW.id, NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant);
        END IF;
    END IF;

    IF TG_OP = 'INSERT'
       OR (OLD.ice_id, OLD.method_ice_id, OLD.ice_build, OLD.ice_per_serve_g)
          IS DISTINCT FROM (NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g) THEN
        IF num_nonnulls(NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g) = 0 THEN
            DELETE FROM public.drink_ice WHERE item_id = NEW.id;
        ELSIF EXISTS (SELECT 1 FROM public.drink_ice WHERE item_id = NEW.id) THEN
            UPDATE public.drink_ice
               SET ice_id = NEW.ice_id, method_ice_id = NEW.method_ice_id, ice_build = NEW.ice_build, ice_per_serve_g = NEW.ice_per_serve_g
             WHERE item_id = NEW.id
               AND (ice_id, method_ice_id, ice_build, ice_per_serve_g)
                   IS DISTINCT FROM (NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g);
        ELSE
            INSERT INTO public.drink_ice (item_id, ice_id, method_ice_id, ice_build, ice_per_serve_g)
            VALUES (NEW.id, NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g);
        END IF;
    END IF;

    PERFORM set_config('app.glass_ice_sync', 'off', true);
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."items_to_drink_glass_ice"() FROM PUBLIC, "anon", "authenticated";

-- No "UPDATE OF" list: a change to these columns copies however it was made
-- (a SET, a foreign key's SET NULL, another trigger).
CREATE TRIGGER "drink_glass_ice_on_insert" AFTER INSERT ON "public"."items"
    FOR EACH ROW
    WHEN (num_nonnulls(NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant,
                       NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g) > 0)
    EXECUTE FUNCTION "private"."items_to_drink_glass_ice"();

CREATE TRIGGER "drink_glass_ice_on_update" AFTER UPDATE ON "public"."items"
    FOR EACH ROW
    WHEN ((OLD.glassware_id, OLD.glass_model_id, OLD.sketch_variant, OLD.ice_id, OLD.method_ice_id, OLD.ice_build, OLD.ice_per_serve_g)
          IS DISTINCT FROM (NEW.glassware_id, NEW.glass_model_id, NEW.sketch_variant, NEW.ice_id, NEW.method_ice_id, NEW.ice_build, NEW.ice_per_serve_g))
    EXECUTE FUNCTION "private"."items_to_drink_glass_ice"();

-- The new app writes the new rows: copy them back to items with an UPDATE
-- that sets only the columns that differ. A real SET of those columns is
-- what fires items' redraw and job triggers (refresh_sketch_variant,
-- refresh_ice_build, refresh_ice_look, queue_item_image_job_update,
-- queue_item_sketch_job), as an old build's save does; setting only what
-- changed queues nothing an old build's same edit wouldn't. The rules above
-- already made the row what items' own triggers will make it, so items
-- lands equal. A deleted row clears them; a drink being deleted has no
-- items row left to update.
CREATE FUNCTION "private"."drink_glass_to_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row public.drink_glass := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW END;
    v_item uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
    v_set text;
BEGIN
    IF current_setting('app.glass_ice_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    SELECT concat_ws(', ',
             CASE WHEN i.glassware_id IS DISTINCT FROM v_row.glassware_id THEN 'glassware_id = $2' END,
             CASE WHEN i.glass_model_id IS DISTINCT FROM v_row.glass_model_id THEN 'glass_model_id = $3' END,
             CASE WHEN i.sketch_variant IS DISTINCT FROM v_row.sketch_variant THEN 'sketch_variant = $4' END)
      INTO v_set
      FROM public.items i
     WHERE i.id = v_item;
    IF v_set <> '' THEN
        PERFORM set_config('app.glass_ice_sync', 'on', true);
        EXECUTE format('UPDATE public.items SET %s WHERE id = $1', v_set)
          USING v_item, v_row.glassware_id, v_row.glass_model_id, v_row.sketch_variant;
        PERFORM set_config('app.glass_ice_sync', 'off', true);
    END IF;
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."drink_glass_to_items"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "to_items" AFTER INSERT OR UPDATE OR DELETE ON "public"."drink_glass"
    FOR EACH ROW EXECUTE FUNCTION "private"."drink_glass_to_items"();

CREATE FUNCTION "private"."drink_ice_to_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row public.drink_ice := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW END;
    v_item uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
    v_set text;
BEGIN
    IF current_setting('app.glass_ice_sync', true) = 'on' THEN
        RETURN NULL;
    END IF;
    SELECT concat_ws(', ',
             CASE WHEN i.ice_id IS DISTINCT FROM v_row.ice_id THEN 'ice_id = $2' END,
             CASE WHEN i.method_ice_id IS DISTINCT FROM v_row.method_ice_id THEN 'method_ice_id = $3' END,
             CASE WHEN i.ice_build IS DISTINCT FROM v_row.ice_build THEN 'ice_build = $4' END,
             CASE WHEN i.ice_per_serve_g IS DISTINCT FROM v_row.ice_per_serve_g THEN 'ice_per_serve_g = $5' END)
      INTO v_set
      FROM public.items i
     WHERE i.id = v_item;
    IF v_set <> '' THEN
        PERFORM set_config('app.glass_ice_sync', 'on', true);
        EXECUTE format('UPDATE public.items SET %s WHERE id = $1', v_set)
          USING v_item, v_row.ice_id, v_row.method_ice_id, v_row.ice_build, v_row.ice_per_serve_g;
        PERFORM set_config('app.glass_ice_sync', 'off', true);
    END IF;
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."drink_ice_to_items"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "to_items" AFTER INSERT OR UPDATE OR DELETE ON "public"."drink_ice"
    FOR EACH ROW EXECUTE FUNCTION "private"."drink_ice_to_items"();

-- --- Merges ---

-- merge_item records each merge in private.item_merges before it moves
-- anything. Two things happen then, here rather than in merge_item so this
-- doesn't depend on which merge_item a later section defines:
--   * A drink merged away takes its glass and ice with it, as its items
--     columns did (the merge record's 'item' keeps them); the drink it went
--     into keeps its own. Without this, merge_item's foreign key loop would
--     hand the copy's glass to a drink that had none.
--   * An ice merged away: drinks that build with it build with the one it
--     went into. Layers hold ids without a foreign key, so merge_item never
--     moved them (keep_ice_top_layer fixed only the top layer).
-- ponytail: a trigger on the merge record; fold both into merge_item the
-- next time it's rewritten.
CREATE FUNCTION "private"."merge_glass_ice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    PERFORM set_config('app.glass_ice_sync', 'on', true);
    DELETE FROM public.drink_glass WHERE item_id = NEW.from_id;
    DELETE FROM public.drink_ice WHERE item_id = NEW.from_id;
    PERFORM set_config('app.glass_ice_sync', 'off', true);

    IF NEW.into_id IS NOT NULL THEN
        UPDATE public.drink_ice d
           SET ice_build = (SELECT jsonb_agg(CASE WHEN l.layer ->> 'ice' = NEW.from_id::text
                                                  THEN jsonb_set(l.layer, '{ice}', to_jsonb(NEW.into_id::text))
                                                  ELSE l.layer END ORDER BY l.ord)
                            FROM jsonb_array_elements(d.ice_build) WITH ORDINALITY AS l(layer, ord))
         WHERE d.ice_build @> jsonb_build_array(jsonb_build_object('ice', NEW.from_id::text));
    END IF;
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."merge_glass_ice"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "glass_ice" AFTER INSERT ON "private"."item_merges"
    FOR EACH ROW EXECUTE FUNCTION "private"."merge_glass_ice"();

-- --- The check ---

-- Every drink's glass and ice read the same from items and from the new
-- rows, or the migration stops.
DO $$
DECLARE
    v_glass integer;
    v_ice integer;
BEGIN
    SELECT count(*) INTO v_glass
    FROM public.items i
    LEFT JOIN public.drink_glass g ON g.item_id = i.id
    WHERE (i.glassware_id, i.glass_model_id, i.sketch_variant)
          IS DISTINCT FROM (g.glassware_id, g.glass_model_id, g.sketch_variant);

    SELECT count(*) INTO v_ice
    FROM public.items i
    LEFT JOIN public.drink_ice x ON x.item_id = i.id
    WHERE (i.ice_id, i.method_ice_id, i.ice_build, i.ice_per_serve_g)
          IS DISTINCT FROM (x.ice_id, x.method_ice_id, x.ice_build, x.ice_per_serve_g);

    IF v_glass + v_ice > 0 THEN
        RAISE EXCEPTION 'Glass and ice: % drinks'' glass and % drinks'' ice differ between items and the new tables.', v_glass, v_ice;
    END IF;
END;
$$;
