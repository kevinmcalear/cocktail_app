-- DRAFT. Local stack only until Kevin's OK.
--
-- Glass, ice and garnish details: small fields that make the drink maths,
-- the service spec and (later) costing more accurate.
--
--   items.capacity_ml        glassware: to the brim.
--   items.iced_capacity_ml   glassware: what the liquid fills once the ice is
--                            in, so the drink page can say "fits" or "over by
--                            12 ml".
--   items.ice_per_serve_g    cocktails: ice in the glass per serve, so an
--                            event's prep list can add up the ice order.
--
-- Garnishes are ingredients already; the prep card (item_prep, item_steps)
-- now opens for them too, so a candied peel gets a yield, steps and a place
-- on the prep list. Nothing new to guard: the columns ride on the items
-- policies, and glass and ice costs use item_costs like any bought item.

ALTER TABLE "public"."items"
    ADD COLUMN "capacity_ml" numeric CHECK ("capacity_ml" IS NULL OR ("capacity_ml" > 0 AND "capacity_ml" < 5000)),
    ADD COLUMN "iced_capacity_ml" numeric CHECK ("iced_capacity_ml" IS NULL OR ("iced_capacity_ml" > 0 AND "iced_capacity_ml" < 5000)),
    ADD COLUMN "ice_per_serve_g" numeric CHECK ("ice_per_serve_g" IS NULL OR ("ice_per_serve_g" >= 0 AND "ice_per_serve_g" < 5000)),
    ADD CONSTRAINT "items_iced_capacity_within_capacity"
        CHECK ("iced_capacity_ml" IS NULL OR "capacity_ml" IS NULL OR "iced_capacity_ml" <= "capacity_ml");

-- Same columns as 20261001130000, plus the glass and ice columns at the end.
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
    c.service_style,
    c.density_g_ml,
    c.dilution_pct,
    c.serve_ml,
    c.serve_abv,
    c.abv_source,
    c.capacity_ml,
    c.iced_capacity_ml,
    c.ice_per_serve_g
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
