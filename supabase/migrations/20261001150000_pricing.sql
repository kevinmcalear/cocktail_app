-- DRAFT. Local stack only until Kevin's OK.
--
-- Pricing settings and a numeric menu price, the first step of costing.
--
--   bars.tax_rate            VAT or sales tax, in percent.
--   bars.prices_include_tax  true where the menu price has the tax in it (UK,
--                            EU, Australia); false where it's added at the
--                            till (US). GP is always taken on the price
--                            without tax.
--   bars.target_gp           the gross profit the bar aims for, in percent.
--   items.price_minor        the menu price in minor units of the bar's
--                            currency (items.price stays text until every
--                            screen reads this one).
--
-- Pack prices go in item_costs and pack sizes in item_purchasing, which
-- exist already (20260926150300): costs only with the costs capability,
-- pack sizes with prep or costs, and nothing without a currency on the bar.
-- The settings are the bar's (Admin writes them); the price is as public as
-- the menu.

ALTER TABLE "public"."bars"
    ADD COLUMN "tax_rate" numeric DEFAULT 0 NOT NULL CHECK ("tax_rate" >= 0 AND "tax_rate" <= 100),
    ADD COLUMN "prices_include_tax" boolean DEFAULT true NOT NULL,
    ADD COLUMN "target_gp" numeric CHECK ("target_gp" IS NULL OR ("target_gp" >= 0 AND "target_gp" < 100));

ALTER TABLE "public"."items" ADD COLUMN "price_minor" integer CHECK ("price_minor" IS NULL OR "price_minor" >= 0);

-- Prices typed as plain numbers so far ("12", "12.50") carry over.
UPDATE "public"."items"
   SET "price_minor" = round(btrim("price")::numeric * 100)
 WHERE "price" ~ '^\s*[0-9]+(\.[0-9]{1,2})?\s*$' AND "item_type" IN ('cocktail', 'beer', 'wine');

-- Same columns as 20261001140000, plus price_minor at the end.
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
