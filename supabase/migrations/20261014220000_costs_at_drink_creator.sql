-- DRAFT. Local stack only until Kevin's OK (decision b48, 10 Oct 2026).
--
-- Cost and margin opens at Drink Creator (35) by default, not only Admin:
-- the people who build drinks and menus price them too. Only the default
-- matrix changes (private.base_capabilities, from 20260926150100). 'costs'
-- stays overridable, so a venue can still revoke it from a Drink Creator
-- role, and roles that already granted it keep it.
--
-- What follows from it, through the existing policies: item_costs (pack
-- prices), drink_cost(), menu costing and the Library's "Needs a price" all
-- open at 35. Nothing else moves.

CREATE OR REPLACE FUNCTION "private"."base_capabilities"("p_level" integer) RETURNS "public"."venue_capability"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT (CASE
    WHEN p_level >= 40 THEN enum_range(NULL::public.venue_capability)::text[]
    WHEN p_level >= 35 THEN '{menu,talking_points,locations,specs,photos,house_made,costs,edit_drinks,prep,menus}'
    WHEN p_level >= 30 THEN '{menu,talking_points,locations,specs,photos}'
    WHEN p_level >= 20 THEN '{menu,talking_points,locations}'
    WHEN p_level >= 10 THEN '{menu}'
    ELSE '{}'
  END)::public.venue_capability[];
$$;
