-- Follows: people you follow, and their recent ranks for Tonight at home
-- (GWBCX, Prod-today-home: "Sam ranked a Penicillin · Caretaker's · now
-- Sam's best sour · 9.1").
--
--   * follows (follower, followee): you add and remove your own. You see who
--     you follow and who follows you; nobody else does.
--   * friends_ranks(limit): recent ranks by people you follow, read through
--     get_profile_drinks, so everything a person keeps private stays private
--     (a public, age-checked, unmoderated profile; only the drinks they show;
--     the bar only when they say where; dates only when they show dates, and
--     a rank with no date isn't "recent", so it's left out). best_in_family
--     says whether it's now their top drink of its family (items.drink_family).

CREATE TABLE "public"."follows" (
    "follower_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "followee_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("follower_id", "followee_id"),
    CHECK ("follower_id" <> "followee_id")
);

COMMENT ON TABLE "public"."follows" IS
    'Who follows whom. Your own rows only; friends_ranks reads their shown ranks.';

CREATE INDEX "follows_followee" ON "public"."follows" ("followee_id");

ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select" ON "public"."follows" FOR SELECT TO "authenticated"
    USING ("follower_id" = (SELECT "auth"."uid"()) OR "followee_id" = (SELECT "auth"."uid"()));
CREATE POLICY "follows_insert" ON "public"."follows" FOR INSERT TO "authenticated"
    WITH CHECK ("follower_id" = (SELECT "auth"."uid"()) AND "followee_id" NOT IN (SELECT "private"."blocked_user_ids"()));
CREATE POLICY "follows_delete" ON "public"."follows" FOR DELETE TO "authenticated"
    USING ("follower_id" = (SELECT "auth"."uid"()));

GRANT SELECT, INSERT, DELETE ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";

CREATE FUNCTION "public"."friends_ranks"("p_limit" integer DEFAULT 10)
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
  WHERE r.created_at IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION "public"."friends_ranks"(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."friends_ranks"(integer) TO "authenticated", "service_role";
