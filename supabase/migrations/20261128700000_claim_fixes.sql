-- Claiming your page, the fixes from walking Mathew Resler through it (28 Oct
-- 2026, Kevin: "fix every single thing").
--
--   1. public.person_near_score: a person's name also matches with the first
--      typed word cut to three letters, so "Matt Reisler" finds Mathew
--      Resler and "Mark Resler" doesn't. Only with two or more words (the
--      last name narrows it). search_near uses it for people; drinks, bars
--      and ingredients keep near_score. Its twin is lib/nearName.ts
--      personNearScore.
--   2. confirm_person_claim: the bar's Admin confirming someone whose job
--      there is current also puts them on the team as a Bartender, so they
--      don't have to ask to join and wait for the same Admin again.
--   3. public.claimants(p_claim_ids): for moderators, who sent each claim:
--      the account's name and sign-in email, their own person page, and the
--      jobs at the claimed bar on that page or on a person page they're
--      claiming. Profile claims review shows it.

-- --- 1. Short first names ---

CREATE FUNCTION "public"."person_near_score"("p_query" "text", "p_name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  WITH w AS (
    SELECT regexp_split_to_array(btrim(regexp_replace(public.discover_fold(p_query), '[^a-z0-9]+', ' ', 'g')), ' ') AS words
  )
  SELECT CASE
    WHEN cardinality(w.words) < 2 OR length(w.words[1]) <= 3 THEN public.near_score(p_query, p_name)
    -- least() skips nulls: the closer of the two, or whichever matched.
    ELSE least(public.near_score(p_query, p_name),
               public.near_score(array_to_string(left(w.words[1], 3) || w.words[2:], ' '), p_name))
  END
  FROM w;
$$;

REVOKE ALL ON FUNCTION "public"."person_near_score"("text", "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."person_near_score"("text", "text") TO "anon", "authenticated", "service_role";

-- As 20261114300000, except people are scored by person_near_score.
CREATE OR REPLACE FUNCTION public.search_near(p_query text, p_kinds text[] DEFAULT ARRAY['drink'::text, 'bar'::text, 'person'::text], p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT 10, p_country_code text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_limit integer DEFAULT 8)
 RETURNS TABLE(kind text, id uuid, name text, place text, handle text, score integer, known boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
    CROSS JOIN LATERAL (SELECT CASE WHEN p.kind = 'person' THEN public.person_near_score(p_query, p.display_name) ELSE public.near_score(p_query, p.display_name) END AS score) n
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
$function$

;

-- --- 2. The bar's confirm puts them on the team ---

-- As 20261113310000, then the team: a current job at the confirming bar,
-- from history we found (bar_can_confirm already checked it isn't one added
-- in the app), makes them a Bartender at its venue. Someone already on the
-- team keeps their role.
CREATE OR REPLACE FUNCTION "public"."confirm_person_claim"("p_claim_id" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_claim public.profile_claims;
    v_profile public.profiles;
    v_bar public.profiles;
BEGIN
    SELECT * INTO v_claim FROM public.profile_claims WHERE id = p_claim_id FOR UPDATE;
    IF v_claim.id IS NULL OR NOT private.bar_can_confirm(v_claim) THEN
        RAISE EXCEPTION 'That claim isn''t waiting on you.';
    END IF;
    SELECT * INTO v_bar FROM public.profiles WHERE id = (v_claim.evidence ->> 'confirm_bar')::uuid;
    UPDATE public.profile_claims SET evidence = evidence || jsonb_build_object('confirmed_by_bar', auth.uid()) WHERE id = p_claim_id;
    -- The job, read before the page merges into theirs and its id goes.
    IF EXISTS (
        SELECT 1 FROM public.profile_positions
        WHERE person_profile_id = v_claim.profile_id AND bar_profile_id = v_bar.id AND is_current AND NOT added_in_app
    ) THEN
        INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES (v_claim.user_id, v_bar.bar_id, 30)
        ON CONFLICT (user_id, bar_id) DO NOTHING;
        -- An ask to join that's now answered.
        DELETE FROM public.venue_join_requests WHERE bar_id = v_bar.bar_id AND user_id = v_claim.user_id;
    END IF;
    v_profile := private.hand_over_claim(p_claim_id, auth.uid());
    RETURN v_profile;
END;
$$;

-- --- 3. Who is claiming, for moderators ---

-- One row per claim asked about that the caller can review (moderators
-- only; nobody else gets rows). works_here: jobs at the claimed bar, from
-- their own page (claimed: true) or a person page they're claiming
-- (claimed: false), current first.
CREATE FUNCTION "public"."claimants"("p_claim_ids" "uuid"[]) RETURNS TABLE (
    "claim_id" "uuid",
    "name" "text",
    "email" "text",
    "profile_handle" "text",
    "profile_name" "text",
    "works_here" "jsonb"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT c.id, private.member_display_name(c.user_id), u.email::text, own.handle, own.display_name,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('person', pp.display_name, 'title', j.title, 'is_current', j.is_current,
                                              'start_year', j.start_year, 'start_month', j.start_month, 'claimed', pp.user_id IS NOT NULL)
                            ORDER BY j.is_current DESC, j.start_year DESC NULLS LAST)
           FROM public.profile_positions j
           JOIN public.profiles pp ON pp.id = j.person_profile_id
           WHERE j.bar_profile_id = c.profile_id
             AND (pp.user_id = c.user_id
                  OR pp.id IN (SELECT o.profile_id FROM public.profile_claims o WHERE o.user_id = c.user_id AND o.status = 'pending'))
         ), '[]'::jsonb)
  FROM public.profile_claims c
  JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT p.handle, p.display_name FROM public.profiles p WHERE p.user_id = c.user_id AND p.kind = 'person' LIMIT 1
  ) own ON true
  WHERE c.id = ANY (p_claim_ids) AND private.is_app_admin();
$$;

REVOKE ALL ON FUNCTION "public"."claimants"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."claimants"("uuid"[]) TO "authenticated", "service_role";
