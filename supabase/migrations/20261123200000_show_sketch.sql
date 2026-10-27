-- Whether a drink's drawing still shows on its page once it has a photo
-- (Eddie's E26, board w2-wizard-finish, Kevin's call B on 26 Oct: a hero
-- photo replaces the drawing by default, with Keep it to keep both).
--
--   items.show_sketch   true: the drawing stays, last in the drink page's
--                       pictures, after the photos (every drink until now).
--                       false: the photos only. With no photo the drawing
--                       shows whatever this says, so deleting every photo
--                       brings it back.
--
-- The add wizard saves false for a new drink with a hero photo unless Keep it
-- was picked. Menus and tiles already lead with the hero photo, so only the
-- drink page reads it, through app_item_presentation (made again below with
-- the column added last). Who may set it: anyone items_update lets edit the
-- drink (can_write); no new policy.

ALTER TABLE "public"."items" ADD COLUMN "show_sketch" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "public"."items"."show_sketch" IS 'False: the drawing is left off the drink page while it has a photo (E26).';

-- As 20261113900000, plus show_sketch, added last so the view is replaced in place.
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
    COALESCE(c.price, (SELECT cd.price FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price,
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
    COALESCE(c.dilution_pct, (SELECT cd.dilution_pct FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS dilution_pct,
    COALESCE(c.serve_ml, (SELECT cd.serve_ml FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_ml,
    COALESCE(c.serve_abv, (SELECT cd.serve_abv FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id,
    c.ice_build,
    CASE
      WHEN c.bar_id IS NOT NULL OR c.created_by IS NOT NULL THEN c.picture
      WHEN c.item_type = 'ingredient' AND c.picture = 'photo' AND private.item_picture_url(c.id) IS NOT NULL THEN 'photo'::public.item_picture
      ELSE 'drawing'::public.item_picture
    END AS picture,
    CASE WHEN c.item_type = 'ingredient' THEN private.item_picture_url(c.id) END AS picture_url,
    c.show_sketch
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
     LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
     LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
     CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
  WHERE c.bar_id IS NULL
     OR private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                         CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
     OR (ub.user_id IS NOT NULL
         AND private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                              CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END));
