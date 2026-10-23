-- public.top_ranked_classics(p_limit): the catalog classics most people rank.
--
-- "This is your bar. What next?" (#734) offers a new venue the 20 most ranked
-- classics. get_item_scores only counts people who ranked the classic itself,
-- and only past the 20 rankers a score needs, so a bar's Negroni ranked as a
-- Negroni (rank_entries.ranked_as_item_id) was never counted. This counts
-- both: each person once per classic, from private.counted_rank_scores (the
-- rankings that count, as every shared score reads them).
--
-- It returns only a count per classic, never a score or who ranked, so it has
-- no minimum. Classics nobody ranks are left out; the app fills the rest of
-- the 20 in its best-known order, which also breaks ties (that order lives in
-- the app, lib/discover.ts MOST_ASKED). Read-only, for anyone, at most 200 rows.

CREATE FUNCTION "public"."top_ranked_classics"("p_limit" integer DEFAULT 100)
RETURNS TABLE ("item_id" "uuid", "rankers" integer)
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO ''
AS $$
  SELECT s.ranked_as_item_id, count(DISTINCT s.user_id)::integer
  FROM private.counted_rank_scores s
  JOIN public.items i ON i.id = s.ranked_as_item_id AND i.is_catalog
  GROUP BY s.ranked_as_item_id
  ORDER BY 2 DESC, s.ranked_as_item_id
  LIMIT least(greatest(coalesce(p_limit, 100), 0), 200);
$$;

REVOKE EXECUTE ON FUNCTION "public"."top_ranked_classics"(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."top_ranked_classics"(integer) TO "anon", "authenticated", "service_role";
