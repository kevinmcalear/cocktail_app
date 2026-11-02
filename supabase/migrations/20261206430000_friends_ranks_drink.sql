-- friends_ranks takes an optional drink (Kevin, 1 Nov 2026), so a drink page
-- and Rank it's result can show every friend's rank of that drink, not only
-- the ones among their 50 latest ranks.
--
--   * friends_ranks(limit, item): with p_item_id, only ranks of that drink
--     (rank_entries.item_id), best first, and ranks with no date shown are
--     kept: the person shares the rank, only not when. best_in_family still
--     looks at all of their shown drinks. Without it, as before: recent ranks
--     across every drink, newest first, dated ones only.
--   * Everything else as 20261205600000_follows.sql: security definer, read
--     through get_profile_drinks, so what a person keeps private stays private.
--
-- A new argument is a new signature, so the one-argument function is dropped
-- and made again with the same grants. Apps calling it with p_limit alone get
-- the default (no drink).

DROP FUNCTION "public"."friends_ranks"(integer);

CREATE FUNCTION "public"."friends_ranks"("p_limit" integer DEFAULT 10, "p_item_id" "uuid" DEFAULT NULL)
    RETURNS TABLE (
        "profile_id" "uuid", "display_name" "text", "avatar_url" "text",
        "entry_id" "uuid", "item_id" "uuid", "name" "text", "venue_name" "text",
        "score" numeric, "created_at" timestamp with time zone,
        "drink_family" "text", "best_in_family" boolean
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH shown AS (
    SELECT p.id AS profile_id, p.display_name, p.avatar_url, d.*, i.drink_family
    FROM public.follows f
    JOIN public.profiles p ON p.user_id = f.followee_id AND p.kind = 'person'
    CROSS JOIN LATERAL public.get_profile_drinks(p.id) d
    LEFT JOIN public.items i ON i.id = d.item_id
    WHERE f.follower_id = auth.uid()
  ), ranked AS (
    -- Scores are per list, so tops tie across lists: the latest of them is "now" their best.
    SELECT s.*,
           s.drink_family IS NOT NULL
             AND row_number() OVER (PARTITION BY s.profile_id, s.drink_family ORDER BY s.score DESC, s.created_at DESC) = 1 AS best
    FROM shown s
  )
  SELECT r.profile_id, r.display_name, r.avatar_url, r.id, r.item_id, r.name, r.venue_name,
         r.score, r.created_at, r.drink_family, r.best
  FROM ranked r
  WHERE CASE WHEN p_item_id IS NULL THEN r.created_at IS NOT NULL ELSE r.item_id = p_item_id END
  ORDER BY CASE WHEN p_item_id IS NULL THEN r.created_at END DESC, r.score DESC, r.created_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION "public"."friends_ranks"(integer, "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."friends_ranks"(integer, "uuid") TO "authenticated", "service_role";
