-- follow_people(): the names and pictures of the people you follow and who
-- follow you, including those with no public page (People, Kept-people).
-- Without it People can only count them ("1 more person without a public
-- page follows you").
--
--   * Only people linked to you by a follows row, either way; nobody else.
--   * Their name from their account (full name, else first and last name),
--     else their person page's name. Never anything from their email: a name
--     nobody gave comes back null and the app says "Someone".
--   * Their picture only from their own account upload (private.account_photo),
--     and not when their page hides it (shows_photo off).
--   * Leaves out people you've blocked or who blocked you.
--   * Says which way the follow goes (i_follow, follows_me).
-- New function only: no table, column or policy changes.

CREATE FUNCTION "public"."follow_people"()
    RETURNS TABLE ("user_id" "uuid", "display_name" "text", "avatar_url" "text", "i_follow" boolean, "follows_me" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH linked AS (
    SELECT f.followee_id AS uid, true AS i_follow, false AS follows_me
    FROM public.follows f WHERE f.follower_id = auth.uid()
    UNION ALL
    SELECT f.follower_id, false, true
    FROM public.follows f WHERE f.followee_id = auth.uid()
  ), people AS (
    SELECT l.uid, bool_or(l.i_follow) AS i_follow, bool_or(l.follows_me) AS follows_me
    FROM linked l GROUP BY l.uid
  )
  SELECT
    p.uid,
    COALESCE(
      NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(concat_ws(' ', NULLIF(btrim(u.raw_user_meta_data ->> 'first_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'last_name'), ''))), ''),
      (SELECT NULLIF(btrim(pr.display_name), '') FROM public.profiles pr WHERE pr.user_id = p.uid AND pr.kind = 'person' LIMIT 1)
    ),
    CASE WHEN EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = p.uid AND pr.kind = 'person' AND NOT pr.shows_photo)
      THEN NULL ELSE private.account_photo(p.uid) END,
    p.i_follow,
    p.follows_me
  FROM people p
  JOIN auth.users u ON u.id = p.uid
  WHERE auth.uid() IS NOT NULL
    AND p.uid NOT IN (SELECT private.blocked_user_ids());
$$;

COMMENT ON FUNCTION "public"."follow_people"() IS
    'People linked to you by follows (either way): name and own picture, never from their email. Yours only.';

REVOKE ALL ON FUNCTION "public"."follow_people"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."follow_people"() TO "authenticated", "service_role";
