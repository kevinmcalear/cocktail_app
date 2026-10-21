-- Two ices on a drink (Ian at Bar Snack, Eddie call 16 Oct 2026; board
-- create-eddie-oct16, approved by Kevin 20 Oct): blended with pebble ice,
-- served over a large cube. items.ice_id stays the ice it's served over;
-- method_ice_id is the ice it's made with (shaken with, stirred over,
-- blended with). Nullable, so every drink today reads as before.

ALTER TABLE "public"."items"
    ADD COLUMN "method_ice_id" "uuid" REFERENCES "public"."items"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."items"."method_ice_id" IS
    'Cocktails: the ice it''s made with (shaken with, blended with). ice_id is the ice it''s served over.';

CREATE INDEX "items_method_ice_id_idx" ON "public"."items" ("method_ice_id") WHERE "method_ice_id" IS NOT NULL;

-- As 20261010100000_bar_page_direct_reads.sql, with method_ice_id at the end.
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
    COALESCE(c.price_minor, (SELECT cd.price_minor FROM public.credited_drink_details cd WHERE cd.item_id = c.id)) AS price_minor,
    c.is_core,
    c.ingredient_role,
    c.made_from_id,
    c.method_ice_id
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
