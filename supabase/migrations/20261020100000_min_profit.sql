-- The least a venue wants each drink to make, in money (jam 13 Oct, Kevin:
-- "what's your minimum margin you want to make on a drink"). A target GP
-- (bars.target_gp, 20261001150000) alone lets a cheap highball pass at 85%
-- while it makes almost nothing, so a venue can also set a floor in its own
-- currency: the profit after tax and ingredients, in minor units.
--
-- Costing and a drink's Cost and margin then flag drinks under either target
-- and suggest the menu price that clears both (lib/costing.ts). Same rules as
-- the other pricing settings: members read it with the bar, Admins change it
-- (bars_update), and it means nothing without bars.currency.

ALTER TABLE "public"."bars"
    ADD COLUMN "min_profit_minor" integer CHECK ("min_profit_minor" IS NULL OR "min_profit_minor" >= 0);

COMMENT ON COLUMN "public"."bars"."min_profit_minor" IS 'The least a drink should make after tax and ingredients, in minor units of bars.currency; null for no floor.';
