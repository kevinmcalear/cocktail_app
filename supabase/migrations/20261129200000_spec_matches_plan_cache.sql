-- spec_matches plans its queries once per connection instead of on every call.
--
-- After 20261126400000 the work itself is small (0.05 ms to find who can see
-- 20 drinks), but each call still spent about 25 ms planning: a SQL function
-- plans its query again on every call, and three of them sit under
-- rpc/spec_matches. private.visible_items alone takes about 17 ms to plan,
-- because public.published_items is a large view; private.spec_verdicts_seen
-- and private.spec_matches_seen add about 6 ms each.
--
-- As PL/pgSQL with RETURN QUERY, each keeps its plan for the life of the
-- connection: the first five calls plan as before, and from the sixth Postgres
-- reuses a generic plan. PostgREST keeps its connections open, so nearly every
-- request gets the cached plan.
--
-- The queries are copied unchanged from 20261126400000 (visible_items,
-- spec_verdicts_seen) and 20261011110000 (spec_matches_seen). Same
-- arguments, results, security and grants as before. "#variable_conflict
-- use_column" keeps the result column names (item_id, classic_id, ...) from
-- being read as PL/pgSQL variables inside the queries.

-- --- Who can see these drinks ---

CREATE OR REPLACE FUNCTION "private"."visible_items"("p_item_ids" "uuid"[]) RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
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
END;
$$;

-- --- The verdicts ---

CREATE OR REPLACE FUNCTION "private"."spec_verdicts_seen"("p_item_ids" "uuid"[], "p_notes" boolean DEFAULT false, "p_visible" boolean DEFAULT false)
RETURNS TABLE("item_id" "uuid", "classic_id" "uuid", "spec_match" "text", "spec_seen" boolean, "amounts_seen" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
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
END;
$$;

-- --- With what changed, named as the caller sees each line ---

CREATE OR REPLACE FUNCTION "private"."spec_matches_seen"("p_item_ids" "uuid"[])
RETURNS TABLE("item_id" "uuid", "classic_id" "uuid", "spec_match" "text", "notes" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT v.item_id, v.classic_id, v.spec_match,
         CASE WHEN NOT v.spec_seen OR v.spec_match NOT IN ('variation', 'riff') THEN '{}'::jsonb
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'swaps', (SELECT jsonb_agg(jsonb_build_object('to', d.name, 'from', e->>'from', 'base', (e->>'base')::boolean))
                            FROM jsonb_array_elements(m.diff->'swaps') e
                            JOIN public.app_recipe_presentation p ON p.id = (e->>'line')::uuid AND p.recipe_item_id = v.item_id
                            JOIN public.items d ON d.id = p.display_ingredient_id),
                'adds', (SELECT jsonb_agg(jsonb_build_object('name', d.name, 'house', (e->>'house')::boolean))
                           FROM jsonb_array_elements(m.diff->'adds') e
                           JOIN public.app_recipe_presentation p ON p.id = (e->>'line')::uuid AND p.recipe_item_id = v.item_id
                           JOIN public.items d ON d.id = p.display_ingredient_id),
                'drops', m.diff->'drops',
                'measures', CASE WHEN jsonb_array_length(coalesce(m.diff->'measures', '[]'::jsonb)) > 0 AND v.amounts_seen THEN true END))
         END
    FROM private.spec_verdicts_seen(p_item_ids, true, false) v
    JOIN private.item_spec_matches m ON m.item_id = v.item_id;
END;
$$;
