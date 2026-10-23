-- Glass search forgives accents and small slips (Kevin, 23 Oct 2026: "the
-- search to get to the nude glassware is absolute shit"; board
-- tools-glassware-find-phone, phone 3). "remi savage" found nothing, since
-- the catalog says "Rémy"; now it finds the five Nude x Savage glasses, as do
-- "remi savge", "speigelau" (all 71 Spiegelau glasses) and "hghball".
--
--   * Both sides are folded as Discover folds them (public.discover_fold:
--     lower case, Latin accents off), so "remy" finds "Rémy".
--   * A word of 4 to 7 letters may be one letter off a word of the glass
--     (missing, extra or changed), and a word of 8 or more two letters off.
--     Shorter words, and item codes and sizes typed in full, still match
--     only as they are.
--   * Glasses that match every word as typed come first, then those with one
--     slip, and so on; otherwise the order is as before.
--
-- The edit distance comes from fuzzystrmatch, which Supabase ships; it goes
-- in the extensions schema like the others. discover_fold is a pure text
-- function: anon may now run it too, as this search runs as its caller and
-- signed-out visitors search glasses.

CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA "extensions";

GRANT EXECUTE ON FUNCTION "public"."discover_fold"("text") TO "anon";

CREATE OR REPLACE FUNCTION "public"."search_glass_models"("p_query" "text", "p_glass" "text" DEFAULT NULL, "p_limit" integer DEFAULT 40)
    RETURNS SETOF "public"."glass_models"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT m.*
  FROM public.glass_models m
  JOIN public.profiles p ON p.id = m.maker_profile_id
  CROSS JOIN LATERAL (
    SELECT public.discover_fold(concat_ws(' ', p.display_name, m.name, m.series, m.designer, m.model_code,
                                          array_to_string(m.aliases, ' '), m.capacity_ml::text)) AS hay
  ) h
  CROSS JOIN LATERAL (
    -- slips: words not in the glass as typed; misses: not even a letter or two off one of its words.
    SELECT count(*) FILTER (WHERE position(w IN h.hay) = 0) AS slips,
           count(*) FILTER (WHERE position(w IN h.hay) = 0 AND NOT EXISTS (
             SELECT 1 FROM regexp_split_to_table(h.hay, '[^a-z0-9]+') hw
             WHERE length(w) >= 4 AND abs(length(hw) - length(w)) <= k
               AND extensions.levenshtein_less_equal(w, hw, k) <= k
           )) AS misses
    FROM regexp_split_to_table(public.discover_fold(btrim(coalesce(p_query, ''))), '\s+') w
    CROSS JOIN LATERAL (SELECT CASE WHEN length(w) >= 8 THEN 2 ELSE 1 END AS k) kk
    WHERE w <> ''
  ) s
  WHERE (p_glass IS NULL OR m.glass = p_glass)
    AND s.misses = 0
  ORDER BY s.slips, m.discontinued, p.display_name, m.name, m.capacity_ml NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
