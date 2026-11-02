-- Garnish where only names show (lane D2, #1094's boards Decided-who-floor
-- and -guest: "Candied ginger    Garnish", "Goes out: rocks, ginger on the
-- rim"). A guest or the floor reads a spec's names with the amount and unit
-- masked, so the page can't tell the garnish line. This says whether a line
-- is a garnish to whoever may read its name, and nothing more:
--
--   1. app_recipe_presentation gains is_garnish (last column): true or
--      false wherever the line's name shows (catalog, names permission,
--      published spec), null where the name is hidden too. amount, unit,
--      preparation_notes and every other column are as 20261204300000
--      left them, so the masking is unchanged.
--   2. public_drink_ingredients (the locked and signed-out names list) gains
--      garnish. Its body is 20261024200000's; a new return column needs
--      DROP and CREATE, so its grants are set again as 20261015900000 set
--      them.
--
-- The garnish units are lib/batch.ts GARNISH_UNITS (lib/batch.check.ts keeps
-- this list equal). An egg counted "1 each" is left to the app, which reads
-- the name (lib/batch isGarnishLine).

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
    r.is_float,
        CASE
            WHEN c.bar_id IS NULL OR pm.names_open OR ps.id IS NOT NULL THEN lower(btrim(COALESCE(r.unit, ''::text))) = ANY (ARRAY['each'::text, 'pinch'::text, 'sprig'::text, 'leaf'::text, 'peel'::text, 'twist'::text, 'discard'::text, 'wheel'::text, 'slice'::text, 'cube'::text, 'wedge'::text, 'rim'::text, 'spray'::text, 'rinse'::text, 'float'::text, 'grated'::text])
            ELSE NULL::boolean
        END AS is_garnish
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

DROP FUNCTION IF EXISTS public.public_drink_ingredients(uuid[]);
CREATE FUNCTION public.public_drink_ingredients(p_item_ids uuid[])
RETURNS TABLE (item_id uuid, sort_order integer, name text, brand boolean, garnish boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT r.recipe_item_id, r.sort_order,
         COALESCE(pi.name, 'House ingredient'),
         COALESCE(pi.ingredient_role IS NOT DISTINCT FROM 'product', false),
         lower(btrim(COALESCE(r.unit, ''))) OPERATOR(pg_catalog.=) ANY (ARRAY['each', 'pinch', 'sprig', 'leaf', 'peel', 'twist', 'discard', 'wheel', 'slice', 'cube', 'wedge', 'rim', 'spray', 'rinse', 'float', 'grated'])
  FROM private.published_listing l
  JOIN public.recipes r ON r.recipe_item_id OPERATOR(pg_catalog.=) l.id
  LEFT JOIN public.items s ON s.id OPERATOR(pg_catalog.=) r.ingredient_item_id
  -- Named when shared, or published in its own right; otherwise a house line.
  LEFT JOIN public.items pi
    ON pi.id OPERATOR(pg_catalog.=) CASE
      WHEN l.bar_id IS NULL THEN r.ingredient_item_id
      ELSE COALESCE(r.parent_ingredient_id, s.generic_id, r.ingredient_item_id)
    END
   AND pi.moderated_at IS NULL
   AND ((pi.bar_id IS NULL AND pi.created_by IS NULL)
        OR EXISTS (SELECT 1 FROM private.published_listing pl WHERE pl.id OPERATOR(pg_catalog.=) pi.id))
  WHERE l.id OPERATOR(pg_catalog.=) ANY (p_item_ids[1:200])
    AND l.effective_mode OPERATOR(pg_catalog.<>) 'private'::public.item_publish_mode
    AND NOT l.page_locked
  ORDER BY r.recipe_item_id, r.sort_order, r.created_at;
$function$;
REVOKE ALL ON FUNCTION public.public_drink_ingredients(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.public_drink_ingredients(uuid[]) TO anon, authenticated;
