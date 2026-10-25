-- "Did you mean" for makers too (whole-app canvas, Search page, "Did you
-- mean, everywhere", row 2: pickers): public.search_near now returns maker
-- pages when p_kinds asks for 'maker', as it does people, everywhere and
-- by name alone. The maker pickers (a bottle's maker, a glass's maker, a
-- run sheet's brand) ask for them; nothing else changes.
--
--   * private.near_candidates already finds any public profile kind it is
--     asked for; only search_near's profile filter left makers out.
--   * Same signature and grants, so the app's types don't change.

CREATE OR REPLACE FUNCTION "public"."search_near"(
    "p_query" "text",
    "p_kinds" "text"[] DEFAULT ARRAY['drink', 'bar', 'person'],
    "p_latitude" double precision DEFAULT NULL,
    "p_longitude" double precision DEFAULT NULL,
    "p_radius_km" double precision DEFAULT 10,
    "p_country_code" "text" DEFAULT NULL,
    "p_city" "text" DEFAULT NULL,
    "p_limit" integer DEFAULT 8
)
RETURNS TABLE(
    "kind" "text",
    "id" "uuid",
    "name" "text",
    -- A drink's bar and its neighbourhood; a bar's, a person's or a maker's city.
    "place" "text",
    -- Where a bar or a person's page is: their handle (the app falls back to the id).
    "handle" "text",
    "score" integer,
    "known" boolean
)
    LANGUAGE "plpgsql" STABLE SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
-- plpgsql keeps a plan per connection after its first few calls: planning
-- this query (RLS on items and profiles) costs more than running it.
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH typed AS (
    SELECT private.discover_fold_ws(p_query) AS t,
           ARRAY(SELECT w FROM regexp_split_to_table(private.discover_fold_ws(p_query), '\s+') w WHERE w <> '') AS words
  ),
  area AS MATERIALIZED (
    SELECT a.id
    FROM private.near_area_bars(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a(id)
    WHERE ('drink' = ANY (p_kinds) OR 'bar' = ANY (p_kinds))
      AND NOT EXISTS (SELECT 1 FROM public.hidden_bars h WHERE h.profile_id = a.id AND h.user_id = (SELECT auth.uid()))
  ),
  candidates AS MATERIALIZED (
    SELECT c.kind, c.id FROM private.near_candidates(p_query, p_kinds) c
  ),
  drink_names AS MATERIALIZED (
    SELECT f.item_id, f.bar_profile_id, f.name, f.haystack
    FROM candidates c JOIN public.discover_drink_facts f ON f.item_id = c.id
    WHERE c.kind = 'drink'
  ),
  drinks AS (
    SELECT 'drink'::text AS kind, f.item_id AS id, f.name,
           concat_ws(' · ', b.display_name, coalesce(b.locality, b.city)) AS place, NULL::text AS handle,
           s.score, s.known
    FROM typed, drink_names f
    JOIN area ON area.id = f.bar_profile_id
    JOIN public.profiles b ON b.id = f.bar_profile_id
    CROSS JOIN LATERAL (
      SELECT least(public.near_score(p_query, f.name),
                   (SELECT min(public.near_score(p_query, sp.spelling)) FROM public.item_spellings sp WHERE sp.item_id = f.item_id)) AS score,
             EXISTS (SELECT 1 FROM public.item_spellings sp WHERE sp.item_id = f.item_id AND sp.spelling = typed.t) AS known
    ) s
    WHERE s.score IS NOT NULL
      AND (s.known OR NOT private.discover_has_all(f.haystack, typed.words))
  ),
  profile_names AS MATERIALIZED (
    SELECT p.id, p.kind, p.display_name, p.city, p.handle
    FROM candidates c JOIN public.profiles p ON p.id = c.id
    WHERE (c.kind IN ('person', 'maker') OR (c.kind = 'bar' AND p.id IN (SELECT area.id FROM area)))
  ),
  profiles AS (
    SELECT p.kind::text, p.id, p.display_name, p.city, p.handle, n.score, false
    FROM typed, profile_names p
    CROSS JOIN LATERAL (SELECT public.near_score(p_query, p.display_name) AS score) n
    WHERE strpos(private.discover_fold_ws(p.display_name), typed.t) = 0
      AND n.score IS NOT NULL
  ),
  ingredient_names AS MATERIALIZED (
    SELECT i.id, i.name
    FROM candidates c JOIN public.items i ON i.id = c.id
    WHERE c.kind = 'ingredient'
  ),
  ingredients AS (
    SELECT 'ingredient'::text, i.id, i.name, NULL::text, NULL::text, n.score, false
    FROM typed, ingredient_names i
    CROSS JOIN LATERAL (SELECT public.near_score(p_query, i.name) AS score) n
    WHERE strpos(private.discover_fold_ws(i.name), typed.t) = 0
      AND n.score IS NOT NULL
  ),
  hits AS (
    SELECT * FROM drinks UNION ALL SELECT * FROM profiles UNION ALL SELECT * FROM ingredients
  )
  SELECT h.kind, h.id, h.name, h.place, h.handle, h.score, h.known
  FROM hits h, typed
  WHERE typed.t <> ''
  ORDER BY h.known DESC, h.score, length(h.name), h.name, h.id
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 50);
END;
$$;
