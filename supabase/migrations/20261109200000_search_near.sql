-- "Did you mean" for the main search (Search tab, Library, Discover, ⌘K):
-- close names among the drinks bars pour, bars, people and ingredients, in
-- the area being searched (whole-app canvas, Search page, "Did you mean, in
-- every search": 1B and 1C).
--
--   * Close as public.near_score says (20261109100000), or by a saved
--     spelling (public.item_spellings). A drink whose saved spelling is
--     exactly what was typed comes back `known`: the app shows it as a
--     result, not a question, so "Yes, that's it" is asked once.
--   * Only what the plain search misses: drinks whose name, classic,
--     description and lines (discover_drink_facts.haystack) hold every
--     typed word, and bars, people and ingredients whose name holds what
--     was typed, are left out; the plain search shows those.
--   * Drinks and bars in the area as discover_list has them
--     (private.bars_in_area, through private.near_area_bars), less the bars
--     the caller hid. People and
--     ingredients are everywhere, as their plain search is.
--   * Runs as the caller: a drink shows only to whoever may select it
--     (discover_drink_facts' RLS), so it needs an account, as the drinks
--     list does.
--   * p_kinds picks what to look at; the app asks for ingredients in a call
--     of their own, as there are 20,000 of them.
--
--   * Candidates first: a name has to share enough letter runs with what
--     was typed (pg_trgm word similarity 0.3, on indexed folded names)
--     before near_score decides. Every typo tried passes (the lowest,
--     "negorni" for Negroni, is 0.38). Signed in, on the local catalog, an
--     Everywhere search takes 60 to 80 ms once a connection has its plan
--     (about 0.2 s for that connection's first few searches); scoring every
--     row took 0.65 s for drinks, bars and people and 0.7 s for ingredients.
-- ponytail: the prefilter misses a name that only sounds alike with few
-- shared letters ("peeny" alone for Pina, "negorni" for Nogroni). The app's
-- own lists (your drinks, the classics) still score every row.

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

CREATE INDEX "discover_drink_facts_name_trgm_idx" ON "public"."discover_drink_facts"
    USING "gin" ("public"."discover_fold"("name") "extensions"."gin_trgm_ops");
CREATE INDEX "items_ingredient_name_trgm_idx" ON "public"."items"
    USING "gin" ("public"."discover_fold"("name") "extensions"."gin_trgm_ops")
    WHERE "item_type" = 'ingredient' AND "bar_id" IS NULL;

-- The public bars in an area, as discover_list has them (private.bars_in_area,
-- which only reads public, open bars). Definer, so search_near can run as
-- its caller without the caller holding the area helpers themselves.
CREATE FUNCTION "private"."near_area_bars"("p_latitude" double precision, "p_longitude" double precision, "p_radius_km" double precision, "p_country_code" "text", "p_city" "text")
    RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT a.id FROM private.bars_in_area(p_latitude, p_longitude, p_radius_km, p_country_code, p_city) a;
$$;

REVOKE ALL ON FUNCTION "private"."near_area_bars"(double precision, double precision, double precision, "text", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."near_area_bars"(double precision, double precision, double precision, "text", "text") TO "authenticated", "service_role";

-- Which rows could be close, by name alone (and by saved spelling), through
-- the trigram indexes: ids only. Definer, because RLS runs before the
-- trigram operator (it isn't leakproof), which would check every row's
-- access first and never use the index. search_near then reads only these
-- rows, as its caller, so RLS still decides what comes back.
CREATE FUNCTION "private"."near_candidates"("p_query" "text", "p_kinds" "text"[])
    RETURNS TABLE("kind" "text", "id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    SET "pg_trgm.word_similarity_threshold" TO '0.3'
    AS $$
  -- Separate branches, not ORs, so each uses its index.
  SELECT 'drink', f.item_id FROM public.discover_drink_facts f
  WHERE 'drink' = ANY (p_kinds) AND private.discover_fold_ws(p_query) OPERATOR(extensions.<%) public.discover_fold(f.name)
  UNION
  SELECT 'drink', sp.item_id FROM public.item_spellings sp
  WHERE 'drink' = ANY (p_kinds) AND private.discover_fold_ws(p_query) OPERATOR(extensions.<%) sp.spelling
  UNION
  SELECT 'ingredient', i.id FROM public.items i
  WHERE 'ingredient' = ANY (p_kinds) AND i.item_type = 'ingredient' AND i.bar_id IS NULL
    AND private.discover_fold_ws(p_query) OPERATOR(extensions.<%) public.discover_fold(i.name)
  UNION
  SELECT p.kind::text, p.id FROM public.profiles p
  WHERE p.is_public AND p.kind::text = ANY (p_kinds)
    AND private.discover_fold_ws(p_query) OPERATOR(extensions.<%) public.discover_fold(p.display_name);
$$;

REVOKE ALL ON FUNCTION "private"."near_candidates"("text", "text"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "private"."near_candidates"("text", "text"[]) TO "authenticated", "service_role";

CREATE FUNCTION "public"."search_near"(
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
    -- A drink's bar and its neighbourhood; a bar's or a person's city.
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
    WHERE (c.kind = 'person' OR (c.kind = 'bar' AND p.id IN (SELECT area.id FROM area)))
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

REVOKE ALL ON FUNCTION "public"."search_near"("text", "text"[], double precision, double precision, double precision, "text", "text", integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."search_near"("text", "text"[], double precision, double precision, double precision, "text", "text", integer) TO "authenticated", "service_role";
