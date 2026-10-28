-- spec_matches reads only the drinks it is asked about, and checks who can
-- see them once per call instead of once per drink.
--
-- rpc/spec_matches was passing the 8 s statement timeout for authenticated
-- (500s in bursts when Discover asked for a screenful of verdicts at a time,
-- which then dragged other reads past it too). Two costs, measured in
-- production for 300 drinks:
--
-- 1. private.can_view_item ran once per drink, about 1.6 ms each (475 ms).
--    The check itself takes 0.2 ms; the rest is starting its plan, which
--    public.published_items makes large, again for every drink. Its rule now
--    lives in private.visible_items, which takes a list and starts once
--    (83 ms for the same 300, the same 299 rows). can_view_item asks it about
--    one drink, so the rule keeps one home and its callers (drink_allergens,
--    waiting_co_credits) behave as before.
-- 2. private.spec_verdicts_seen counted lines with "recipe_item_id IN (SELECT
--    item_id FROM looked)", which the planner can't push through
--    public.app_recipe_presentation: every call read all of recipes joined to
--    all of items, then kept the few it wanted (about 90 ms even for one
--    drink). As "= ANY (ARRAY(SELECT ...))" it is an index condition on
--    recipes (12 ms for 20 drinks).
--
-- Same arguments, results, security and grants as before.

-- --- Who can see these drinks: can_view_item's rule (20261101200000) over a list ---

CREATE FUNCTION "private"."visible_items"("p_item_ids" "uuid"[]) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.id
    FROM public.items c
    LEFT JOIN public.bars b ON b.id = c.bar_id
    LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM public.venue_roles vr WHERE vr.id = ub.venue_role_id AND vr.ends_at <= now())
    LEFT JOIN public.venue_roles vr ON vr.id = ub.venue_role_id
    LEFT JOIN public.venue_level_overrides lo ON ub.venue_role_id IS NULL AND lo.bar_id = ub.bar_id AND lo.base_level = ub.role_level
    CROSS JOIN LATERAL (SELECT public.effective_bar_role(ub.role_level) AS role) er
    WHERE c.id = ANY (p_item_ids)
      AND auth.uid() IS NOT NULL
      AND (
        (c.bar_id IS NULL
         AND (c.created_by IS NULL
              OR c.item_type NOT IN ('cocktail', 'beer', 'wine')
              OR c.created_by = auth.uid()
              OR private.is_app_admin()))
        OR (ub.user_id IS NOT NULL
            AND (private.cap_open('menu', er.role >= COALESCE(c.override_visibility_level, b.default_visibility_level),
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                  CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)
                 OR private.cap_open('edit_drinks', 'edit_drinks' = ANY (private.base_capabilities(er.role)),
                                     CASE WHEN er.role = ub.role_level THEN COALESCE(vr.granted, lo.granted) END,
                                     CASE WHEN er.role = ub.role_level THEN COALESCE(vr.revoked, lo.revoked) END)))
        OR EXISTS (SELECT 1 FROM public.published_items pi WHERE pi.id = c.id)
      );
$$;

REVOKE ALL ON FUNCTION "private"."visible_items"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."visible_items"("uuid"[]) TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "private"."can_view_item"("p_item_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM private.visible_items(ARRAY[p_item_id]));
$$;

-- --- The verdicts, as 20261011110000_spec_match.sql with both changes ---

CREATE OR REPLACE FUNCTION "private"."spec_verdicts_seen"("p_item_ids" "uuid"[], "p_notes" boolean DEFAULT false, "p_visible" boolean DEFAULT false)
RETURNS TABLE("item_id" "uuid", "classic_id" "uuid", "spec_match" "text", "spec_seen" boolean, "amounts_seen" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH found AS (
    SELECT m.*, coalesce(m.override, m.verdict) AS said
      FROM private.item_spec_matches m
     WHERE m.item_id = ANY (p_item_ids)
       AND (p_visible OR m.item_id IN (SELECT v FROM private.visible_items(p_item_ids) v))
  ), looked AS (
    -- Only a variation, a riff or a drink whose notes are wanted needs the
    -- masked spec: masking only ever turns a verdict into unlisted, so same
    -- and unlisted read the same whatever the caller sees.
    SELECT f.item_id FROM found f WHERE p_notes OR f.said = 'variation' OR f.override IS NOT NULL
  ), seen AS (
    -- What the caller can see of each spec, through the same masking as the
    -- drink page: every line, its ingredient, its amount. One grouped pass
    -- over each, not a lookup per drink.
    SELECT f.item_id,
           coalesce(rl.lines, 0) = coalesce(pl.shown, 0) AS spec_seen,
           coalesce(rl.amounts, 0) = coalesce(pl.amounts_shown, 0) AS amounts_seen
      FROM found f
      LEFT JOIN (
        SELECT x.recipe_item_id, count(*) FILTER (WHERE x.ingredient_item_id IS NOT NULL) AS lines,
               count(*) FILTER (WHERE x.amount IS NOT NULL) AS amounts
          FROM public.recipes x WHERE x.recipe_item_id = ANY (ARRAY(SELECT item_id FROM looked))
         GROUP BY x.recipe_item_id
      ) rl ON rl.recipe_item_id = f.item_id
      LEFT JOIN (
        SELECT p.recipe_item_id, count(*) FILTER (WHERE p.display_ingredient_id IS NOT NULL) AS shown,
               count(*) FILTER (WHERE p.amount IS NOT NULL) AS amounts_shown
          FROM public.app_recipe_presentation p WHERE p.recipe_item_id = ANY (ARRAY(SELECT item_id FROM looked))
         GROUP BY p.recipe_item_id
      ) pl ON pl.recipe_item_id = f.item_id
  )
  SELECT f.item_id, f.classic_id,
         CASE
           WHEN f.said = 'riff' THEN 'riff'
           WHEN f.override IS NOT NULL THEN f.override
           WHEN NOT s.spec_seen THEN 'unlisted'
           WHEN f.said = 'same' AND f.has_amounts AND NOT s.amounts_seen THEN 'unlisted'
           -- With amounts hidden, a change only in measures can't be told.
           WHEN f.said = 'variation' AND NOT s.amounts_seen AND NOT (f.diff ?| ARRAY['swaps', 'adds', 'drops']) THEN 'unlisted'
           ELSE f.said
         END,
         s.spec_seen, s.amounts_seen
    FROM found f JOIN seen s ON s.item_id = f.item_id;
$$;
