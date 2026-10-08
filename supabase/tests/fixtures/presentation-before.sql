-- The definitions 20261008310000_presentation_rls_speed.sql replaced, as they
-- were on main at ad14593 (pg_dump of the local stack), loaded as session temp
-- views so presentation-speed.test.mjs can compare old and new answers for the
-- same reader. old_visible_items is the old items_select policy as a filter.
-- Not a migration: only that test reads this file.

CREATE TEMP VIEW old_published_items WITH (security_invoker='false') AS
 WITH blocked AS (
         SELECT b.blocked_id AS user_id
           FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid())
        UNION
         SELECT b.blocker_id
           FROM public.user_blocks b
          WHERE (b.blocked_id = auth.uid())
        ), listed AS (
         SELECT i.id,
            i.name,
            i.item_type,
            i.description,
            i.created_at,
            i.glassware_id,
            i.family_id,
            i.ice_id,
            i.notes,
            i.origin,
            i.price,
            i.status,
            i.brand_maker,
            i.abv,
            i.bar_id,
            i.override_visibility_level,
            i.override_generic_ingredient_level,
            i.override_specific_brand_level,
            i.override_measurement_level,
            i.override_prep_level,
            i.icon_key,
            i.icon_url,
            i.hide_from_search,
            i.created_by,
            i.riff_of_id,
            i.creator_profile_id,
            i.origin_bar_profile_id,
            i.origin_year,
            i.credit_status,
            i.is_catalog,
            i.moderated_at,
            i.publish_mode,
            i.published_at,
            i.generic_id,
            i.service_style,
            i.density_g_ml,
            i.dilution_pct,
            i.serve_ml,
            i.serve_abv,
            i.abv_source,
            i.capacity_ml,
            i.iced_capacity_ml,
            i.ice_per_serve_g,
            i.price_minor,
            i.sketch_variant,
                CASE
                    WHEN ((eff.mode = 'spec'::public.item_publish_mode) AND (pg.page <> 'open'::public.bar_page_visibility)) THEN 'description'::public.item_publish_mode
                    ELSE eff.mode
                END AS effective_mode,
            (pg.page = 'locked'::public.bar_page_visibility) AS page_locked
           FROM (((public.items i
             LEFT JOIN public.bars bar ON ((bar.id = i.bar_id)))
             CROSS JOIN LATERAL ( SELECT COALESCE(i.publish_mode, ( SELECT max(m.publish_mode) AS max
                           FROM (public.menu_drinks md
                             JOIN public.menus m ON ((m.id = md.menu_id)))
                          WHERE ((md.item_id = i.id) AND (m.bar_id = i.bar_id) AND (m.publish_mode IS NOT NULL))), bar.default_publish_mode, 'private'::public.item_publish_mode) AS mode) eff)
             CROSS JOIN LATERAL ( SELECT
                        CASE
                            WHEN i.is_catalog THEN 'open'::public.bar_page_visibility
                            WHEN (i.bar_id IS NOT NULL) THEN bar.page_visibility
                            WHEN ((i.origin_bar_profile_id IS NOT NULL) AND (i.created_by IS NULL)) THEN COALESCE(( SELECT ob.page_visibility
                               FROM (public.profiles op
                                 JOIN public.bars ob ON ((ob.id = op.bar_id)))
                              WHERE (op.id = i.origin_bar_profile_id)), 'description'::public.bar_page_visibility)
                            ELSE 'open'::public.bar_page_visibility
                        END AS page) pg)
          WHERE ((eff.mode <> 'private'::public.item_publish_mode) AND (i.moderated_at IS NULL) AND
                CASE
                    WHEN (i.bar_id IS NOT NULL) THEN (EXISTS ( SELECT 1
                       FROM public.profiles p
                      WHERE ((p.bar_id = i.bar_id) AND p.is_public AND (p.moderated_at IS NULL))))
                    WHEN (i.created_by IS NOT NULL) THEN ((EXISTS ( SELECT 1
                       FROM public.profiles p
                      WHERE ((p.user_id = i.created_by) AND p.is_public AND (p.moderated_at IS NULL)))) AND (NOT (i.created_by IN ( SELECT blocked.user_id
                       FROM blocked))))
                    ELSE true
                END)
        ), referenced AS (
         SELECT x.id
           FROM (listed l
             CROSS JOIN LATERAL ( VALUES (l.glassware_id), (l.ice_id), (l.family_id)) x(id))
          WHERE (x.id IS NOT NULL)
        UNION
         SELECT m.method_item_id
           FROM (public.item_methods m
             JOIN listed l ON ((l.id = m.item_id)))
        UNION
         SELECT COALESCE(r.parent_ingredient_id, r.ingredient_item_id) AS "coalesce"
           FROM (public.recipes r
             JOIN listed l ON ((l.id = r.recipe_item_id)))
          WHERE ((l.effective_mode = 'spec'::public.item_publish_mode) AND (COALESCE(r.parent_ingredient_id, r.ingredient_item_id) IS NOT NULL))
        ), rows AS (
         SELECT l.id,
            l.name,
            l.item_type,
                CASE
                    WHEN l.page_locked THEN NULL::text
                    ELSE l.description
                END AS description,
            l.bar_id,
            l.glassware_id,
            l.ice_id,
            l.family_id,
            l.origin,
            l.abv,
            l.icon_key,
            l.icon_url,
            l.effective_mode AS publish_mode,
            l.published_at,
            l.riff_of_id,
                CASE
                    WHEN l.page_locked THEN NULL::uuid
                    ELSE l.creator_profile_id
                END AS creator_profile_id,
            l.origin_bar_profile_id,
            l.origin_year,
            l.credit_status,
            false AS is_reference,
            l.page_locked
           FROM listed l
        UNION ALL
         SELECT i.id,
            i.name,
            i.item_type,
            NULL::text,
            NULL::uuid,
            NULL::uuid,
            NULL::uuid,
            NULL::uuid,
            NULL::text,
            NULL::numeric,
            i.icon_key,
            i.icon_url,
            'private'::public.item_publish_mode AS item_publish_mode,
            NULL::timestamp with time zone,
            NULL::uuid,
            NULL::uuid,
            NULL::uuid,
            NULL::smallint,
            NULL::public.credit_status,
            true,
            false
           FROM public.items i
          WHERE ((i.id IN ( SELECT referenced.id
                   FROM referenced)) AND (NOT (i.id IN ( SELECT listed.id
                   FROM listed))))
        )
 SELECT rows.id,
    rows.name,
    rows.item_type,
    rows.description,
    rows.bar_id,
    rows.glassware_id,
    rows.ice_id,
    rows.family_id,
    rows.origin,
    rows.abv,
    rows.icon_key,
    rows.icon_url,
    rows.publish_mode,
    rows.published_at,
    rows.riff_of_id,
    rows.creator_profile_id,
    rows.origin_bar_profile_id,
    rows.origin_year,
    rows.credit_status,
    rows.is_reference,
        CASE
            WHEN rows.page_locked THEN NULL::text
            ELSE img.url
        END AS image_url,
        CASE
            WHEN rows.page_locked THEN NULL::boolean
            ELSE img.is_generated
        END AS image_is_generated
   FROM (rows
     LEFT JOIN LATERAL ( SELECT im.url,
            ii.is_generated
           FROM (public.item_images ii
             JOIN public.images im ON ((im.id = ii.image_id)))
          WHERE (ii.item_id = rows.id)
          ORDER BY (ii.angle = 'hero'::public.image_angle) DESC, ii.sort_order, ii.created_at
         LIMIT 1) img ON (true));

CREATE TEMP VIEW old_app_recipe_presentation WITH (security_invoker='false') AS
 SELECT r.id,
    r.created_at,
    r.recipe_item_id,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.ingredient_item_id
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level))) THEN r.ingredient_item_id
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_generic_ingredient_level, b.default_generic_ingredient_level))) THEN COALESCE(COALESCE(r.parent_ingredient_id, s.generic_id), r.ingredient_item_id)
            WHEN (ps.id IS NOT NULL) THEN COALESCE(COALESCE(r.parent_ingredient_id, s.generic_id), r.ingredient_item_id)
            ELSE NULL::uuid
        END AS display_ingredient_id,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.amount
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_measurement_level, b.default_measurement_level))) THEN r.amount
            WHEN (ps.id IS NOT NULL) THEN r.amount
            ELSE NULL::numeric
        END AS amount,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.unit
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_measurement_level, b.default_measurement_level))) THEN r.unit
            WHEN (ps.id IS NOT NULL) THEN r.unit
            ELSE NULL::text
        END AS unit,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.preparation_notes
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_prep_level, b.default_prep_level))) THEN r.preparation_notes
            ELSE NULL::text
        END AS preparation_notes,
    r.is_optional,
        CASE
            WHEN (c.bar_id IS NULL) THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level))) THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_generic_ingredient_level, b.default_generic_ingredient_level))) THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            WHEN (ps.id IS NOT NULL) THEN COALESCE(r.parent_ingredient_id, s.generic_id)
            ELSE NULL::uuid
        END AS parent_ingredient_id,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.ingredient_item_id
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_specific_brand_level, b.default_specific_brand_level))) THEN r.ingredient_item_id
            ELSE NULL::uuid
        END AS ingredient_item_id,
    r.sort_order,
        CASE
            WHEN (c.bar_id IS NULL) THEN r.at_service
            WHEN ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_measurement_level, b.default_measurement_level))) THEN r.at_service
            WHEN (ps.id IS NOT NULL) THEN r.at_service
            ELSE NULL::boolean
        END AS at_service
   FROM (((((((public.recipes r
     JOIN public.items c ON ((r.recipe_item_id = c.id)))
     LEFT JOIN public.items s ON ((s.id = r.ingredient_item_id)))
     LEFT JOIN public.bars b ON ((c.bar_id = b.id)))
     LEFT JOIN public.user_bars ub ON (((ub.bar_id = c.bar_id) AND (ub.user_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
           FROM public.venue_roles vr
          WHERE ((vr.id = ub.venue_role_id) AND (vr.ends_at <= now()))))))))
     LEFT JOIN ( SELECT pi.id
           FROM pg_temp.old_published_items pi
          WHERE ((pi.publish_mode = 'spec'::public.item_publish_mode) AND (NOT pi.is_reference))) ps ON ((ps.id = c.id)))
     LEFT JOIN public.profiles op ON (((op.id = c.origin_bar_profile_id) AND (c.bar_id IS NULL) AND (NOT c.is_catalog) AND (c.created_by IS NULL))))
     LEFT JOIN public.bars ob ON ((ob.id = op.bar_id)))
  WHERE (((auth.uid() IS NOT NULL) AND (((c.bar_id IS NULL) AND ((c.created_by IS NULL) OR (c.item_type <> ALL (ARRAY['cocktail'::public.entity_type, 'beer'::public.entity_type, 'wine'::public.entity_type])) OR (c.created_by = auth.uid()) OR (EXISTS ( SELECT 1
           FROM private.app_admins aa
          WHERE (aa.user_id = auth.uid())))) AND ((op.id IS NULL) OR (COALESCE(ob.page_visibility, 'description'::public.bar_page_visibility) = 'open'::public.bar_page_visibility) OR (EXISTS ( SELECT 1
           FROM private.app_admins aa
          WHERE (aa.user_id = auth.uid()))) OR (EXISTS ( SELECT 1
           FROM public.user_bars tb
          WHERE ((tb.bar_id = ob.id) AND (tb.user_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
                   FROM public.venue_roles vr
                  WHERE ((vr.id = tb.venue_role_id) AND (vr.ends_at <= now())))))))))) OR ((ub.user_id IS NOT NULL) AND (public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level))))) OR (ps.id IS NOT NULL));

CREATE TEMP VIEW old_visible_items WITH (security_invoker='false') AS
 SELECT items.id
   FROM public.items
  WHERE
CASE
    WHEN (bar_id IS NOT NULL) THEN private.can_view_bar_item(bar_id, override_visibility_level)
    WHEN ((created_by IS NULL) OR (item_type <> ALL (ARRAY['cocktail'::public.entity_type, 'beer'::public.entity_type, 'wine'::public.entity_type]))) THEN true
    ELSE ((created_by = ( SELECT auth.uid() AS uid)) OR private.is_app_admin() OR ((publish_mode = ANY (ARRAY['description'::public.item_publish_mode, 'spec'::public.item_publish_mode])) AND (moderated_at IS NULL) AND (NOT (created_by IN ( SELECT private.blocked_user_ids() AS blocked_user_ids))) AND (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.user_id = items.created_by) AND p.is_public AND (p.moderated_at IS NULL))))))
END;

GRANT SELECT ON old_published_items, old_app_recipe_presentation, old_visible_items TO anon, authenticated;
