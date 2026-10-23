-- public.top_ranked_classics(p_limit): the catalog classics most people rank.
--
-- "This is your bar. What next?" (#734) offers a new venue the 20 most ranked
-- classics. get_item_scores only counts people who ranked the classic itself,
-- so a bar's Negroni ranked as a Negroni (rank_entries.ranked_as_item_id) was
-- never counted. This counts both, each person once per classic.
--
-- Whose rankings count, as the shared scores count them: a confirmed age (as
-- private.counted_rank_scores), and at a venue only when its page is public,
-- not private and not held for moderation, and the person isn't its staff
-- (as venue_drink_scores leaves out staff at their own bar). A classic shows
-- once it has the rankers a score needs (private.ranking_min_rankers), as in
-- get_item_scores, so no small count is public.
--
-- Most ranked first; a tie at the last row brings the whole tie (WITH TIES),
-- so the app can break it in its best-known order (lib/discover.ts
-- MOST_ASKED, which lives in the app) and fill the rest of the 20 the same
-- way. Read-only, for anyone, at most 200 rows plus a tie.
--
-- ponytail: counts rank_entries live on each call, fine while it's
-- thousands of rows; the app keeps the answer an hour. A per-classic count
-- in the hourly ranking refresh (a materialized view) is the upgrade.

CREATE FUNCTION "public"."top_ranked_classics"("p_limit" integer DEFAULT 20)
RETURNS TABLE ("item_id" "uuid", "rankers" integer)
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO ''
AS $$
  WITH counted AS (
    SELECT DISTINCT e.ranked_as_item_id, e.user_id
    FROM public.rank_entries e
    JOIN public.items i ON i.id = e.ranked_as_item_id AND i.is_catalog
    LEFT JOIN public.profiles p ON p.id = e.venue_profile_id
    WHERE EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = e.user_id AND a.confirmed_at IS NOT NULL)
      AND (
        e.venue_profile_id IS NULL
        OR (
          p.is_public
          AND p.moderated_at IS NULL
          AND p.page_visibility IS DISTINCT FROM 'private'
          AND NOT EXISTS (SELECT 1 FROM public.user_bars ub WHERE ub.user_id = e.user_id AND ub.bar_id = p.bar_id)
        )
      )
  )
  SELECT c.ranked_as_item_id, count(*)::integer
  FROM counted c
  GROUP BY c.ranked_as_item_id
  HAVING count(*) >= private.ranking_min_rankers()
  ORDER BY 2 DESC
  FETCH FIRST (least(greatest(coalesce(p_limit, 20), 0), 200)) ROWS WITH TIES;
$$;

REVOKE EXECUTE ON FUNCTION "public"."top_ranked_classics"(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."top_ranked_classics"(integer) TO "anon", "authenticated", "service_role";
